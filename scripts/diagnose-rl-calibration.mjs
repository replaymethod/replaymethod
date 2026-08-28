#!/usr/bin/env node
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { diagnoseCalibrationShardManifest } from "../services/rl-engine/calibration-diagnostics.mjs";

function argument(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

const manifestPath = argument("--manifest");
const outputPath = argument("--output");
const minimumOpportunities = Number(argument("--minimum-opportunities", "30"));
if (!manifestPath || !outputPath || !Number.isInteger(minimumOpportunities) || minimumOpportunities < 1) {
  console.error("Usage: node scripts/diagnose-rl-calibration.mjs --manifest shard-manifest.json --output diagnostics.json [--minimum-opportunities 30]");
  process.exitCode = 1;
} else {
  const manifest = JSON.parse(readFileSync(resolve(manifestPath), "utf8"));
  const diagnostics = diagnoseCalibrationShardManifest(manifest, { minimumOpportunities });
  const destination = resolve(outputPath);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, `${JSON.stringify(diagnostics, null, 2)}\n`, { mode: 0o600 });
  chmodSync(destination, 0o600);
  console.error(`Wrote calibration diagnostics for ${diagnostics.summary.detectorCount} detectors to ${destination}.`);
  console.log(JSON.stringify(diagnostics.summary));
}
