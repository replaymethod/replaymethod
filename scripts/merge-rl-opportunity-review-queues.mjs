#!/usr/bin/env node
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { mergeOpportunityReviewQueues } from "../services/rl-engine/calibration.mjs";

function argument(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function argumentsFor(name) {
  return process.argv.flatMap((value, index) => value === name ? [process.argv[index + 1]] : []).filter(Boolean);
}

const manifestPath = argument("--manifest");
const outputPath = argument("--output");
const queuePaths = argumentsFor("--queue");
const perStatus = Number(argument("--per-status", "40"));
const maxPerReplay = Number(argument("--max-per-replay", "2"));
if (!manifestPath || !outputPath || !queuePaths.length || !Number.isInteger(perStatus) || perStatus < 1
  || !Number.isInteger(maxPerReplay) || maxPerReplay < 1) {
  console.error("Usage: node scripts/merge-rl-opportunity-review-queues.mjs --manifest shard-manifest.json --queue shard-0-queue.json [...] --output queue.json [--per-status 40] [--max-per-replay 2]");
  process.exitCode = 1;
} else {
  const manifest = JSON.parse(readFileSync(resolve(manifestPath), "utf8"));
  const queues = queuePaths.map((path) => JSON.parse(readFileSync(resolve(path), "utf8")));
  const queue = mergeOpportunityReviewQueues(queues, {
    sourceReportFingerprint: manifest.reproducibilityFingerprint,
    sourceShardFingerprints: (manifest.shardFingerprints ?? []).map((shard) => shard.reproducibilityFingerprint),
    perStatus,
    maxPerReplay,
  });
  const destination = resolve(outputPath);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, `${JSON.stringify(queue)}\n`, { mode: 0o600 });
  chmodSync(destination, 0o600);
  console.error(`Wrote ${queue.candidates.length} globally balanced blind reviews to ${destination}.`);
}
