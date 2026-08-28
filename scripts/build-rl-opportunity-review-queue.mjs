#!/usr/bin/env node
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { buildOpportunityReviewQueue } from "../services/rl-engine/calibration.mjs";
import { ROCKET_LEAGUE_DETECTOR_CATALOG } from "../services/rl-engine/detector-catalog.mjs";

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function argumentsFor(name) {
  return process.argv.flatMap((value, index) => value === name ? [process.argv[index + 1]] : []).filter(Boolean);
}

const reportPath = argument("--report", null);
const outputPath = argument("--output", null);
const perStatus = Number(argument("--per-status", "40"));
const maxPerReplay = Number(argument("--max-per-replay", "2"));
const allCatalog = process.argv.includes("--all-catalog");
const requestedDetectorIds = argumentsFor("--detector");
const detectorIds = allCatalog ? ROCKET_LEAGUE_DETECTOR_CATALOG.map((detector) => detector.id) : requestedDetectorIds;
const labelSetVersion = argument("--label-set", "rocket-league-expert-labels.v4-opportunity");
if (!reportPath || !outputPath || !Number.isInteger(perStatus) || perStatus < 1 || !Number.isInteger(maxPerReplay) || maxPerReplay < 1) {
  console.error("Usage: node scripts/build-rl-opportunity-review-queue.mjs --report calibration.json --output review-queue.json [--all-catalog | --detector id ...] [--label-set version] [--per-status 40] [--max-per-replay 2]");
  process.exit(1);
}

const report = JSON.parse(readFileSync(resolve(reportPath), "utf8"));
const queue = buildOpportunityReviewQueue(report, {
  ...(detectorIds.length ? { detectorIds } : {}),
  perStatus,
  maxPerReplay,
  labelSetVersion,
});
const destination = resolve(outputPath);
mkdirSync(dirname(destination), { recursive: true });
writeFileSync(destination, `${JSON.stringify(queue, null, 2)}\n`, { mode: 0o600 });
chmodSync(destination, 0o600);
console.error(`Wrote ${queue.candidates.length} blind opportunity reviews to ${destination}.`);
