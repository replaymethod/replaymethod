import assert from "node:assert/strict";
import test from "node:test";
import { containsSensitiveIdentifier } from "./review-privacy.mjs";

test("detects complete player identifiers without matching schema fragments", () => {
  const identifiers = new Set(["Eva", "epic:123456789", "Player Seven"]);
  assert.equal(containsSensitiveIdentifier({ evaluationStatus: "private", values: [123456789] }, identifiers), false);
  assert.equal(containsSensitiveIdentifier({ note: "subject Eva at frame 4" }, identifiers), true);
  assert.equal(containsSensitiveIdentifier({ candidateId: "prefix:epic:123456789:suffix" }, identifiers), true);
  assert.equal(containsSensitiveIdentifier({ roster: [{ id: "Player Seven" }] }, identifiers), true);
});

test("ignores identifiers too short to distinguish safely", () => {
  assert.equal(containsSensitiveIdentifier({ value: "P1" }, new Set(["P1"])), false);
});
