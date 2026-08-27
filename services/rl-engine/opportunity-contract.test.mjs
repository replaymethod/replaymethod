import assert from "node:assert/strict";
import test from "node:test";
import { buildOpportunityContract, opportunityContractSummary } from "./opportunity-contract.mjs";

test("counts firings, non-firings and abstentions against one explicit denominator", () => {
  const decisionContext = {
    schemaVersion: "context@1",
    opportunities: [
      { id: "a", opportunityType: "test", eligible: true, timestampSeconds: 1, contextKey: "2v2:test:first" },
      { id: "b", opportunityType: "test", eligible: true, timestampSeconds: 2, contextKey: "2v2:test:first" },
      { id: "c", opportunityType: "test", eligible: false, abstainReasons: ["missing"], timestampSeconds: 3, contextKey: "2v2:test:unknown" },
    ],
  };
  const contract = buildOpportunityContract({
    detectorId: "test.detector", detectorVersion: "1", opportunityType: "test", decisionContext,
    classify: (opportunity) => opportunity.id === "a"
      ? { status: "firing", classification: "bad" }
      : { status: "non_firing", classification: "good" },
  });
  assert.equal(contract.summary.totalOpportunities, 3);
  assert.equal(contract.summary.eligibleOpportunities, 2);
  assert.equal(contract.summary.firingOpportunities, 1);
  assert.equal(contract.summary.nonFiringOpportunities, 1);
  assert.equal(contract.summary.abstainedOpportunities, 1);
  assert.equal(contract.summary.firingRate, 0.5);
  assert.equal(opportunityContractSummary(contract, { includeEvaluations: true }).evaluations.length, 3);
});

test("deduplicates opportunity ids and exposes integrity failure", () => {
  const opportunity = {
    id: "touch:1",
    opportunityType: "first_touch",
    eligible: true,
    timestampSeconds: 1,
    contextKey: "2v2:first",
    context: {},
  };
  const contract = buildOpportunityContract({
    detectorId: "test.detector",
    detectorVersion: "1",
    opportunityType: "first_touch",
    decisionContext: { opportunities: [opportunity, { ...opportunity, timestampSeconds: 2 }] },
    classify: () => ({ status: "non_firing", classification: "retained" }),
  });
  assert.equal(contract.summary.sourceOpportunityCount, 2);
  assert.equal(contract.summary.totalOpportunities, 1);
  assert.equal(contract.summary.duplicateOpportunitiesDropped, 1);
  assert.equal(contract.summary.integrityPassed, false);
  assert.deepEqual(contract.summary.duplicateOpportunityIds, ["touch:1"]);
});
