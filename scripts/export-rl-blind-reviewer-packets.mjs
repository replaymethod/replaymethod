#!/usr/bin/env node
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildBlindReviewerPackets } from "../services/rl-engine/calibration.mjs";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

const queuePath = argument("--queue");
const planPath = argument("--plan");
const momentsPath = argument("--moments");
const outputDirectory = argument("--output-dir");
if (!queuePath || !planPath || !momentsPath || !outputDirectory) {
  console.error("Usage: node scripts/export-rl-blind-reviewer-packets.mjs --queue queue.json --plan plan.json --moments moments.json --output-dir private-packets");
  process.exit(1);
}

const queue = JSON.parse(readFileSync(resolve(queuePath), "utf8"));
const plan = JSON.parse(readFileSync(resolve(planPath), "utf8"));
const moments = JSON.parse(readFileSync(resolve(momentsPath), "utf8"));
const packets = buildBlindReviewerPackets(queue, plan, moments);
const destination = resolve(outputDirectory);
mkdirSync(destination, { recursive: true, mode: 0o700 });
for (const packet of packets) {
  const path = join(destination, `${packet.reviewerSlot}.json`);
  writeFileSync(path, `${JSON.stringify(packet, null, 2)}\n`, { mode: 0o600 });
  chmodSync(path, 0o600);
}
console.error(`Wrote ${packets.length} redacted blind reviewer packets with ${packets[0].candidateCount} candidates each to ${destination}.`);
