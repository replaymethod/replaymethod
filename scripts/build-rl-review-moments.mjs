#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { buildReplayEvidence, inspectReplayRoster } from "../services/rl-engine/parser.mjs";

const WINDOW_BEFORE_SECONDS = 4;
const WINDOW_AFTER_SECONDS = 4;
const OUTPUT_SAMPLE_RATE_HZ = 5;

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

function momentForCandidate(candidate, evidence) {
  const center = candidate.timestampSeconds;
  if (!Number.isFinite(center)) return null;
  const sourceRate = evidence.frameState.sampleRateHz || 10;
  const stride = Math.max(1, Math.round(sourceRate / OUTPUT_SAMPLE_RATE_HZ));
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

  const frames = sourceFrames.filter((_, index) => index % stride === 0).map((frame) => ({
    t: round(frame.timeSeconds - center, 2),
    r: round(frame.secondsRemaining, 1),
    b: compactVector(frame.ball.position),
    p: frame.players.map((player) => [
      ...compactVector(player.position),
      round(player.boost, 1),
      round(player.linearVelocity?.x),
      round(player.linearVelocity?.y),
    ]),
  }));

  return {
    candidateKey: candidate.id,
    replayFingerprint: candidate.replayFingerprint,
    detectorId: candidate.detectorId,
    centerTimeSeconds: round(center, 3),
    durationSeconds: round(frames.at(-1).t - frames[0].t, 2),
    sampleRateHz: OUTPUT_SAMPLE_RATE_HZ,
    roster,
    frames,
  };
}

const args = process.argv.slice(2);
const outputIndex = args.indexOf("--output");
const queueIndex = args.indexOf("--queue");
const output = outputIndex >= 0 ? args[outputIndex + 1] : "docs/RL_REVIEW_MOMENTS.json";
const queuePath = queueIndex >= 0 ? args[queueIndex + 1] : "docs/RL_REVIEW_QUEUE.json";
const optionIndexes = [outputIndex, queueIndex]
  .filter((index) => index >= 0)
  .flatMap((index) => [index, index + 1]);
const targets = args.filter((_, index) => !optionIndexes.includes(index));

if (!targets.length) {
  console.error("Usage: node scripts/build-rl-review-moments.mjs <replay-directory> [...] [--queue queue.json] [--output moments.json]");
  process.exitCode = 1;
} else {
  const queue = JSON.parse(readFileSync(resolve(queuePath), "utf8"));
  const candidatesByReplay = Map.groupBy(queue.candidates ?? [], (candidate) => candidate.replayFingerprint);
  const uniqueFiles = new Map();
  for (const target of targets) {
    for (const file of replayFiles(resolve(target))) {
      const bytes = readFileSync(file);
      const hash = createHash("sha256").update(bytes).digest("hex");
      uniqueFiles.set(hash.slice(0, 16), { file, bytes: new Uint8Array(bytes) });
    }
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
    const subject = roster.players[0];
    if (!subject) throw new Error(`Replay ${fingerprint} has no attributable player.`);
    const evidence = buildReplayEvidence(replay.bytes, subject.name, "");
    for (const candidate of candidates) {
      const moment = momentForCandidate(candidate, evidence);
      if (moment) moments[candidate.id] = moment;
    }
  }

  const artifact = {
    schemaVersion: "rocket-league-review-moments.v2",
    sourceQueueVersion: queue.schemaVersion ?? null,
    generatedAt: new Date().toISOString(),
    privacy: "Player names and platform identifiers removed; coordinates rounded; owner-only review use.",
    windowSeconds: { before: WINDOW_BEFORE_SECONDS, after: WINDOW_AFTER_SECONDS },
    replayCount: new Set(Object.values(moments).map((moment) => moment.replayFingerprint)).size,
    candidateCount: Object.keys(moments).length,
    missingCandidateCount: (queue.candidates?.length ?? 0) - Object.keys(moments).length,
    missingReplays,
    moments,
  };

  const json = `${JSON.stringify(artifact)}\n`;
  const leakedValue = [...sensitiveValues].find((value) => value.length >= 3 && json.toLowerCase().includes(value.toLowerCase()));
  if (leakedValue) throw new Error("Privacy check failed: a source player identifier remained in the artifact.");
  const destination = resolve(output);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, json);
  console.error(`Wrote ${artifact.candidateCount} private review moments from ${artifact.replayCount} replays to ${destination}`);
  if (missingReplays.length || artifact.missingCandidateCount) process.exitCode = 2;
}
