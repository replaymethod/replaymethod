#!/usr/bin/env node
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { finalizeBlindReviewAdjudication } from "../services/rl-engine/calibration.mjs";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

const queuePath = argument("--queue");
const mergePath = argument("--merge");
const adjudicationPath = argument("--adjudication");
const outputPath = argument("--output");
if (!queuePath || !mergePath || !adjudicationPath || !outputPath) {
  console.error("Usage: node scripts/finalize-rl-blind-adjudication.mjs --queue master-queue.json --merge merged-private.json --adjudication completed-adjudication.json --output final-calibration.json");
  process.exit(1);
}

const readJson = (path) => JSON.parse(readFileSync(resolve(path), "utf8"));
const result = finalizeBlindReviewAdjudication(readJson(queuePath), readJson(mergePath), readJson(adjudicationPath));
const destination = resolve(outputPath);
writeFileSync(destination, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
chmodSync(destination, 0o600);
console.error(`Finalized ${result.sourceCandidateCount} candidates: ${result.consensusCount} consensus, ${result.adjudicatedCount} adjudicated, ${result.unresolvedUncertainCount} unresolved uncertain.`);
