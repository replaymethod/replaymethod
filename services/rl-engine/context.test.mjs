import assert from "node:assert/strict";
import test from "node:test";
import { abstention, canonicalContext, cohortKey, normalizeMode, normalizeRankCohort } from "./context.mjs";

test("normalizes declared rank and mode without inventing a precise rank", () => {
  assert.equal(normalizeMode("Ranked Doubles"), "2v2");
  assert.equal(normalizeMode("Solo Duel"), "1v1");
  assert.equal(normalizeRankCohort("Champion II"), "diamond-champion");
  assert.equal(normalizeRankCohort(""), "unranked-unknown");
  assert.equal(cohortKey({ mode: "Ranked Standard", rank: "Gold III" }), "3v3:gold-platinum");
});

test("context and abstention use bounded canonical taxonomies", () => {
  const context = canonicalContext({ mode: "2v2", rank: "GC 1", playerRole: "last", pressure: "high", teammateCount: 1 });
  assert.equal(context.rankCohort, "grand-champion-ssl");
  assert.equal(context.playerRole, "last");
  assert.equal(context.possession, "unknown");
  const result = abstention("insufficient_sample", "Only one relevant event.", context);
  assert.equal(result.public, false);
  assert.equal(result.code, "insufficient_sample");
  assert.throws(() => abstention("made_up", "no"), /Unknown/);
});
