import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const focusPath = new URL("../lib/player-focus.ts", import.meta.url);
const pipelinePath = new URL("../lib/core/pipeline.ts", import.meta.url);
const schemaPath = new URL("../db/schema.ts", import.meta.url);

test("keeps an active focus when a later analysis does not observe its detector", async () => {
  const source = await readFile(focusPath, "utf8");
  assert.match(source, /active_focus_not_observed/);
  assert.doesNotMatch(source, /status = 'replaced'/);
  assert.match(source, /progress !== "target_met"/);
});

test("persists the adapter detector identity, not a title-derived key", async () => {
  const pipeline = await readFile(pipelinePath, "utf8");
  assert.match(pipeline, /finding\.id, finding\.detectorVersion/);
  assert.match(pipeline, /detector_id/);
  assert.doesNotMatch(pipeline, /shadowRun|review_candidates|shadow-runtime/);
});

test("enforces one active focus and one observation per focus-analysis pair", async () => {
  const schema = await readFile(schemaPath, "utf8");
  assert.match(schema, /player_focuses_active_unique/);
  assert.match(schema, /player_focus_observations_focus_request_unique/);
  assert.match(schema, /completionReason/);
  assert.match(schema, /evidenceJson/);
  assert.match(schema, /limitationsJson/);
});

test("focus errors cannot move a completed analysis back into retry", async () => {
  const pipeline = await readFile(pipelinePath, "utf8");
  assert.match(pipeline, /player focus persistence failed/);
  assert.ok(pipeline.indexOf("UPDATE analysis_requests SET status = 'ready'") < pipeline.indexOf("await advancePlayerFocus"));
  const focusCatch = pipeline.slice(pipeline.indexOf("await advancePlayerFocus"), pipeline.indexOf("await sendAnalysisReady"));
  assert.doesNotMatch(focusCatch, /throw error|status = 'retry'/);
});
