import assert from "node:assert/strict";
import test from "node:test";

import { canonicalUtcTimestamp, legacyUtcTimestamp, utcTimestampMillis } from "../lib/report-date.mjs";

test("normalizes already-zoned report timestamps before the legacy UTC suffix is appended", () => {
  assert.equal(legacyUtcTimestamp("2026-08-23T14:44:00.000Z"), "2026-08-23T14:44:00.000");
  assert.equal(legacyUtcTimestamp("2026-08-23T16:44:00+02:00"), "2026-08-23T14:44:00.000");
  assert.equal(legacyUtcTimestamp("2026-08-23 14:44:00"), "2026-08-23 14:44:00");
  assert.equal(legacyUtcTimestamp("2026-04-14 23-37-58"), "2026-04-14T23:37:58.000");
  assert.equal(legacyUtcTimestamp("2026-04-14T23-37-58.125"), "2026-04-14T23:37:58.125");
  assert.equal(legacyUtcTimestamp(null), null);
});

test("canonicalizes every persisted and replay timestamp without double zones", () => {
  assert.equal(canonicalUtcTimestamp("2026-08-23T14:44:00.000Z"), "2026-08-23T14:44:00.000Z");
  assert.equal(canonicalUtcTimestamp("2026-08-23 14:44:00"), "2026-08-23T14:44:00.000Z");
  assert.equal(canonicalUtcTimestamp("2026-04-14 23-37-58"), "2026-04-14T23:37:58.000Z");
  assert.equal(canonicalUtcTimestamp("not-a-date"), null);
  assert.equal(canonicalUtcTimestamp(null), null);
  assert.equal(utcTimestampMillis("2026-08-23T14:44:00.000Z"), Date.UTC(2026, 7, 23, 14, 44));
});
