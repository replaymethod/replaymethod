#!/usr/bin/env node
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, relative, resolve, sep } from "node:path";
import { aggregateCalibrationRuns, calibrationFingerprint } from "../services/rl-engine/calibration.mjs";
import { buildReplayEvidence, inspectReplayRoster, NORMALIZER_VERSION, PARSER_VERSION } from "../services/rl-engine/parser.mjs";
import { runShadowDetectors, SHADOW_RUNTIME_VERSION } from "../services/rl-engine/shadow-runtime.mjs";
import { cohortKey, normalizeMode, normalizeRankCohort } from "../services/rl-engine/context.mjs";

function usage() {
  console.error("Usage: node scripts/calibrate-rl-engine.mjs <file-or-directory> [...] [--metadata corpus.json] [--split calibration|calibration_dev] [--shard-index 0 --shard-count 4] [--output report.json]");
}

function replayFiles(target) {
  if (!existsSync(target)) return [];
  if (statSync(target).isFile()) return target.endsWith(".replay") ? [target] : [];
  return readdirSync(target, { withFileTypes: true }).flatMap((entry) => {
    const child = resolve(target, entry.name);
    return entry.isDirectory() ? replayFiles(child) : (entry.name.endsWith(".replay") ? [child] : []);
  });
}

const rawArgs = process.argv.slice(2);
const outputIndex = rawArgs.indexOf("--output");
const metadataIndex = rawArgs.indexOf("--metadata");
const splitIndex = rawArgs.indexOf("--split");
const shardIndexOption = rawArgs.indexOf("--shard-index");
const shardCountOption = rawArgs.indexOf("--shard-count");
const output = outputIndex >= 0 ? rawArgs[outputIndex + 1] : null;
const metadataPath = metadataIndex >= 0 ? rawArgs[metadataIndex + 1] : null;
const split = splitIndex >= 0 ? rawArgs[splitIndex + 1] : null;
const shardIndex = shardIndexOption >= 0 ? Number(rawArgs[shardIndexOption + 1]) : null;
const shardCount = shardCountOption >= 0 ? Number(rawArgs[shardCountOption + 1]) : null;
const optionIndexes = [outputIndex, metadataIndex, splitIndex, shardIndexOption, shardCountOption].filter((index) => index >= 0).flatMap((index) => [index, index + 1]);
const targets = rawArgs.filter((arg, index) => !optionIndexes.includes(index));
const shardConfigured = shardIndexOption >= 0 || shardCountOption >= 0;
const validShard = !shardConfigured || (Number.isInteger(shardIndex) && Number.isInteger(shardCount)
  && shardCount > 0 && shardIndex >= 0 && shardIndex < shardCount);
if (!targets.length || (outputIndex >= 0 && !output) || (metadataIndex >= 0 && !metadataPath)
  || (split && !["calibration", "calibration_dev"].includes(split)) || !validShard) {
  usage();
  process.exitCode = 1;
} else {
  const resolvedTargets = targets.map((target) => resolve(target));
  const sourceMetadata = metadataPath ? JSON.parse(readFileSync(resolve(metadataPath), "utf8")) : { replays: {} };
  const acquisitionEntries = Array.isArray(sourceMetadata.approved)
    ? sourceMetadata.approved
    : Array.isArray(sourceMetadata.replays) ? sourceMetadata.replays : [];
  if (!split && acquisitionEntries.some((entry) => ["challenge", "holdout", "frozen_blind_holdout", "blind_holdout"].includes(entry.split ?? entry.assignment))) {
    throw new Error("A manifest containing protected evaluation splits requires an explicit non-protected calibration split. This tool does not open challenge or blind holdout data.");
  }
  const metadata = acquisitionEntries.length ? {
    replays: Object.fromEntries(acquisitionEntries.filter((entry) => entry.sha256).map((entry) => [entry.sha256, {
      mode: entry.mode,
      rank: entry.rank ?? entry.trustworthyRankCohort ?? entry.rankFilter,
      assignment: entry.split ?? entry.assignment,
      source: entry.source,
      subjectFingerprint: entry.subjectFingerprint,
      privacySalt: sourceMetadata.privacySalt,
    }]))
  } : sourceMetadata;
  const insideTarget = (file) => resolvedTargets.some((target) => {
    if (file === target) return true;
    const child = relative(target, file);
    return child && child !== ".." && !child.startsWith(`..${sep}`) && !child.startsWith(sep);
  });
  const manifestFiles = split && acquisitionEntries.length
    ? acquisitionEntries.filter((entry) => (entry.split ?? entry.assignment) === split).map((entry) => ({
      file: resolve(String(entry.storagePath ?? "")),
      expectedHash: String(entry.sha256 ?? "").toLowerCase(),
    }))
    : null;
  if (manifestFiles && (!manifestFiles.length || manifestFiles.some((entry) => !entry.expectedHash || !entry.file || !insideTarget(entry.file)))) {
    throw new Error("Split calibration requires hash-identified manifest storage paths inside the explicit target.");
  }
  const unique = new Map();
  const selectedFiles = manifestFiles ?? resolvedTargets.flatMap((target) => replayFiles(target).map((file) => ({ file, expectedHash: null })));
  const belongsToShard = (hash) => !shardConfigured
    || Number.parseInt(String(hash).slice(0, 12), 16) % shardCount === shardIndex;
  for (const { file, expectedHash } of selectedFiles) {
      if (expectedHash && !belongsToShard(expectedHash)) continue;
      const bytes = readFileSync(file);
      const hash = createHash("sha256").update(bytes).digest("hex");
      if (expectedHash && hash !== expectedHash) throw new Error(`Manifest SHA-256 mismatch for ${basename(file)}.`);
      if (!belongsToShard(hash)) continue;
      const declared = metadata.replays?.[hash] ?? metadata.replays?.[hash.slice(0, 16)] ?? {};
      if (split && declared.assignment !== split) continue;
      if (!unique.has(hash)) unique.set(hash, { file, bytes: new Uint8Array(bytes), hash });
  }

  const entries = [];
  const failures = [];
  for (const { file, bytes, hash } of unique.values()) {
    try {
      console.error(`Calibrating ${basename(file)}…`);
      const startedAt = performance.now();
      const rssBeforeBytes = process.memoryUsage().rss;
      const roster = inspectReplayRoster(bytes);
      const declared = metadata.replays?.[hash] ?? metadata.replays?.[hash.slice(0, 16)] ?? {};
      const declaredPlayerName = String(declared.playerName ?? "").trim().toLowerCase();
      const subject = declared.subjectFingerprint && declared.privacySalt
        ? roster.players.find((player) => createHash("sha256").update(`${declared.privacySalt}:${player.id}`).digest("hex").slice(0, 20) === declared.subjectFingerprint)
        : declaredPlayerName
          ? roster.players.find((player) => player.name.trim().toLowerCase() === declaredPlayerName)
        : roster.players[0];
      if ((declaredPlayerName || declared.subjectFingerprint) && !subject) {
        const error = new Error("Declared calibration player was not found in the replay roster.");
        error.code = "subject_player_not_found";
        throw error;
      }
      if (!subject) throw new Error("Replay contained no attributable player.");
      const evidence = buildReplayEvidence(bytes, subject.id || subject.name, "");
      const shadow = runShadowDetectors(evidence);
      const runtimeMs = performance.now() - startedAt;
      const rssAfterBytes = process.memoryUsage().rss;
      const parsedMode = normalizeMode(evidence.normalized.mode);
      const declaredMode = normalizeMode(declared.mode);
      const mode = parsedMode;
      const rankCohort = normalizeRankCohort(declared.rank ?? declared.rankCohort);
      entries.push({
        replayFingerprint: hash.slice(0, 16),
        evidenceSource: "real_replay",
        versions: { parser: PARSER_VERSION, normalizer: NORMALIZER_VERSION, shadowRuntime: SHADOW_RUNTIME_VERSION },
        mode,
        declaredMode,
        parsedMode,
        modeMatchesManifest: declaredMode === "unknown" ? null : parsedMode === declaredMode,
        attributionState: "verified",
        subjectRosterIndex: roster.players.indexOf(subject),
        rankCohort,
        cohortKey: cohortKey({ mode, rankCohort }),
        metadataProvenance: declared.playerName || declared.subjectFingerprint || declared.rank || declared.rankCohort || declared.mode ? "private-corpus-manifest" : "replay-only",
        corpusAssignment: declared.assignment ?? null,
        gameVersion: evidence.normalized.gameVersion ?? null,
        playerCount: evidence.frameState.summary.playerCount,
        sampledFrames: evidence.frameState.summary.frameCount,
        frameCoverage: evidence.frameState.summary.coverage,
        parserEvents: evidence.episodeTimeline.summary.rawEventCount,
        decisionEvents: evidence.episodeTimeline.summary.decisionEventCount,
        operational: {
          runtimeMs,
          rssBeforeBytes,
          rssAfterBytes,
          rssDeltaBytes: rssAfterBytes - rssBeforeBytes,
        },
        shadowRuns: shadow.runs.map((run) => ({
          detectorId: run.detectorId,
          detectorVersion: run.detectorVersion,
          status: run.status,
          candidateCount: run.candidateCount,
          measurements: run.measurements,
          evidence: run.evidence,
        })),
        opportunityContracts: shadow.runs.filter((run) => run.opportunityContract).map((run) => ({
          schemaVersion: run.opportunityContract.schemaVersion,
          contextVersion: run.opportunityContract.contextVersion,
          detectorId: run.opportunityContract.detectorId,
          detectorVersion: run.opportunityContract.detectorVersion,
          opportunityType: run.opportunityContract.opportunityType,
          summary: run.opportunityContract.summary,
          evaluations: run.opportunityContract.evaluations.map((evaluation) => ({
            opportunityId: evaluation.opportunityId,
            timestampSeconds: evaluation.timestampSeconds,
            frame: evaluation.frame,
            status: evaluation.status,
            classification: evaluation.classification,
            contextKey: evaluation.contextKey,
            context: evaluation.context,
            reasons: evaluation.reasons ?? [],
            evidence: evaluation.evidence ?? {},
          })),
        })),
      });
    } catch (error) {
      failures.push({
        replayFingerprint: hash.slice(0, 16),
        code: error?.code ?? "calibration_failure",
        message: error instanceof Error ? error.message : "Unknown calibration failure",
      });
    }
  }

  const aggregated = aggregateCalibrationRuns(entries, failures);
  const unsignedReport = shardConfigured ? {
    ...aggregated,
    shard: {
      method: "sha256-prefix-modulo-v1",
      index: shardIndex,
      count: shardCount,
      split: split ?? null,
      replayCount: entries.length,
    },
  } : aggregated;
  const report = { ...unsignedReport, reproducibilityFingerprint: calibrationFingerprint(unsignedReport) };
  const json = `${JSON.stringify(report)}\n`;
  if (output) {
    const destination = resolve(output);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, json, { mode: 0o600 });
    chmodSync(destination, 0o600);
    console.error(`Wrote ${destination}`);
  } else {
    process.stdout.write(json);
  }
  if (!entries.length) process.exitCode = 2;
}
