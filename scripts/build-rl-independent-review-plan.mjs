#!/usr/bin/env node
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { buildIndependentReviewPlan } from "../services/rl-engine/calibration.mjs";
import { combineLabelManuals } from "../services/rl-engine/label-manual.mjs";

function argument(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function argumentsFor(name) {
  return process.argv.flatMap((value, index) => value === name ? [process.argv[index + 1]] : []).filter(Boolean);
}

const queuePath = argument("--queue");
const outputPath = argument("--output");
const labelManualPaths = argumentsFor("--label-manual");
const rounds = Number(argument("--rounds", "4"));
if (!queuePath || !outputPath || !labelManualPaths.length || !Number.isInteger(rounds) || rounds < 1) {
  console.error("Usage: node scripts/build-rl-independent-review-plan.mjs --queue review-queue.json --label-manual handbook-base.md [--label-manual handbook-extension.md ...] --output review-plan.json [--rounds 4]");
  process.exit(1);
}

const queue = JSON.parse(readFileSync(resolve(queuePath), "utf8"));
const labelManual = combineLabelManuals(labelManualPaths.map((path) => readFileSync(resolve(path), "utf8")));
const plan = {
  ...buildIndependentReviewPlan(queue, { rounds, labelManualFingerprint: labelManual.fingerprint }),
  labelManualPartFingerprints: labelManual.partFingerprints,
};
const destination = resolve(outputPath);
mkdirSync(dirname(destination), { recursive: true });
writeFileSync(destination, `${JSON.stringify(plan, null, 2)}\n`, { mode: 0o600 });
chmodSync(destination, 0o600);
console.error(`Wrote ${plan.reviewerCount} blind reviewer assignments covering ${plan.candidatesPerReviewer} candidates each to ${destination}.`);
