import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildRocketLeagueCapabilityMatrix, RL_RANK_AUDIT } from "../lib/rl-capability-matrix.mjs";

const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("publishes a queryable mode and cohort capability matrix without claiming coaching", async () => {
  const [schema, database, route] = await Promise.all([
    source("../db/schema.ts"),
    source("../db/index.ts"),
    source("../app/api/capabilities/rocket-league/route.ts"),
  ]);
  assert.match(schema, /rl_capabilities/);
  for (const mode of ["1v1", "2v2", "3v3"]) assert.match(database, new RegExp(`\\["${mode}"`));
  assert.match(database, /'shadow-only', 'abstention-only'/);
  assert.match(database, /\["3v3", "grand-champion-ssl", "calibration-verified", 0\]/);
  assert.match(route, /Processing support does not imply validated coaching/);
  assert.match(route, /buildRocketLeagueCapabilityMatrix/);
});

test("expands every capability cell across detector, mode, cohort, evidence and platform without enabling coaching", () => {
  const rows = [
    { mode: "1v1", rankCohort: "gold-platinum", upload: "enabled", parse: "verified", process: "verified" },
    { mode: "1v1", rankCohort: "grand-champion-ssl", upload: "enabled", parse: "verified", process: "verified" },
    { mode: "2v2", rankCohort: "gold-platinum", upload: "enabled", parse: "verified", process: "verified" },
  ];
  const matrix = buildRocketLeagueCapabilityMatrix(rows);
  assert.equal(matrix.schemaVersion, "rocket-league-capability-matrix.v2.1");
  assert.deepEqual(matrix.dimensions, ["detectorId", "detectorVersion", "mode", "rankCohort", "evidenceType", "platform", "validationState"]);
  assert.ok(matrix.cells.length > rows.length);
  assert.equal(matrix.summary.publicFindingCells, 0);
  assert.equal(matrix.summary.abstentionCells, matrix.summary.cells);

  const kickoffPc = matrix.cells.find(cell => cell.detectorId === "kickoff.speed" && cell.mode === "1v1"
    && cell.rankCohort === "gold-platinum" && cell.platform === "pc" && cell.evidenceType === "replay_file");
  assert.equal(kickoffPc.validationState, "shadow_only");
  assert.equal(kickoffPc.detectorVersion, "0.1.0");
  assert.equal(matrix.corpusCoverage.find(cell => cell.mode === "1v1" && cell.rankCohort === "gold-platinum").holdoutUsedForTuning, false);

  const unsupportedMode = matrix.cells.find(cell => cell.detectorId === "teamplay.double_commit" && cell.mode === "1v1"
    && cell.platform === "pc" && cell.evidenceType === "replay_file");
  assert.equal(unsupportedMode.validationState, "unsupported_mode");
  assert.equal(unsupportedMode.coaching, "abstention-only");

  const consoleVideo = matrix.cells.find(cell => cell.detectorId === "kickoff.speed" && cell.mode === "2v2"
    && cell.platform === "ps5" && cell.evidenceType === "gameplay_video");
  assert.equal(consoleVideo.validationState, "evidence_pipeline_not_validated");
  assert.equal(consoleVideo.parse, "not_implemented");
  assert.match(RL_RANK_AUDIT["grand-champion-ssl"].limitation, /cannot distinguish GC I, GC II or GC III/);
});

test("persists a parsed abstention and releases the free entitlement", async () => {
  const [analyzer, adapter, pipeline] = await Promise.all([
    source("../services/rl-engine/analyzer.mjs"),
    source("../lib/adapters/index.ts"),
    source("../lib/core/pipeline.ts"),
  ]);
  assert.match(analyzer, /kind: "success"/);
  assert.match(analyzer, /abstention: \{ code, publicMessage, internalMessage \}/);
  assert.match(adapter, /structured abstention/);
  assert.match(pipeline, /if \(result\.abstention\)/);
  assert.match(pipeline, /analysis_usage SET status = 'released'/);
  assert.match(pipeline, /normalized_object_key/);
});
