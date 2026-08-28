#!/usr/bin/env node
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { summarizeCalibrationShards } from "../services/rl-engine/calibration-shards.mjs";

const args = process.argv.slice(2);
const outputIndex = args.indexOf("--output");
const expectedReplayIndex = args.indexOf("--expected-replays");
const expectedDetectorIndex = args.indexOf("--expected-detectors");
const corpusManifestIndex = args.indexOf("--corpus-manifest");
const output = outputIndex >= 0 ? args[outputIndex + 1] : null;
const expectedReplayCount = expectedReplayIndex >= 0 ? Number(args[expectedReplayIndex + 1]) : null;
const expectedDetectorCount = expectedDetectorIndex >= 0 ? Number(args[expectedDetectorIndex + 1]) : null;
const corpusManifestPath = corpusManifestIndex >= 0 ? args[corpusManifestIndex + 1] : null;
const optionIndexes = [outputIndex, expectedReplayIndex, expectedDetectorIndex, corpusManifestIndex].filter((index) => index >= 0)
  .flatMap((index) => [index, index + 1]);
const inputs = args.filter((_, index) => !optionIndexes.includes(index));
if (!output || !inputs.length
  || (expectedReplayIndex >= 0 && (!Number.isInteger(expectedReplayCount) || expectedReplayCount < 1))
  || (expectedDetectorIndex >= 0 && (!Number.isInteger(expectedDetectorCount) || expectedDetectorCount < 1))) {
  console.error("Usage: node scripts/summarize-rl-calibration-shards.mjs shard-0.json [...] --output manifest.json [--corpus-manifest private-manifest.json] [--expected-replays 700] [--expected-detectors 60]");
  process.exitCode = 1;
} else {
  const paths = inputs.map((input) => resolve(input));
  const reports = paths.map((path) => JSON.parse(readFileSync(path, "utf8")));
  const corpusManifest = corpusManifestPath ? JSON.parse(readFileSync(resolve(corpusManifestPath), "utf8")) : null;
  const sourceRows = Array.isArray(corpusManifest?.approved)
    ? corpusManifest.approved : Array.isArray(corpusManifest?.replays) ? corpusManifest.replays : [];
  const split = reports[0]?.shard?.split;
  const corpusRows = corpusManifest ? sourceRows.filter((row) => (row.split ?? row.assignment) === split) : null;
  const manifest = summarizeCalibrationShards(reports, {
    sourceFiles: paths.map((path) => basename(path)), expectedReplayCount, expectedDetectorCount, corpusRows,
    sourceManifestSchemaVersion: corpusManifest?.schemaVersion ?? null,
    sourceManifestPlanVersion: corpusManifest?.planVersion ?? null,
  });
  const destination = resolve(output);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  chmodSync(destination, 0o600);
  console.error(`Wrote ${destination}`);
  console.log(JSON.stringify({
    replayCount: manifest.corpus.replayCount,
    detectorCount: manifest.detectors.length,
    integrityPassed: manifest.conclusions.integrityPassed,
    reproducibilityFingerprint: manifest.reproducibilityFingerprint,
  }));
}
