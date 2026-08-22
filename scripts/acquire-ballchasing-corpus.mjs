#!/usr/bin/env node
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const API_ROOT = "https://ballchasing.com/api";
const SCHEMA_VERSION = "replay-method-ballchasing-corpus.v1";
const MINIMUM_REPLAY_BYTES = 1_024;
const DEFAULT_EARLIEST_DATE = "2025-01-01T00:00:00Z";
const REQUEST_INTERVAL_MS = 1_050;
const MAX_RETRIES = 5;

const modeTargets = [
  { mode: "1v1", playlist: "ranked-duels", target: 60 },
  { mode: "2v2", playlist: "ranked-doubles", target: 80 },
  { mode: "3v3", playlist: "ranked-standard", target: 60 },
];

const rankFilters = [
  "gold-1", "gold-2", "gold-3",
  "platinum-1", "platinum-2", "platinum-3",
  "diamond-1", "diamond-2", "diamond-3",
  "champion-1", "champion-2", "champion-3",
  "grand-champion",
];

function argument(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function sleep(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

function timestamp() {
  return new Date().toISOString();
}

function hash(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function privateFingerprint(value, salt) {
  return value ? hash(`${salt}:${value}`).slice(0, 20) : null;
}

function atomicJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const partial = `${path}.partial`;
  writeFileSync(partial, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  renameSync(partial, path);
}

function quotas(target) {
  const base = Math.floor(target / rankFilters.length);
  const remainder = target % rankFilters.length;
  return Object.fromEntries(rankFilters.map((rank, index) => [rank, base + Number(index < remainder)]));
}

function assignment(replayId) {
  return Number.parseInt(hash(`holdout:v1:${replayId}`).slice(0, 8), 16) % 5 === 0
    ? "holdout"
    : "calibration";
}

function participantFingerprints(replay, salt) {
  const players = [...(replay.blue?.players ?? []), ...(replay.orange?.players ?? [])];
  return [...new Set(players.flatMap((player) => {
    const platform = player?.id?.platform;
    const id = player?.id?.id;
    return platform && id ? [privateFingerprint(`${platform}:${id}`, salt)] : [];
  }))].sort();
}

function createManifest(outputDirectory, earliestDate) {
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: timestamp(),
    updatedAt: timestamp(),
    source: {
      provider: "ballchasing.com",
      api: "official",
      purpose: "private_internal_engine_calibration",
      rightsConclusion: "not_asserted",
      customerData: false,
    },
    policy: {
      earliestPrimaryReplayDate: earliestDate,
      requestIntervalMs: REQUEST_INTERVAL_MS,
      holdoutAssignment: "sha256 replay id modulo 5; fixed before engine tuning",
      holdoutTuningAccess: "prohibited",
      rawBinariesInGit: false,
      exactRankRule: "Preserve Ballchasing rank filter; Grand Champion division remains unknown.",
    },
    target: Object.fromEntries(modeTargets.map(({ mode, target }) => [mode, target])),
    privacySalt: randomBytes(32).toString("hex"),
    outputDirectory,
    discovery: {},
    replays: [],
    duplicates: [],
    failures: [],
  };
}

function loadManifest(path, outputDirectory, earliestDate) {
  if (!existsSync(path)) return createManifest(outputDirectory, earliestDate);
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  if (parsed.schemaVersion !== SCHEMA_VERSION || !Array.isArray(parsed.replays)) {
    throw new Error(`Unsupported acquisition manifest at ${path}.`);
  }
  return parsed;
}

let lastRequestAt = 0;
async function apiRequest(token, url, { binary = false } = {}) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const wait = Math.max(0, REQUEST_INTERVAL_MS - (Date.now() - lastRequestAt));
    if (wait) await sleep(wait);
    lastRequestAt = Date.now();
    let response;
    try {
      response = await fetch(url, {
        headers: { Authorization: token },
        signal: AbortSignal.timeout(45_000),
      });
    } catch (error) {
      if (attempt === MAX_RETRIES) throw error;
      await sleep(Math.min(30_000, 1_000 * (2 ** attempt)));
      continue;
    }
    if (response.ok) return binary ? new Uint8Array(await response.arrayBuffer()) : response.json();
    if (![408, 429, 500, 502, 503, 504].includes(response.status) || attempt === MAX_RETRIES) {
      throw new Error(`Ballchasing API returned HTTP ${response.status} for ${new URL(url).pathname}.`);
    }
    const retryAfter = Number(response.headers.get("retry-after"));
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0
      ? Math.min(60_000, retryAfter * 1_000)
      : Math.min(30_000, 1_000 * (2 ** attempt)));
  }
  throw new Error("Ballchasing API retry budget exhausted.");
}

function queryUrl(playlist, rank, count = 200, earliestDate = DEFAULT_EARLIEST_DATE) {
  const url = new URL(`${API_ROOT}/replays`);
  url.searchParams.set("playlist", playlist);
  url.searchParams.set("min-rank", rank);
  url.searchParams.set("max-rank", rank);
  url.searchParams.set("replay-date-after", earliestDate);
  url.searchParams.set("sort-by", "replay-date");
  url.searchParams.set("sort-dir", "desc");
  url.searchParams.set("count", String(count));
  return url;
}

function corpusCounts(manifest) {
  const downloaded = manifest.replays.filter((replay) => replay.downloadState === "downloaded" && !replay.duplicateOf);
  return {
    total: downloaded.length,
    calibration: downloaded.filter((replay) => replay.assignment === "calibration").length,
    holdout: downloaded.filter((replay) => replay.assignment === "holdout").length,
    modes: Object.fromEntries(modeTargets.map(({ mode }) => [mode, downloaded.filter((replay) => replay.mode === mode).length])),
  };
}

const outputDirectory = resolve(argument("--output", "private-corpus/ballchasing"));
const manifestPath = resolve(argument("--manifest", `${outputDirectory}/acquisition-manifest.json`));
const earliestDate = argument("--earliest-date", DEFAULT_EARLIEST_DATE);
const token = process.env.BALLCHASING_API_TOKEN?.trim();
if (!token) {
  console.error("BALLCHASING_API_TOKEN is required and must be supplied outside source control.");
  process.exit(1);
}

mkdirSync(resolve(outputDirectory, "replays"), { recursive: true, mode: 0o700 });
const manifest = loadManifest(manifestPath, outputDirectory, earliestDate);
const persist = () => {
  manifest.updatedAt = timestamp();
  atomicJson(manifestPath, manifest);
};

const auth = await apiRequest(token, `${API_ROOT}/`);
if (!auth || typeof auth !== "object") throw new Error("Ballchasing authentication did not return the expected contract.");
console.error("Ballchasing authentication verified; starting/resuming private corpus acquisition.");

const replayIds = new Set(manifest.replays.map((replay) => replay.ballchasingReplayId));
const rocketLeagueIds = new Set(manifest.replays.map((replay) => replay.rocketLeagueId).filter(Boolean));
const checksums = new Map(manifest.replays.filter((replay) => replay.sha256).map((replay) => [replay.sha256, replay.ballchasingReplayId]));
const uploaderCounts = new Map();
const playerCounts = new Map();
for (const replay of manifest.replays.filter((item) => item.downloadState === "downloaded" && !item.duplicateOf)) {
  if (replay.uploaderFingerprint) uploaderCounts.set(replay.uploaderFingerprint, (uploaderCounts.get(replay.uploaderFingerprint) ?? 0) + 1);
  for (const player of replay.playerFingerprints ?? []) playerCounts.set(player, (playerCounts.get(player) ?? 0) + 1);
}

for (const entry of manifest.replays.filter((replay) => ["downloading", "failed"].includes(replay.downloadState))) {
  try {
    entry.downloadState = "downloading";
    entry.failure = null;
    persist();
    const bytes = await apiRequest(token, `${API_ROOT}/replays/${encodeURIComponent(entry.ballchasingReplayId)}/file`, { binary: true });
    if (bytes.byteLength < MINIMUM_REPLAY_BYTES) throw new Error("Downloaded replay was unexpectedly small.");
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const duplicateOf = checksums.get(checksum);
    if (duplicateOf) {
      entry.downloadState = "duplicate";
      entry.duplicateOf = duplicateOf;
      entry.sha256 = checksum;
      entry.sizeBytes = bytes.byteLength;
      manifest.duplicates.push({ ballchasingReplayId: entry.ballchasingReplayId, duplicateType: "sha256", duplicateOf, detectedAt: timestamp() });
    } else {
      const destination = resolve(outputDirectory, "replays", `${entry.ballchasingReplayId}.replay`);
      const partial = `${destination}.partial`;
      writeFileSync(partial, bytes, { mode: 0o600 });
      renameSync(partial, destination);
      entry.downloadState = "downloaded";
      entry.downloadedAt = timestamp();
      entry.sha256 = checksum;
      entry.sizeBytes = bytes.byteLength;
      entry.storagePath = destination;
      checksums.set(checksum, entry.ballchasingReplayId);
      if (entry.rocketLeagueId) rocketLeagueIds.add(entry.rocketLeagueId);
      if (entry.uploaderFingerprint) uploaderCounts.set(entry.uploaderFingerprint, (uploaderCounts.get(entry.uploaderFingerprint) ?? 0) + 1);
      for (const player of entry.playerFingerprints ?? []) playerCounts.set(player, (playerCounts.get(player) ?? 0) + 1);
    }
  } catch (error) {
    entry.downloadState = "failed";
    entry.failure = error instanceof Error ? error.message.slice(0, 300) : "Unknown download failure";
    manifest.failures.push({ ballchasingReplayId: entry.ballchasingReplayId, stage: "download_resume", occurredAt: timestamp(), reason: entry.failure });
  }
  persist();
}

for (const modeTarget of modeTargets) {
  const rankQuotas = quotas(modeTarget.target);
  for (const rank of rankFilters) {
    const acceptedForCohort = () => manifest.replays.filter((replay) =>
      replay.downloadState === "downloaded" && !replay.duplicateOf && replay.mode === modeTarget.mode && replay.rankFilter === rank).length;
    const needed = rankQuotas[rank];
    if (acceptedForCohort() >= needed) continue;

    const discoveryKey = `${modeTarget.playlist}:${rank}`;
    let url = manifest.discovery[discoveryKey]?.nextUrl || queryUrl(modeTarget.playlist, rank, 200, earliestDate).toString();
    let pages = 0;
    while (acceptedForCohort() < needed && url && pages < 8) {
      const page = await apiRequest(token, url);
      pages += 1;
      manifest.discovery[discoveryKey] = {
        lastQueriedAt: timestamp(),
        pages: (manifest.discovery[discoveryKey]?.pages ?? 0) + 1,
        nextUrl: page.next ?? null,
      };
      for (const replay of page.list ?? []) {
        if (acceptedForCohort() >= needed) break;
        if (!replay?.id || replayIds.has(replay.id)) continue;
        if (replay.rocket_league_id && rocketLeagueIds.has(replay.rocket_league_id)) {
          manifest.duplicates.push({ ballchasingReplayId: replay.id, duplicateType: "rocket_league_id", detectedAt: timestamp() });
          replayIds.add(replay.id);
          continue;
        }
        const replayDate = replay.date ? new Date(replay.date) : null;
        if (!replayDate || Number.isNaN(replayDate.getTime()) || replayDate < new Date(earliestDate)) continue;

        const uploaderFingerprint = privateFingerprint(replay.uploader?.steam_id, manifest.privacySalt);
        const playerFingerprints = participantFingerprints(replay, manifest.privacySalt);
        if (uploaderFingerprint && (uploaderCounts.get(uploaderFingerprint) ?? 0) >= 4) continue;
        if (playerFingerprints.some((player) => (playerCounts.get(player) ?? 0) >= 4)) continue;

        const entry = {
          ballchasingReplayId: replay.id,
          rocketLeagueId: replay.rocket_league_id ?? null,
          source: "ballchasing_official_api",
          sourcePurpose: "private_internal_engine_calibration",
          discoveredAt: timestamp(),
          downloadedAt: null,
          replayDate: replay.date,
          season: replay.season ?? null,
          build: null,
          playlist: replay.playlist_id ?? modeTarget.playlist,
          mode: modeTarget.mode,
          rankFilter: rank,
          trustworthyRankCohort: rank === "grand-champion" ? "grand-champion-division-unknown" : rank,
          rankProvenance: "ballchasing_exact_min_and_max_rank_filter",
          uploaderFingerprint,
          playerFingerprints,
          lobbyFingerprint: replay.rocket_league_id ? privateFingerprint(replay.rocket_league_id, manifest.privacySalt) : null,
          assignment: assignment(replay.id),
          holdoutLockedAtDiscovery: true,
          downloadState: "downloading",
          parserState: "pending",
          attributionState: "pending",
          calibrationState: "pending",
          sha256: null,
          sizeBytes: null,
          storagePath: null,
        };
        manifest.replays.push(entry);
        replayIds.add(replay.id);
        persist();

        try {
          const bytes = await apiRequest(token, `${API_ROOT}/replays/${encodeURIComponent(replay.id)}/file`, { binary: true });
          if (bytes.byteLength < MINIMUM_REPLAY_BYTES) throw new Error("Downloaded replay was unexpectedly small.");
          const checksum = createHash("sha256").update(bytes).digest("hex");
          const duplicateOf = checksums.get(checksum);
          if (duplicateOf) {
            entry.downloadState = "duplicate";
            entry.duplicateOf = duplicateOf;
            entry.sha256 = checksum;
            entry.sizeBytes = bytes.byteLength;
            manifest.duplicates.push({ ballchasingReplayId: replay.id, duplicateType: "sha256", duplicateOf, detectedAt: timestamp() });
          } else {
            const destination = resolve(outputDirectory, "replays", `${replay.id}.replay`);
            const partial = `${destination}.partial`;
            writeFileSync(partial, bytes, { mode: 0o600 });
            renameSync(partial, destination);
            entry.downloadState = "downloaded";
            entry.downloadedAt = timestamp();
            entry.sha256 = checksum;
            entry.sizeBytes = bytes.byteLength;
            entry.storagePath = destination;
            checksums.set(checksum, replay.id);
            if (replay.rocket_league_id) rocketLeagueIds.add(replay.rocket_league_id);
            if (uploaderFingerprint) uploaderCounts.set(uploaderFingerprint, (uploaderCounts.get(uploaderFingerprint) ?? 0) + 1);
            for (const player of playerFingerprints) playerCounts.set(player, (playerCounts.get(player) ?? 0) + 1);
          }
        } catch (error) {
          entry.downloadState = "failed";
          entry.failure = error instanceof Error ? error.message.slice(0, 300) : "Unknown download failure";
          manifest.failures.push({ ballchasingReplayId: replay.id, stage: "download", occurredAt: timestamp(), reason: entry.failure });
        }
        persist();
        const counts = corpusCounts(manifest);
        console.error(`Corpus ${counts.total}/${modeTargets.reduce((sum, item) => sum + item.target, 0)} · ${modeTarget.mode} ${counts.modes[modeTarget.mode]}/${modeTarget.target} · holdout ${counts.holdout}`);
      }
      url = page.next ?? null;
      if (!url) break;
    }
    if (acceptedForCohort() < needed) {
      manifest.failures.push({
        stage: "discovery",
        mode: modeTarget.mode,
        rankFilter: rank,
        occurredAt: timestamp(),
        reason: `Only ${acceptedForCohort()} of ${needed} diverse recent replays acquired.`,
      });
      persist();
    }
  }
}

const finalCounts = corpusCounts(manifest);
manifest.summary = { ...finalCounts, completedAt: timestamp() };
persist();
console.error(`Acquisition complete: ${finalCounts.total} unique replay files (${finalCounts.calibration} calibration, ${finalCounts.holdout} locked holdout).`);
if (modeTargets.some(({ mode, target }) => finalCounts.modes[mode] < target)) process.exitCode = 2;
