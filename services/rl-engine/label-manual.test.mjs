import test from "node:test";
import assert from "node:assert/strict";
import { combineLabelManuals, LABEL_MANUAL_SEPARATOR } from "./label-manual.mjs";

test("combined label manual has deterministic ordered provenance", () => {
  const first = combineLabelManuals(["  first  ", "second"]);
  const repeated = combineLabelManuals(["first", "second"]);
  const reversed = combineLabelManuals(["second", "first"]);

  assert.equal(first.handbook, `first${LABEL_MANUAL_SEPARATOR}second`);
  assert.equal(first.fingerprint, repeated.fingerprint);
  assert.notEqual(first.fingerprint, reversed.fingerprint);
  assert.equal(first.partFingerprints.length, 2);
});

test("combined label manual rejects missing content", () => {
  assert.throws(() => combineLabelManuals([]), /At least one/);
  assert.throws(() => combineLabelManuals(["valid", "  "]), /non-empty/);
});
