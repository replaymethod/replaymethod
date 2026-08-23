import assert from "node:assert/strict";
import test from "node:test";

import { legacyUtcTimestamp } from "../lib/report-date.mjs";

test("normalizes already-zoned report timestamps before the legacy UTC suffix is appended", () => {
  assert.equal(legacyUtcTimestamp("2026-08-23T14:44:00.000Z"), "2026-08-23T14:44:00.000");
  assert.equal(legacyUtcTimestamp("2026-08-23T16:44:00+02:00"), "2026-08-23T14:44:00.000");
  assert.equal(legacyUtcTimestamp("2026-08-23 14:44:00"), "2026-08-23 14:44:00");
  assert.equal(legacyUtcTimestamp(null), null);
});
