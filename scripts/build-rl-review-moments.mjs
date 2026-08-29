#!/usr/bin/env node
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { buildReplayEvidence, inspectReplayRoster } from "../services/rl-engine/parser.mjs";
import { containsSensitiveIdentifier } from "../services/rl-engine/review-privacy.mjs";

const WINDOW_BEFORE_SECONDS = 4;
const WINDOW_AFTER_SECONDS = 4;
const DETAIL_BEFORE_SECONDS = 1;
const DETAIL_AFTER_SECONDS = 2;

function replayFiles(target) {
  if (!existsSync(target)) return [];
  if (statSync(target).isFile()) return target.endsWith(".replay") ? [target] : [];
  return readdirSync(target, { withFileTypes: true }).flatMap((entry) => {
    const child = resolve(target, entry.name);
    return entry.isDirectory() ? replayFiles(child) : (entry.name.endsWith(".replay") ? [child] : []);
  });
}

function round(value, precision = 1) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function compactVector(vector) {
  return [round(vector?.x), round(vector?.y), round(vector?.z)];
}

function compactFrame(frame, center) {
  return {
    t: round(frame.timeSeconds - center, 3),
    r: round(frame.secondsRemaining, 1),
    b: compactVector(frame.ball.position),
    p: frame.players.map((player) => [
      ...compactVector(player.position),
      round(player.boost, 1),
      round(player.linearVelocity?.x),
      round(player.linearVelocity?.y),
      ...compactVector(player.rotation),
    ]),
  };
}

function momentForCandidate(candidate, evidence) {
  const center = candidate.timestampSeconds;
  if (!Number.isFinite(center)) return null;
  const sourceRate = evidence.frameState.sampleRateHz || 10;
  const sourceFrames = evidence.frameState.frames.filter((frame) => (
    frame.timeSeconds >= center - WINDOW_BEFORE_SECONDS
    && frame.timeSeconds <= center + WINDOW_AFTER_SECONDS
  ));
  if (!sourceFrames.length) return null;

  const subjectId = String(evidence.normalized.subjectPlayerId ?? "").toLowerCase();
  const roster = evidence.frameState.players.map((player, index) => ({
    id: `P${index + 1}`,
    team: player.team,
    subject: player.id.toLowerCase() === subjectId,
  }));

  const frames = sourceFrames.map((frame) => compactFrame(frame, center));
  const detailSourceFrames = (evidence.adaptiveSampling?.detailFrames ?? []).filter((frame) => (
    frame.timeSeconds >= center - DETAIL_BEFORE_SECONDS
    && frame.timeSeconds <= center + DETAIL_AFTER_SECONDS
  ));
  const detailFrames = detailSourceFrames.map((frame) => compactFrame(frame, center));

  return {
    candidateKey: candidate.id,
    replayFingerprint: candidate.replayFingerprint,
    detectorId: candidate.detectorId,
    centerTimeSeconds: round(center, 3),
    durationSeconds: round(frames.at(-1).t - frames[0].t, 2),
    sampleRateHz: sourceRate,
    detailSampleRateHz: detailFrames.length ? evidence.adaptiveSampling?.detailSampleRateHz ?? null : null,
    roster,
    frames,
    detailFrames,
  };
}

const args = process.argv.slice(2);
const outputIndex = args.indexOf("--output");
const queueIndex = args.indexOf("--queue");
const metadataIndex = args.indexOf("--metadata");
const splitIndex = args.indexOf("--split");
const output = outputIndex >= 0 ? args[outputIndex + 1] : "docs/RL_REVIEW_MOMENTS.json";
const queuePath = queueIndex >= 0 ? args[queueIndex + 1] : "docs/RL_REVIEW_QUEUE.json";
const metadataPath = metadataIndex >= 0 ? args[metadataIndex + 1] : null;
const split = splitIndex >= 0 ? args[splitIndex + 1] : null;
const optionIndexes = [outputIndex, queueIndex, metadataIndex, splitIndex]
  .filter((index) => index >= 0)
  .flatMap((index) => [index, index + 1]);
const targets = args.filter((_, index) => !optionIndexes.includes(index));

if (!targets.length) {
  console.error("Usage: node scripts/build-rl-review-moments.mjs <replay-directory> [...] [--queue queue.json] [--metadata manifest.json --split calibration_dev] [--output moments.json]");
  process.exitCode = 1;
} else {
  const queue = JSON.parse(readFileSync(resolve(queuePath), "utf8"));
  if (split && (!metadataPath || split !== "calibration_dev" || queue.sourceCorpusAssignment !== split || queue.holdoutIncluded !== false)) {
    throw new Error("Split-safe moment generation requires a calibration_dev queue, holdoutIncluded=false and its private manifest.");
  }
  const candidatesByReplay = Map.groupBy(queue.candidates ?? [], (candidate) => candidate.replayFingerprint);
  const uniqueFiles = new Map();
  const resolvedTargets = targets.map((target) => resolve(target));
  const insideTarget = (file) => resolvedTargets.some((target) => {
    if (file === target) return true;
    const child = relative(target, file);
    return child && child !== ".." && !child.startsWith(`..${sep}`) && !child.startsWith(sep);
  });
  const manifest = metadataPath ? JSON.parse(readFileSync(resolve(metadataPath), "utf8")) : null;
  const manifestRows = Array.isArray(manifest?.approved) ? manifest.approved : Array.isArray(manifest?.replays) ? manifest.replays : [];
  const selectedManifestFiles = split ? manifestRows.filter((row) => (
    (row.split ?? row.assignment) === split
    && candidatesByReplay.has(String(row.sha256 ?? "").slice(0, 16))
  )).map((row) => ({ file: resolve(String(row.storagePath ?? "")), expectedHash: String(row.sha256 ?? "").toLowerCase() })) : null;
  if (selectedManifestFiles && (selectedManifestFiles.length !== candidatesByReplay.size
    || selectedManifestFiles.some((row) => !row.expectedHash || !insideTarget(row.file)))) {
    throw new Error("Every queued replay must resolve to one hash-identified calibration_dev manifest path inside the explicit target.");
  }
  const selectedFiles = selectedManifestFiles ?? resolvedTargets.flatMap((target) => replayFiles(target).map((file) => ({ file, expectedHash: null })));
  for (const { file, expectedHash } of selectedFiles) {
      const bytes = readFileSync(file);
      const hash = createHash("sha256").update(bytes).digest("hex");
      if (expectedHash && hash !== expectedHash) throw new Error(`Manifest SHA-256 mismatch for ${file}.`);
      uniqueFiles.set(hash.slice(0, 16), { file, bytes: new Uint8Array(bytes) });
  }

  const moments = {};
  const sensitiveValues = new Set();
  const missingReplays = [];
  for (const [fingerprint, candidates] of candidatesByReplay) {
    const replay = uniqueFiles.get(fingerprint);
    if (!replay) {
      missingReplays.push(fingerprint);
      continue;
    }
    const roster = inspectReplayRoster(replay.bytes);
    for (const player of roster.players) {
      if (player.name) sensitiveValues.add(player.name);
      if (player.id) sensitiveValues.add(player.id);
    }
    const rosterIndexes = new Set(candidates.map((candidate) => candidate.subjectRosterIndex).filter(Number.isInteger));
    if (rosterIndexes.size > 1) throw new Error(`Replay ${fingerprint} has inconsistent subject roster indexes.`);
    const subjectIndex = rosterIndexes.size === 1 ? [...rosterIndexes][0] : 0;
    const subject = roster.players[subjectIndex];
    if (!subject) throw new Error(`Replay ${fingerprint} has no attributable player.`);
    const evidence = buildReplayEvidence(replay.bytes, subject.id || subject.name, "");
    for (const candidate of candidates) {
      const moment = momentForCandidate(candidate, evidence);
      if (moment) moments[candidate.id] = moment;
    }
  }

  const artifact = {
    schemaVersion: "rocket-league-review-moments.v3",
    sourceQueueVersion: queue.schemaVersion ?? null,
    generatedAt: new Date().toISOString(),
    privacy: "Player names and platform identifiers removed; coordinates rounded; owner-only review use.",
    presentationTelemetry: {
      ballPosition: true,
      carPosition: true,
      carVelocity: true,
      carRotation: true,
      boost: true,
      contextRateHz: 10,
      adaptiveDetailRateHz: 30,
    },
    windowSeconds: { before: WINDOW_BEFORE_SECONDS, after: WINDOW_AFTER_SECONDS },
    replayCount: new Set(Object.values(moments).map((moment) => moment.replayFingerprint)).size,
    candidateCount: Object.keys(moments).length,
    missingCandidateCount: (queue.candidates?.length ?? 0) - Object.keys(moments).length,
    missingReplays,
    moments,
  };

  if (containsSensitiveIdentifier(artifact, sensitiveValues)) {
    throw new Error("Privacy check failed: a source player identifier remained in the artifact.");
  }
  const json = `${JSON.stringify(artifact)}\n`;
  const destination = resolve(output);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, json);
  chmodSync(destination, 0o600);
  console.error(`Wrote ${artifact.candidateCount} private review moments from ${artifact.replayCount} replays to ${destination}`);
  if (missingReplays.length || artifact.missingCandidateCount) process.exitCode = 2;
}
