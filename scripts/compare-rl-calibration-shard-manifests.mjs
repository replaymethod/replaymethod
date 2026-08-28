#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { compareCalibrationShardManifests } from "../services/rl-engine/calibration-shards.mjs";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const leftPath = argument("--left");
const rightPath = argument("--right");
if (!leftPath || !rightPath) {
  console.error("Usage: node scripts/compare-rl-calibration-shard-manifests.mjs --left run-a.json --right run-b.json");
  process.exitCode = 1;
} else {
  const left = JSON.parse(readFileSync(resolve(leftPath), "utf8"));
  const right = JSON.parse(readFileSync(resolve(rightPath), "utf8"));
  const comparison = compareCalibrationShardManifests(left, right);
  console.log(JSON.stringify(comparison));
  if (!comparison.reproducible || !comparison.sameCorpusCount || !comparison.sameDetectorSummary) process.exitCode = 2;
}
