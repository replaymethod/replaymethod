import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
  assert.match(route, /Processing support does not imply validated coaching/);
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
