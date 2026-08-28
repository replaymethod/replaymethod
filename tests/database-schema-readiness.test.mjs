import assert from "node:assert/strict";
import test from "node:test";
import {
  CURRENT_PRODUCT_SCHEMA_CHECK,
  hasCurrentProductSchema,
} from "../lib/database-schema-readiness.mjs";

test("current product schema uses one read-only compile check", async () => {
  const calls = [];
  const database = {
    prepare(sql) {
      calls.push(sql);
      return { all: async () => ({ results: [] }) };
    },
  };

  assert.equal(await hasCurrentProductSchema(database), true);
  assert.deepEqual(calls, [CURRENT_PRODUCT_SCHEMA_CHECK]);
  assert.match(CURRENT_PRODUCT_SCHEMA_CHECK, /^SELECT\b/);
  assert.doesNotMatch(CURRENT_PRODUCT_SCHEMA_CHECK, /\b(?:CREATE|ALTER|INSERT|UPDATE|DELETE|DROP)\b/i);
});

test("missing schema falls through to the guarded bootstrap", async () => {
  const database = {
    prepare() {
      return { all: async () => { throw new Error("no such column"); } };
    },
  };

  assert.equal(await hasCurrentProductSchema(database), false);
});

test("schema sentinel covers the latest compatibility columns and tables", () => {
  for (const marker of [
    "calibration_opt_in",
    "completion_reason",
    "moment_object_key",
    "detector_set_version",
    "coaching_relevance",
    "playlist_qualifications_json",
    "player_focus_evaluations",
    "rl_capabilities",
  ]) {
    assert.match(CURRENT_PRODUCT_SCHEMA_CHECK, new RegExp(`\\b${marker}\\b`));
  }
});
