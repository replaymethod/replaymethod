import { DECISION_CONTEXT_VERSION } from "./decision-context.mjs";

export const OPPORTUNITY_CONTRACT_VERSION = "rocket-league-opportunity-contract@0.2.0";

const STATUSES = new Set(["firing", "non_firing", "abstained"]);

function classifySafely(classify, opportunity) {
  if (opportunity?.eligible !== true) {
    return {
      status: "abstained",
      classification: "ineligible_context",
      reasons: opportunity?.abstainReasons?.length ? opportunity.abstainReasons : ["opportunity_not_eligible"],
    };
  }
  try {
    const result = classify(opportunity) ?? {};
    if (!STATUSES.has(result.status)) throw new Error("Opportunity classifier returned an invalid status.");
    return {
      status: result.status,
      classification: String(result.classification || "unclassified"),
      reasons: Array.isArray(result.reasons) ? result.reasons.map(String).slice(0, 5) : [],
      evidence: result.evidence && typeof result.evidence === "object" ? result.evidence : null,
    };
  } catch (error) {
    return {
      status: "abstained",
      classification: "classifier_error",
      reasons: [error instanceof Error ? error.message : "Unknown opportunity classifier error"],
    };
  }
}

/**
 * A detector must account for every comparable opportunity, including
 * non-firings and abstentions. Candidate count alone is never the denominator.
 */
export function buildOpportunityContract(input) {
  if (!input?.detectorId || !input?.detectorVersion || !input?.opportunityType || typeof input.classify !== "function") {
    throw new Error("Opportunity contract requires detector identity, opportunity type and classifier.");
  }
  const rawSource = (input.decisionContext?.opportunities ?? [])
    .filter((opportunity) => opportunity.opportunityType === input.opportunityType);
  const source = [];
  const seenOpportunityIds = new Set();
  const duplicateOpportunityIds = new Set();
  for (const opportunity of rawSource) {
    const id = String(opportunity?.id ?? "").trim();
    if (!id || seenOpportunityIds.has(id)) {
      if (id) duplicateOpportunityIds.add(id);
      continue;
    }
    seenOpportunityIds.add(id);
    source.push(opportunity);
  }
  const evaluations = source.map((opportunity) => ({
    opportunityId: opportunity.id,
    opportunityType: opportunity.opportunityType,
    timestampSeconds: opportunity.timestampSeconds,
    frame: opportunity.frame,
    contextKey: opportunity.contextKey,
    context: opportunity.context,
    ...classifySafely(input.classify, opportunity),
  }));
  const contextCounts = evaluations.reduce((counts, evaluation) => {
    const current = counts[evaluation.contextKey] ?? { total: 0, firing: 0, nonFiring: 0, abstained: 0 };
    current.total += 1;
    if (evaluation.status === "firing") current.firing += 1;
    if (evaluation.status === "non_firing") current.nonFiring += 1;
    if (evaluation.status === "abstained") current.abstained += 1;
    counts[evaluation.contextKey] = current;
    return counts;
  }, {});
  const classifications = evaluations.reduce((counts, evaluation) => {
    counts[evaluation.classification] = (counts[evaluation.classification] ?? 0) + 1;
    return counts;
  }, {});
  const eligible = evaluations.filter((evaluation) => evaluation.status !== "abstained");
  return {
    schemaVersion: OPPORTUNITY_CONTRACT_VERSION,
    contextVersion: input.decisionContext?.schemaVersion ?? DECISION_CONTEXT_VERSION,
    detectorId: input.detectorId,
    detectorVersion: input.detectorVersion,
    opportunityType: input.opportunityType,
    evaluations,
    summary: {
      sourceOpportunityCount: rawSource.length,
      totalOpportunities: evaluations.length,
      duplicateOpportunitiesDropped: rawSource.length - evaluations.length,
      duplicateOpportunityIds: [...duplicateOpportunityIds].sort(),
      integrityPassed: rawSource.length === evaluations.length,
      eligibleOpportunities: eligible.length,
      firingOpportunities: evaluations.filter((evaluation) => evaluation.status === "firing").length,
      nonFiringOpportunities: evaluations.filter((evaluation) => evaluation.status === "non_firing").length,
      abstainedOpportunities: evaluations.filter((evaluation) => evaluation.status === "abstained").length,
      firingRate: eligible.length ? evaluations.filter((evaluation) => evaluation.status === "firing").length / eligible.length : null,
      contextCounts,
      classifications,
    },
  };
}

export function opportunityContractSummary(contract, { includeEvaluations = false } = {}) {
  if (!contract) return null;
  return {
    schemaVersion: contract.schemaVersion,
    contextVersion: contract.contextVersion,
    detectorId: contract.detectorId,
    detectorVersion: contract.detectorVersion,
    opportunityType: contract.opportunityType,
    ...contract.summary,
    ...(includeEvaluations ? {
      evaluations: contract.evaluations.map((evaluation) => ({
        opportunityId: evaluation.opportunityId,
        status: evaluation.status,
        classification: evaluation.classification,
        contextKey: evaluation.contextKey,
      })),
    } : {}),
  };
}
