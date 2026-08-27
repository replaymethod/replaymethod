#!/usr/bin/env node
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { mergeBlindReviewerSubmissions } from "../services/rl-engine/calibration.mjs";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

const queuePath = argument("--queue");
const outputPath = argument("--output");
const submissionPaths = process.argv.flatMap((value, index, values) => (
  value === "--submission" && values[index + 1] ? [values[index + 1]] : []
));
if (!queuePath || !outputPath || submissionPaths.length < 2) {
  console.error("Usage: node scripts/merge-rl-blind-reviews.mjs --queue master-queue.json --submission reviewer-a.json --submission reviewer-b.json --output merged-private.json");
  process.exit(1);
}

const readJson = (path) => JSON.parse(readFileSync(resolve(path), "utf8"));
const result = mergeBlindReviewerSubmissions(readJson(queuePath), submissionPaths.map(readJson));
const destination = resolve(outputPath);
writeFileSync(destination, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
chmodSync(destination, 0o600);
console.error(`Merged ${result.independentDecisionCount} independent decisions: ${result.resolvedConsensusCount} consensus, ${result.unresolvedAdjudicationCount} awaiting adjudication.`);
