#!/usr/bin/env node
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildReviewWorkSession } from "../services/rl-engine/calibration.mjs";

function argument(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

const queuePath = argument("--queue");
const momentsPath = argument("--moments");
const outputDirectory = argument("--output-dir");
const perDetector = Number(argument("--per-detector", "8"));
const rareFiringThreshold = Number(argument("--rare-firing-threshold", "12"));
const labelSetVersion = argument("--label-set", "rocket-league-expert-labels.v11-all-60-context-0.9");
if (!queuePath || !momentsPath || !outputDirectory || !Number.isInteger(perDetector)
  || !Number.isInteger(rareFiringThreshold)) {
  console.error("Usage: node scripts/build-rl-review-work-session.mjs --queue full-queue.json --moments full-moments.json --output-dir review-day-1 [--per-detector 8] [--rare-firing-threshold 12] [--label-set version]");
  process.exit(1);
}

const queue = JSON.parse(readFileSync(resolve(queuePath), "utf8"));
const moments = JSON.parse(readFileSync(resolve(momentsPath), "utf8"));
const workSession = buildReviewWorkSession(queue, moments, { perDetector, rareFiringThreshold, labelSetVersion });
const destination = resolve(outputDirectory);
mkdirSync(destination, { recursive: true, mode: 0o700 });
for (const [name, value] of [["opportunity-review-queue.json", workSession.queue], ["opportunity-review-moments.json", workSession.moments]]) {
  const path = join(destination, name);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  chmodSync(path, 0o600);
}
console.error(`Wrote a private ${workSession.queue.candidates.length}-candidate review work session across ${workSession.queue.selection.detectorCount} detectors to ${destination}.`);
