import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPatternMemoryContract,
  comparePatternMemoryContracts,
  PATTERN_MEMORY_COMPARISON_VERSION,
  PATTERN_MEMORY_VERSION,
  summarizePatternMemory,
} from "./pattern-memory.mjs";

function evaluation(matchIndex, status) {
  return { matchIndex, status };
}

const identity = {
  detectorId: "possession.first_touch_retention",
  detectorVersion: "0.1.0",
  opportunityType: "first_touch_retention",
  contextKey: "2v2:first_touch_retention:first:loose:low:normal",
  totalMatches: 10,
};

test("creates a deterministic private pattern-lock candidate from distributed comparable evidence", () => {
  const evaluations = [
    evaluation(0, "firing"), evaluation(0, "non_firing"),
    evaluation(1, "non_firing"), evaluation(2, "firing"),
    evaluation(3, "non_firing"), evaluation(4, "non_firing"),
    evaluation(6, "firing"), evaluation(6, "non_firing"),
    evaluation(7, "non_firing"), evaluation(8, "firing"),
    evaluation(9, "non_firing"), evaluation(9, "abstained"),
  ];
  const contract = buildPatternMemoryContract({ ...identity, evaluations });
  const repeated = buildPatternMemoryContract({ ...identity, evaluations: [...evaluations].reverse() });

  assert.equal(contract.schemaVersion, PATTERN_MEMORY_VERSION);
  assert.equal(contract.state, "pattern_lock_candidate");
  assert.equal(contract.publicationStatus, "private_shadow");
  assert.equal(contract.publicEligible, false);
  assert.equal(contract.evidence.eligibleMatches, 9);
  assert.equal(contract.evidence.firingMatches, 4);
  assert.equal(contract.evidence.eligibleOpportunities, 11);
  assert.equal(contract.evidence.abstainedOpportunities, 1);
  assert.equal(contract.evidence.firingSegments, 3);
  assert.ok(contract.evidence.matchFiringRate95.lower < contract.evidence.matchFiringRate);
  assert.ok(contract.evidence.matchFiringRate95.upper > contract.evidence.matchFiringRate);
  assert.equal(contract.contractId, repeated.contractId);
  assert.deepEqual(contract.failedGates, []);
});

test("keeps thin, clustered and heavily abstained signals out of pattern lock", () => {
  const thin = buildPatternMemoryContract({ ...identity, evaluations: [evaluation(0, "firing"), evaluation(0, "non_firing")] });
  assert.equal(thin.state, "single_match_signal");

  const clustered = buildPatternMemoryContract({
    ...identity,
    evaluations: [0, 1, 2].flatMap((matchIndex) => [evaluation(matchIndex, "firing"), evaluation(matchIndex, "non_firing"), evaluation(matchIndex, "non_firing")]),
  });
  assert.equal(clustered.state, "emerging_pattern");
  assert.equal(clustered.gates.distributedEvidence, false);

  const abstained = buildPatternMemoryContract({
    ...identity,
    evaluations: [
      ...[0, 2, 6, 8, 9].map((matchIndex) => evaluation(matchIndex, "firing")),
      ...[1, 3, 4, 5].map((matchIndex) => evaluation(matchIndex, "non_firing")),
      ...Array.from({ length: 12 }, (_, index) => evaluation(index % 10, "abstained")),
    ],
  });
  assert.equal(abstained.state, "inconclusive_high_abstention");
  assert.equal(abstained.gates.abstentionWithinLimit, false);
});

test("freezes detector version and context into the comparison identity", () => {
  const evaluations = [0, 2, 4, 6, 8].flatMap((matchIndex) => [evaluation(matchIndex, "firing"), evaluation(matchIndex, "non_firing")]);
  const base = buildPatternMemoryContract({ ...identity, evaluations });
  const nextVersion = buildPatternMemoryContract({ ...identity, detectorVersion: "0.2.0", evaluations });
  const nextContext = buildPatternMemoryContract({ ...identity, contextKey: "2v2:first_touch_retention:last:controlled:high:normal", evaluations });
  const nextContextSchema = buildPatternMemoryContract({ ...identity, contextVersion: "context@2", evaluations });
  const nextOpportunitySchema = buildPatternMemoryContract({ ...identity, opportunityContractVersion: "opportunity@2", evaluations });
  assert.notEqual(base.contractId, nextVersion.contractId);
  assert.notEqual(base.contractId, nextContext.contractId);
  assert.notEqual(base.contractId, nextContextSchema.contractId);
  assert.notEqual(base.contractId, nextOpportunitySchema.contractId);
  assert.notEqual(base.comparisonKey, nextContext.comparisonKey);
});

test("summarizes private states without promoting them", () => {
  const locked = buildPatternMemoryContract({
    ...identity,
    evaluations: [0, 2, 4, 6, 8].flatMap((matchIndex) => [evaluation(matchIndex, "firing"), evaluation(matchIndex, "non_firing")]),
  });
  const absent = buildPatternMemoryContract({
    ...identity,
    contextKey: "2v2:first_touch_retention:last:loose:low:normal",
    evaluations: [0, 1, 2, 3, 4].flatMap((matchIndex) => [evaluation(matchIndex, "non_firing"), evaluation(matchIndex, "non_firing")]),
  });
  const summary = summarizePatternMemory([locked, absent]);
  assert.equal(summary.contractCount, 2);
  assert.equal(summary.patternLockCandidateCount, 1);
  assert.equal(summary.states.no_recurring_signal, 1);
  assert.equal(summary.publicationStatus, "private_shadow");
});

test("compares a follow-up only against the exact frozen behavior contract", () => {
  const baseline = buildPatternMemoryContract({
    ...identity,
    evaluations: [0, 2, 4, 6, 8].flatMap((matchIndex) => [evaluation(matchIndex, "firing"), evaluation(matchIndex, "non_firing")]),
  });
  const improved = buildPatternMemoryContract({
    ...identity,
    evaluations: [
      evaluation(0, "firing"), evaluation(0, "non_firing"),
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((matchIndex) => evaluation(matchIndex, "non_firing")),
    ],
  });
  const comparison = comparePatternMemoryContracts(baseline, improved);
  assert.equal(comparison.schemaVersion, PATTERN_MEMORY_COMPARISON_VERSION);
  assert.equal(comparison.state, "improvement_signal");
  assert.equal(comparison.comparable, true);
  assert.equal(comparison.publicEligible, false);
  assert.ok(comparison.metric.delta < 0);

  const changedDefinition = buildPatternMemoryContract({ ...identity, detectorVersion: "0.2.0", evaluations: improved.evaluations });
  const rejected = comparePatternMemoryContracts(baseline, changedDefinition);
  assert.equal(rejected.state, "incomparable_definition");
  assert.equal(rejected.comparable, false);
});

test("refuses to call improvement when the follow-up lacks comparable exposure", () => {
  const baseline = buildPatternMemoryContract({
    ...identity,
    evaluations: [0, 2, 4, 6, 8].flatMap((matchIndex) => [evaluation(matchIndex, "firing"), evaluation(matchIndex, "non_firing")]),
  });
  const thinFollowUp = buildPatternMemoryContract({ ...identity, evaluations: [evaluation(0, "non_firing")] });
  const comparison = comparePatternMemoryContracts(baseline, thinFollowUp);
  assert.equal(comparison.state, "inconclusive");
  assert.deepEqual(comparison.reasons, ["follow_up_exposure_below_contract"]);
});
