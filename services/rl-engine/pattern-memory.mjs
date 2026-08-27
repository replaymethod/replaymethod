import { createHash } from "node:crypto";

export const PATTERN_MEMORY_VERSION = "rocket-league-pattern-memory@0.2.0";
export const PATTERN_MEMORY_COMPARISON_VERSION = "rocket-league-pattern-memory-comparison@0.2.0";

export const DEFAULT_PATTERN_LOCK_THRESHOLDS = Object.freeze({
  minimumEligibleMatches: 5,
  minimumFiringMatches: 3,
  minimumEligibleOpportunities: 8,
  minimumFiringSegments: 2,
  maximumAbstentionRate: 0.35,
});

const VALID_STATUSES = new Set(["firing", "non_firing", "abstained"]);

function finiteInteger(value, fallback, minimum = 0) {
  return Number.isInteger(value) && value >= minimum ? value : fallback;
}

function clampRate(value, fallback) {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
}

function normalizedThresholds(input = {}) {
  return {
    minimumEligibleMatches: finiteInteger(input.minimumEligibleMatches, DEFAULT_PATTERN_LOCK_THRESHOLDS.minimumEligibleMatches, 2),
    minimumFiringMatches: finiteInteger(input.minimumFiringMatches, DEFAULT_PATTERN_LOCK_THRESHOLDS.minimumFiringMatches, 2),
    minimumEligibleOpportunities: finiteInteger(input.minimumEligibleOpportunities, DEFAULT_PATTERN_LOCK_THRESHOLDS.minimumEligibleOpportunities, 1),
    minimumFiringSegments: finiteInteger(input.minimumFiringSegments, DEFAULT_PATTERN_LOCK_THRESHOLDS.minimumFiringSegments, 1),
    maximumAbstentionRate: clampRate(input.maximumAbstentionRate, DEFAULT_PATTERN_LOCK_THRESHOLDS.maximumAbstentionRate),
  };
}

function wilsonInterval(successes, trials, z = 1.96) {
  if (!trials) return { lower: null, upper: null };
  const rate = successes / trials;
  const denominator = 1 + (z ** 2) / trials;
  const centre = rate + (z ** 2) / (2 * trials);
  const margin = z * Math.sqrt((rate * (1 - rate) + (z ** 2) / (4 * trials)) / trials);
  return {
    lower: Math.max(0, (centre - margin) / denominator),
    upper: Math.min(1, (centre + margin) / denominator),
  };
}

function segmentFor(matchIndex, totalMatches) {
  if (totalMatches <= 1) return 0;
  return Math.min(2, Math.floor((matchIndex / totalMatches) * 3));
}

function contractId(input, thresholds) {
  const frozenDefinition = JSON.stringify({
    schemaVersion: PATTERN_MEMORY_VERSION,
    detectorId: input.detectorId,
    detectorVersion: input.detectorVersion,
    opportunityContractVersion: input.opportunityContractVersion ?? "unknown",
    contextVersion: input.contextVersion ?? "unknown",
    opportunityType: input.opportunityType,
    contextKey: input.contextKey,
    thresholds,
  });
  return `pm_${createHash("sha256").update(frozenDefinition).digest("hex").slice(0, 24)}`;
}

function stateFor({ eligibleMatches, firingMatches, eligibleOpportunities, abstentionRate, firingSegments, knownContext, gates }) {
  if (eligibleMatches === 0) return "insufficient_exposure";
  if (eligibleMatches < 2 || eligibleOpportunities < 3) return firingMatches ? "single_match_signal" : "insufficient_exposure";
  if (firingMatches === 0) return "no_recurring_signal";
  if (!gates.abstentionWithinLimit && abstentionRate != null) return "inconclusive_high_abstention";
  if (Object.values(gates).every(Boolean)) return "pattern_lock_candidate";
  if (firingMatches >= 2 && firingSegments >= 1 && knownContext) return "emerging_pattern";
  return "isolated_signal";
}

/**
 * Freeze one detector + context into a re-measurable cross-match contract.
 * This proves recurrence of the detector output, not detector correctness.
 * Public coaching remains blocked until the detector's independent quality gate
 * and activation record pass elsewhere.
 */
export function buildPatternMemoryContract(input = {}) {
  if (!input.detectorId || !input.detectorVersion || !input.opportunityType || !input.contextKey) {
    throw new Error("Pattern memory requires detector identity, opportunity type and context key.");
  }
  const totalMatches = finiteInteger(input.totalMatches, 0, 1);
  if (!totalMatches) throw new Error("Pattern memory requires a positive total match count.");
  const thresholds = normalizedThresholds(input.thresholds);
  const evaluations = (Array.isArray(input.evaluations) ? input.evaluations : [])
    .filter((evaluation) => VALID_STATUSES.has(evaluation?.status) && Number.isInteger(evaluation.matchIndex) && evaluation.matchIndex >= 0 && evaluation.matchIndex < totalMatches);
  const eligible = evaluations.filter((evaluation) => evaluation.status !== "abstained");
  const firing = eligible.filter((evaluation) => evaluation.status === "firing");
  const eligibleMatchIds = new Set(eligible.map((evaluation) => evaluation.matchIndex));
  const firingMatchIds = new Set(firing.map((evaluation) => evaluation.matchIndex));
  const abstainedOpportunities = evaluations.length - eligible.length;
  const abstentionRate = evaluations.length ? abstainedOpportunities / evaluations.length : null;
  const firingSegments = new Set([...firingMatchIds].map((matchIndex) => segmentFor(matchIndex, totalMatches))).size;
  const knownContext = input.contextKey !== "unknown";
  const gates = {
    knownContext,
    eligibleMatches: eligibleMatchIds.size >= thresholds.minimumEligibleMatches,
    firingMatches: firingMatchIds.size >= thresholds.minimumFiringMatches,
    eligibleOpportunities: eligible.length >= thresholds.minimumEligibleOpportunities,
    distributedEvidence: firingSegments >= thresholds.minimumFiringSegments,
    abstentionWithinLimit: abstentionRate == null || abstentionRate <= thresholds.maximumAbstentionRate,
  };
  const failedGates = Object.entries(gates).filter(([, passed]) => !passed).map(([gate]) => gate);
  const matchFiringRate = eligibleMatchIds.size ? firingMatchIds.size / eligibleMatchIds.size : null;

  return {
    schemaVersion: PATTERN_MEMORY_VERSION,
    contractId: contractId(input, thresholds),
    comparisonKey: `${input.detectorId}@${input.detectorVersion}:${input.opportunityContractVersion ?? "unknown"}:${input.contextVersion ?? "unknown"}:${input.contextKey}`,
    detectorId: String(input.detectorId),
    detectorVersion: String(input.detectorVersion),
    opportunityContractVersion: String(input.opportunityContractVersion ?? "unknown"),
    contextVersion: String(input.contextVersion ?? "unknown"),
    opportunityType: String(input.opportunityType),
    contextKey: String(input.contextKey),
    state: stateFor({
      eligibleMatches: eligibleMatchIds.size,
      firingMatches: firingMatchIds.size,
      eligibleOpportunities: eligible.length,
      abstentionRate,
      firingSegments,
      knownContext,
      gates,
    }),
    publicationStatus: "private_shadow",
    publicEligible: false,
    evidence: {
      totalMatches,
      eligibleMatches: eligibleMatchIds.size,
      firingMatches: firingMatchIds.size,
      eligibleOpportunities: eligible.length,
      firingOpportunities: firing.length,
      nonFiringOpportunities: eligible.length - firing.length,
      abstainedOpportunities,
      matchFiringRate,
      matchFiringRate95: wilsonInterval(firingMatchIds.size, eligibleMatchIds.size),
      opportunityFiringRate: eligible.length ? firing.length / eligible.length : null,
      abstentionRate,
      firingSegments,
    },
    thresholds,
    gates,
    failedGates,
    limitation: "A pattern-lock candidate establishes repeatable detector output in one comparable context. It does not validate detector accuracy or authorize customer-facing coaching.",
  };
}

export function summarizePatternMemory(contracts = []) {
  const valid = contracts.filter((contract) => contract?.schemaVersion === PATTERN_MEMORY_VERSION);
  const states = valid.reduce((counts, contract) => {
    counts[contract.state] = (counts[contract.state] ?? 0) + 1;
    return counts;
  }, {});
  return {
    schemaVersion: PATTERN_MEMORY_VERSION,
    publicationStatus: "private_shadow",
    contractCount: valid.length,
    patternLockCandidateCount: states.pattern_lock_candidate ?? 0,
    states,
    contracts: valid,
  };
}

function followUpHasExposure(contract) {
  return Boolean(
    contract?.gates?.knownContext
    && contract?.gates?.eligibleMatches
    && contract?.gates?.eligibleOpportunities
    && contract?.gates?.abstentionWithinLimit,
  );
}

/**
 * Compare a later window against the exact frozen detector/context definition.
 * Direction is reported privately; it is not a public improvement claim.
 */
export function comparePatternMemoryContracts(baseline, followUp, options = {}) {
  if (!baseline?.contractId || !followUp?.contractId) throw new Error("Pattern comparison requires baseline and follow-up contracts.");
  const minimumAbsoluteChange = clampRate(options.minimumAbsoluteChange, 0.15);
  const comparable = baseline.contractId === followUp.contractId;
  const baselineRate = baseline?.evidence?.matchFiringRate;
  const followUpRate = followUp?.evidence?.matchFiringRate;
  const ratesAvailable = Number.isFinite(baselineRate) && Number.isFinite(followUpRate);
  const delta = ratesAvailable ? followUpRate - baselineRate : null;

  let state = "inconclusive";
  const reasons = [];
  if (!comparable) {
    state = "incomparable_definition";
    reasons.push("detector_version_context_or_thresholds_changed");
  } else if (!followUpHasExposure(followUp) || !ratesAvailable) {
    reasons.push("follow_up_exposure_below_contract");
  } else if (followUp.evidence.firingMatches === 0 && baseline.evidence.firingMatches >= baseline.thresholds.minimumFiringMatches) {
    state = "resolution_candidate";
  } else if (delta <= -minimumAbsoluteChange) {
    state = "improvement_signal";
  } else if (delta >= minimumAbsoluteChange) {
    state = "regression_signal";
  } else {
    state = "stable_or_unclear";
  }

  return {
    schemaVersion: PATTERN_MEMORY_COMPARISON_VERSION,
    contractId: comparable ? baseline.contractId : null,
    comparisonKey: comparable ? baseline.comparisonKey : null,
    state,
    publicationStatus: "private_shadow",
    publicEligible: false,
    comparable,
    reasons,
    metric: {
      key: "eligible_match_firing_rate",
      baseline: ratesAvailable ? baselineRate : null,
      followUp: ratesAvailable ? followUpRate : null,
      delta,
      minimumAbsoluteChange,
    },
    exposure: {
      baselineEligibleMatches: baseline?.evidence?.eligibleMatches ?? 0,
      followUpEligibleMatches: followUp?.evidence?.eligibleMatches ?? 0,
      baselineEligibleOpportunities: baseline?.evidence?.eligibleOpportunities ?? 0,
      followUpEligibleOpportunities: followUp?.evidence?.eligibleOpportunities ?? 0,
    },
    limitation: "This is a private directional comparison of the same detector contract. It is not proof of causation, detector validity or rank improvement.",
  };
}
