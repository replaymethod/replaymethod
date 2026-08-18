#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { aggregateCalibrationRuns } from "../services/rl-engine/calibration.mjs";
import { buildReplayEvidence, inspectReplayRoster } from "../services/rl-engine/parser.mjs";
import { runShadowDetectors } from "../services/rl-engine/shadow-runtime.mjs";

function usage() {
  console.error("Usage: node scripts/calibrate-rl-engine.mjs <file-or-directory> [...] [--output report.json]");
}

function replayFiles(target) {
  if (!existsSync(target)) return [];
  if (statSync(target).isFile()) return target.endsWith(".replay") ? [target] : [];
  return readdirSync(target, { withFileTypes: true }).flatMap((entry) => {
    const child = resolve(target, entry.name);
    return entry.isDirectory() ? replayFiles(child) : (entry.name.endsWith(".replay") ? [child] : []);
  });
}

const rawArgs = process.argv.slice(2);
const outputIndex = rawArgs.indexOf("--output");
const output = outputIndex >= 0 ? rawArgs[outputIndex + 1] : null;
const targets = rawArgs.filter((arg, index) => index !== outputIndex && index !== outputIndex + 1);
if (!targets.length || (outputIndex >= 0 && !output)) {
  usage();
  process.exitCode = 1;
} else {
  const unique = new Map();
  for (const target of targets) {
    for (const file of replayFiles(resolve(target))) {
      const bytes = readFileSync(file);
      const hash = createHash("sha256").update(bytes).digest("hex");
      if (!unique.has(hash)) unique.set(hash, { file, bytes: new Uint8Array(bytes), hash });
    }
  }

  const entries = [];
  const failures = [];
  for (const { file, bytes, hash } of unique.values()) {
    try {
      console.error(`Calibrating ${basename(file)}…`);
      const roster = inspectReplayRoster(bytes);
      const subject = roster.players[0];
      if (!subject) throw new Error("Replay contained no attributable player.");
      const evidence = buildReplayEvidence(bytes, subject.name, "");
      const shadow = runShadowDetectors(evidence);
      entries.push({
        replayFingerprint: hash.slice(0, 16),
        mode: evidence.normalized.mode ?? null,
        gameVersion: evidence.normalized.gameVersion ?? null,
        playerCount: evidence.frameState.summary.playerCount,
        sampledFrames: evidence.frameState.summary.frameCount,
        frameCoverage: evidence.frameState.summary.coverage,
        parserEvents: evidence.episodeTimeline.summary.rawEventCount,
        decisionEvents: evidence.episodeTimeline.summary.decisionEventCount,
        shadowRuns: shadow.runs.map((run) => ({
          detectorId: run.detectorId,
          detectorVersion: run.detectorVersion,
          status: run.status,
          candidateCount: run.candidateCount,
          measurements: run.measurements,
          evidence: run.evidence,
        })),
      });
    } catch (error) {
      failures.push({
        replayFingerprint: hash.slice(0, 16),
        code: error?.code ?? "calibration_failure",
        message: error instanceof Error ? error.message : "Unknown calibration failure",
      });
    }
  }

  const report = aggregateCalibrationRuns(entries, failures);
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (output) {
    const destination = resolve(output);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, json);
    console.error(`Wrote ${destination}`);
  } else {
    process.stdout.write(json);
  }
  if (!entries.length) process.exitCode = 2;
}
