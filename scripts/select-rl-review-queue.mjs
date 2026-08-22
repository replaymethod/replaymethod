#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { buildReviewQueue } from "../services/rl-engine/calibration.mjs";

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function numericSignal(candidate) {
  const observation = candidate.observation ?? {};
  const preferred = [
    observation.timeToBallSeconds,
    observation.durationSeconds,
    observation.boostSpent,
    observation.minimumSpeed,
    observation.meanDistanceToBall,
  ].find(Number.isFinite);
  return Number.isFinite(preferred) ? Number(preferred) : candidate.timestampSeconds ?? 0;
}

function alternatingExtremes(candidates) {
  const sorted = [...candidates].sort((left, right) => numericSignal(left) - numericSignal(right));
  const selected = [];
  let low = 0;
  let high = sorted.length - 1;
  while (low <= high) {
    selected.push(sorted[high--]);
    if (low <= high) selected.push(sorted[low++]);
  }
  return selected;
}

function diverseSample(candidates, target) {
  const replayCounts = new Map();
  const selected = [];
  for (const candidate of alternatingExtremes(candidates)) {
    if (selected.length >= target) break;
    const count = replayCounts.get(candidate.replayFingerprint) ?? 0;
    if (count >= 4) continue;
    replayCounts.set(candidate.replayFingerprint, count + 1);
    selected.push(candidate);
  }
  return selected;
}

const reportPath = argument("--report", null);
const outputPath = argument("--output", null);
const detectorId = argument("--detector", "kickoff.speed");
const perCohort = Number(argument("--per-cohort", "12"));
if (!reportPath || !outputPath || !Number.isInteger(perCohort) || perCohort < 5 || perCohort > 50) {
  console.error("Usage: node scripts/select-rl-review-queue.mjs --report calibration.json --output review-queue.json [--detector kickoff.speed] [--per-cohort 12]");
  process.exit(1);
}

const report = JSON.parse(readFileSync(resolve(reportPath), "utf8"));
const complete = buildReviewQueue(report);
const detectorCandidates = complete.candidates.filter((candidate) => candidate.detectorId === detectorId);
const groups = Map.groupBy(detectorCandidates, (candidate) => candidate.cohortKey ?? "unknown:unranked-unknown");
const candidates = [...groups.entries()].flatMap(([, rows]) => diverseSample(rows, perCohort));
const queue = {
  ...complete,
  generatedAt: new Date().toISOString(),
  labelSetVersion: "rocket-league-expert-labels.v2",
  sourceCorpusAssignment: "calibration",
  holdoutIncluded: false,
  selection: {
    detectorId,
    strategy: "Alternating numeric extremes with at most four moments per replay in each mode/rank cohort.",
    requestedPerCohort: perCohort,
    availableCandidates: detectorCandidates.length,
    selectedCandidates: candidates.length,
    cohortCounts: Object.fromEntries([...Map.groupBy(candidates, (candidate) => candidate.cohortKey).entries()].map(([key, rows]) => [key, rows.length])),
  },
  candidates,
};
mkdirSync(dirname(resolve(outputPath)), { recursive: true });
writeFileSync(resolve(outputPath), `${JSON.stringify(queue, null, 2)}\n`, { mode: 0o600 });
console.error(`Selected ${candidates.length} private ${detectorId} review moments across ${groups.size} calibration cohorts.`);
if (candidates.length < Math.min(perCohort * groups.size, 60)) process.exitCode = 2;
