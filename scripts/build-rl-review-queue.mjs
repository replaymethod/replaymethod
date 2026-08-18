#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { buildReviewQueue } from "../services/rl-engine/calibration.mjs";

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("Usage: node scripts/build-rl-review-queue.mjs <calibration-report.json> <review-queue.json>");
  process.exitCode = 1;
} else {
  const report = JSON.parse(readFileSync(resolve(input), "utf8"));
  const queue = buildReviewQueue(report);
  const destination = resolve(output);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, `${JSON.stringify(queue, null, 2)}\n`);
  console.error(`Wrote ${queue.candidates.length} review candidates to ${destination}`);
}
