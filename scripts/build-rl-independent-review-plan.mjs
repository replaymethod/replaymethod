#!/usr/bin/env node
import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { buildIndependentReviewPlan } from "../services/rl-engine/calibration.mjs";

function argument(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

const queuePath = argument("--queue");
const outputPath = argument("--output");
const labelManualPath = argument("--label-manual");
const rounds = Number(argument("--rounds", "4"));
if (!queuePath || !outputPath || !labelManualPath || !Number.isInteger(rounds) || rounds < 1) {
  console.error("Usage: node scripts/build-rl-independent-review-plan.mjs --queue review-queue.json --label-manual label-handbook.md --output review-plan.json [--rounds 4]");
  process.exit(1);
}

const queue = JSON.parse(readFileSync(resolve(queuePath), "utf8"));
const labelManualFingerprint = createHash("sha256").update(readFileSync(resolve(labelManualPath))).digest("hex");
const plan = buildIndependentReviewPlan(queue, { rounds, labelManualFingerprint });
const destination = resolve(outputPath);
mkdirSync(dirname(destination), { recursive: true });
writeFileSync(destination, `${JSON.stringify(plan, null, 2)}\n`, { mode: 0o600 });
chmodSync(destination, 0o600);
console.error(`Wrote ${plan.reviewerCount} blind reviewer assignments covering ${plan.candidatesPerReviewer} candidates each to ${destination}.`);
