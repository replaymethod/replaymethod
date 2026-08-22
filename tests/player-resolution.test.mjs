import assert from "node:assert/strict";
import test from "node:test";
import { decodePlayerResolutionContext, encodePlayerResolutionContext } from "../lib/player-resolution.mjs";

test("player resolution context preserves a bounded unique replay roster", () => {
  const encoded = encodePlayerResolutionContext("internal parser detail", [" Player A ", "Player B", "Player A", "", "x".repeat(161)]);
  const decoded = decodePlayerResolutionContext(encoded);
  assert.equal(decoded.internalMessage, "internal parser detail");
  assert.deepEqual(decoded.candidatePlayers, ["Player A", "Player B"]);
  assert.ok(encoded.length <= 1800);
});

test("ordinary internal errors never become player choices", () => {
  assert.deepEqual(decodePlayerResolutionContext("engine unavailable"), {
    internalMessage: "engine unavailable",
    candidatePlayers: [],
    replayContext: { mode: null, gameVersion: null, occurredAt: null },
  });
});

test("structured replay context survives without exposing extra parser data", () => {
  const decoded = decodePlayerResolutionContext(encodePlayerResolutionContext(
    "verified match",
    ["Player"],
    { mode: "Ranked Standard", gameVersion: "build-1", occurredAt: "2026-08-22" },
  ));
  assert.deepEqual(decoded.replayContext, {
    mode: "Ranked Standard",
    gameVersion: "build-1",
    occurredAt: "2026-08-22",
  });
});
