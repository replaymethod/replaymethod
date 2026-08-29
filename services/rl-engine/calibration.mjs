import { assessPublicDetectorGate } from "./quality-gates.mjs";
import { wilsonLowerBound } from "./quality-gates.mjs";
import { createHash } from "node:crypto";

export const CALIBRATION_REPORT_VERSION = "rocket-league-calibration-report.v1";
export const REVIEW_QUEUE_VERSION = "rocket-league-review-queue.v2";
export const OPPORTUNITY_REVIEW_QUEUE_VERSION = "rocket-league-opportunity-review-queue.v1";

export const FOUNDATION_DETECTOR_IDS = Object.freeze([
  "possession.first_touch_retention",
  "challenge.quality",
  "recovery.reentry_quality",
]);

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().filter((key) => !["generatedAt", "reproducibilityFingerprint", "operational"].includes(key))
      .map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

export function calibrationFingerprint(report) {
  const material = stableValue({
    ...report,
    replays: [...(report?.replays ?? [])].sort((left, right) => String(left.replayFingerprint).localeCompare(String(right.replayFingerprint))),
  });
  return createHash("sha256").update(JSON.stringify(material)).digest("hex");
}

function versionInventory(report) {
  const versions = new Set();
  for (const replay of report?.replays ?? []) {
    for (const [name, version] of Object.entries(replay.versions ?? {})) if (version) versions.add(`${name}:${version}`);
    for (const run of replay.shadowRuns ?? []) versions.add(`detector:${run.detectorId}@${run.detectorVersion}`);
    if (replay.gameVersion) versions.add(`game:${replay.gameVersion}`);
  }
  return [...versions].sort();
}

export function compareCalibrationReports(left, right) {
  const leftVersions = versionInventory(left);
  const rightVersions = versionInventory(right);
  return {
    reproducible: calibrationFingerprint(left) === calibrationFingerprint(right),
    versionDrift: JSON.stringify(leftVersions) !== JSON.stringify(rightVersions),
    leftVersions,
    rightVersions,
  };
}

const decidedVerdicts = new Set(["confirmed", "rejected"]);
const gameplayTruthValues = new Set(["present", "absent", "uncertain"]);

function reviewDecision(label) {
  if (gameplayTruthValues.has(label?.gameplayTruth)) return label.gameplayTruth;
  if (label?.verdict === "confirmed") return "present";
  if (label?.verdict === "rejected") return "absent";
  if (label?.verdict === "uncertain") return "uncertain";
  return null;
}

export function reviewerAgreementMetrics(labels = []) {
  const latest = new Map();
  for (const label of labels) {
    const candidateKey = label.candidateKey ?? label.candidateId;
    const reviewer = String(label.reviewerId ?? label.reviewerEmail ?? "").trim().toLowerCase();
    const decision = reviewDecision(label);
    if (!candidateKey || !reviewer || !decision) continue;
    const key = `${candidateKey}:${reviewer}`;
    const previous = latest.get(key);
    const currentOrder = String(label.createdAt ?? label.id ?? "");
    const previousOrder = String(previous?.createdAt ?? previous?.id ?? "");
    if (!previous || currentOrder >= previousOrder) latest.set(key, { ...label, candidateKey, reviewer, decision });
  }
  const byCandidate = Map.groupBy([...latest.values()], (label) => label.candidateKey);
  const comparisons = [];
  for (const candidateLabels of byCandidate.values()) {
    for (let left = 0; left < candidateLabels.length; left += 1) {
      for (let right = left + 1; right < candidateLabels.length; right += 1) {
        comparisons.push([candidateLabels[left].decision, candidateLabels[right].decision]);
      }
    }
  }
  const rawAgreement = comparisons.length
    ? comparisons.filter(([left, right]) => left === right).length / comparisons.length
    : null;
  const decisions = [...latest.values()];
  const decisionCounts = decisions.reduce((counts, label) => {
    counts[label.decision] = (counts[label.decision] ?? 0) + 1;
    return counts;
  }, {});
  const expected = decisions.length
    ? Object.values(decisionCounts).reduce((sum, count) => sum + ((count / decisions.length) ** 2), 0)
    : null;
  const kappa = rawAgreement == null || expected == null || expected === 1
    ? null
    : (rawAgreement - expected) / (1 - expected);
  return {
    independentReviewers: new Set(decisions.map((label) => label.reviewer)).size,
    doubleReviewedCandidates: [...byCandidate.values()].filter((items) => items.length >= 2).length,
    pairwiseComparisons: comparisons.length,
    rawAgreement,
    kappa,
  };
}

export function reviewerAgreementByStratum(labels = []) {
  const strata = Map.groupBy(labels, (label) => (
    `${label.detectorId ?? "unknown"}:${label.contextKey ?? label.opportunityContextKey ?? "unknown"}`
  ));
  return [...strata.entries()].map(([stratum, rows]) => ({
    stratum,
    detectorId: rows[0]?.detectorId ?? "unknown",
    contextKey: rows[0]?.contextKey ?? rows[0]?.opportunityContextKey ?? "unknown",
    ...reviewerAgreementMetrics(rows),
  })).sort((left, right) => left.stratum.localeCompare(right.stratum));
}

/**
 * Produce an explicit adjudication packet. It contains only independently
 * double-reviewed disagreements/uncertain labels and never resolves them.
 */
export function buildAdjudicationQueue(reviewQueue, labelHistory = []) {
  const candidates = new Map((reviewQueue?.candidates ?? []).map((candidate) => [candidate.id, candidate]));
  const latest = new Map();
  for (const label of labelHistory) {
    const candidateKey = label.candidateKey ?? label.candidateId;
    const reviewer = String(label.reviewerId ?? label.reviewerEmail ?? "").trim().toLowerCase();
    const decision = reviewDecision(label);
    if (!candidates.has(candidateKey) || !reviewer || !decision) continue;
    const key = `${candidateKey}:${reviewer}`;
    const previous = latest.get(key);
    const currentOrder = String(label.createdAt ?? label.id ?? "");
    const previousOrder = String(previous?.createdAt ?? previous?.id ?? "");
    if (!previous || currentOrder >= previousOrder) latest.set(key, { ...label, candidateKey, reviewer, decision });
  }
  const byCandidate = Map.groupBy([...latest.values()], (label) => label.candidateKey);
  const candidatesForAdjudication = [];
  for (const [candidateKey, labels] of byCandidate) {
    if (labels.length < 2) continue;
    const decided = labels.filter((label) => label.decision !== "uncertain");
    const uncertain = labels.some((label) => label.decision === "uncertain" || label.ambiguous === true);
    const disagreement = new Set(decided.map((label) => label.decision)).size > 1;
    if (!uncertain && !disagreement) continue;
    const candidate = candidates.get(candidateKey);
    candidatesForAdjudication.push({
      candidateKey,
      detectorId: candidate.detectorId,
      detectorVersion: candidate.detectorVersion,
      opportunityContextKey: candidate.opportunityContextKey,
      reviewQuestion: candidate.reviewQuestion ?? null,
      timestampSeconds: candidate.timestampSeconds,
      replayFingerprint: candidate.replayFingerprint,
      reason: disagreement ? "reviewer_disagreement" : "ambiguous_or_uncertain",
      reviewerLabels: labels.map((label) => ({
        reviewerId: label.reviewerId ?? label.reviewerEmail,
        verdict: label.verdict ?? null,
        gameplayTruth: label.decision,
        timestampVerified: label.timestampVerified ?? null,
        contextCorrect: label.contextCorrect ?? null,
        coachingRelevance: label.coachingRelevance ?? null,
        ambiguous: label.ambiguous ?? null,
        notes: label.notes ?? "",
        reviewerQualification: label.reviewerQualification ?? null,
        createdAt: label.createdAt ?? null,
      })),
      adjudication: null,
    });
  }
  candidatesForAdjudication.sort((left, right) => left.detectorId.localeCompare(right.detectorId)
    || String(left.opportunityContextKey).localeCompare(String(right.opportunityContextKey))
    || left.candidateKey.localeCompare(right.candidateKey));
  return {
    schemaVersion: "rocket-league-adjudication-queue.v1",
    sourceQueueVersion: reviewQueue?.schemaVersion ?? null,
    sourceReportFingerprint: reviewQueue?.sourceReportFingerprint ?? null,
    labelSetVersion: reviewQueue?.labelSetVersion ?? null,
    labelManualFingerprint: reviewQueue?.labelManualFingerprint ?? null,
    blindToModelDecision: true,
    adjudicator: {
      adjudicatorId: null,
      qualification: null,
      submittedAt: null,
    },
    generatedAt: new Date().toISOString(),
    unresolvedCount: candidatesForAdjudication.length,
    candidates: candidatesForAdjudication,
  };
}

export function buildIndependentReviewPlan(reviewQueue, {
  reviewerSlots = ["reviewer-a", "reviewer-b"],
  rounds = 4,
  labelManualFingerprint,
} = {}) {
  if (!Array.isArray(reviewerSlots) || reviewerSlots.length < 2 || new Set(reviewerSlots).size !== reviewerSlots.length) {
    throw new Error("Independent review requires at least two unique reviewer slots.");
  }
  if (!Number.isInteger(rounds) || rounds < 1) throw new Error("Review rounds must be a positive integer.");
  if (!/^[a-f0-9]{64}$/.test(String(labelManualFingerprint ?? ""))) {
    throw new Error("Independent review requires a SHA-256 label-manual fingerprint.");
  }
  const candidates = reviewQueue?.candidates ?? [];
  if (!candidates.length || new Set(candidates.map((candidate) => candidate.id)).size !== candidates.length) {
    throw new Error("Independent review requires a non-empty queue with unique candidate ids.");
  }
  const assignments = reviewerSlots.map((reviewerSlot) => {
    const ordered = [...candidates].sort((left, right) => {
      const leftHash = createHash("sha256").update(`${reviewerSlot}:${left.id}`).digest("hex");
      const rightHash = createHash("sha256").update(`${reviewerSlot}:${right.id}`).digest("hex");
      return leftHash.localeCompare(rightHash) || left.id.localeCompare(right.id);
    });
    const reviewRounds = Array.from({ length: Math.min(rounds, ordered.length) }, (_, index) => ({
      round: index + 1,
      candidateIds: ordered.filter((_, candidateIndex) => candidateIndex % Math.min(rounds, ordered.length) === index).map((candidate) => candidate.id),
    }));
    return { reviewerSlot, candidateCount: ordered.length, rounds: reviewRounds };
  });
  const reference = new Set(assignments[0].rounds.flatMap((round) => round.candidateIds));
  const identicalCoverage = assignments.every((assignment) => {
    const assigned = new Set(assignment.rounds.flatMap((round) => round.candidateIds));
    return assigned.size === reference.size && [...reference].every((id) => assigned.has(id));
  });
  if (!identicalCoverage) throw new Error("Independent reviewer assignments must cover the exact same candidates.");
  return {
    schemaVersion: "rocket-league-independent-review-plan.v1",
    sourceQueueVersion: reviewQueue.schemaVersion ?? null,
    sourceReportFingerprint: reviewQueue.sourceReportFingerprint ?? null,
    labelSetVersion: reviewQueue.labelSetVersion ?? null,
    labelManualFingerprint,
    blindReview: true,
    reviewerCount: reviewerSlots.length,
    candidatesPerReviewer: candidates.length,
    totalIndependentDecisionsRequired: candidates.length * reviewerSlots.length,
    identicalCandidateCoverage: true,
    assignments,
  };
}

export function buildBlindReviewerPackets(reviewQueue, reviewPlan, reviewMoments) {
  const candidates = reviewQueue?.candidates ?? [];
  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const momentIds = new Set(Object.keys(reviewMoments?.moments ?? {}));
  if (!candidates.length || candidateById.size !== candidates.length) throw new Error("Blind packets require a unique non-empty review queue.");
  if (reviewQueue?.sourceReportFingerprint !== reviewPlan?.sourceReportFingerprint
    || reviewQueue?.labelSetVersion !== reviewPlan?.labelSetVersion) {
    throw new Error("Review plan provenance does not match the source queue.");
  }
  if (!/^[a-f0-9]{64}$/.test(String(reviewPlan?.labelManualFingerprint ?? ""))) {
    throw new Error("Blind packets require a SHA-256 label-manual fingerprint.");
  }
  if (reviewMoments?.candidateCount !== candidates.length || candidates.some((candidate) => !momentIds.has(candidate.id))) {
    throw new Error("Blind packets require one materialized moment for every candidate.");
  }
  const packets = (reviewPlan?.assignments ?? []).map((assignment) => {
    const seen = new Set();
    const rounds = assignment.rounds.map((round) => ({
      round: round.round,
      reviews: round.candidateIds.map((candidateId) => {
        const candidate = candidateById.get(candidateId);
        if (!candidate || seen.has(candidateId)) throw new Error("Reviewer assignment contains a missing or duplicate candidate.");
        seen.add(candidateId);
        return {
          candidateId,
          momentKey: candidateId,
          detectorId: candidate.detectorId,
          detectorVersion: candidate.detectorVersion,
          reviewQuestion: candidate.reviewQuestion,
          replayFingerprint: candidate.replayFingerprint,
          timestampSeconds: candidate.timestampSeconds,
          frame: candidate.frame,
          mode: candidate.mode,
          rankCohort: candidate.rankCohort,
          label: {
            gameplayTruth: null,
            timestampVerified: null,
            contextCorrect: null,
            coachingRelevance: null,
            ambiguous: null,
            notes: "",
          },
        };
      }),
    }));
    if (seen.size !== candidates.length) throw new Error("Reviewer packet does not cover the complete candidate set.");
    const packet = {
      schemaVersion: "rocket-league-blind-reviewer-packet.v1",
      sourceReportFingerprint: reviewQueue.sourceReportFingerprint,
      labelSetVersion: reviewQueue.labelSetVersion,
      labelManualFingerprint: reviewPlan.labelManualFingerprint,
      reviewerSlot: assignment.reviewerSlot,
      reviewer: {
        reviewerId: null,
        qualification: null,
        submittedAt: null,
      },
      blindReview: true,
      candidateCount: seen.size,
      redactionPolicy: "model_decision_and_rationale_removed",
      rounds,
    };
    const serialized = JSON.stringify(packet);
    for (const forbidden of ["opportunityStatus", "classification", "modelEvidence"]) {
      if (serialized.includes(`\"${forbidden}\"`)) throw new Error(`Blind packet leaked ${forbidden}.`);
    }
    return packet;
  });
  if (packets.length < 2 || new Set(packets.map((packet) => packet.reviewerSlot)).size !== packets.length) {
    throw new Error("Blind packets require at least two unique reviewer assignments.");
  }
  return packets;
}

const blindReviewKeys = new Set([
  "candidateId", "momentKey", "detectorId", "detectorVersion", "reviewQuestion",
  "replayFingerprint", "timestampSeconds", "frame", "mode", "rankCohort", "label",
]);
const blindLabelKeys = new Set([
  "gameplayTruth", "timestampVerified", "contextCorrect", "coachingRelevance", "ambiguous", "notes",
]);
const blindPacketKeys = new Set([
  "schemaVersion", "sourceReportFingerprint", "labelSetVersion", "labelManualFingerprint", "reviewerSlot", "reviewer",
  "blindReview", "candidateCount", "redactionPolicy", "rounds",
]);
const blindReviewerKeys = new Set(["reviewerId", "qualification", "submittedAt"]);
const blindRoundKeys = new Set(["round", "reviews"]);

function exactKeys(value, allowed, description) {
  const unexpected = Object.keys(value ?? {}).filter((key) => !allowed.has(key));
  if (unexpected.length) throw new Error(`${description} contains forbidden fields: ${unexpected.join(", ")}.`);
}

function requiredText(value, description) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`${description} is required.`);
  return normalized;
}

function modelOutcome(opportunityStatus, gameplayTruth) {
  if (opportunityStatus === "firing") return gameplayTruth === "present" ? "true_positive" : "false_positive";
  if (opportunityStatus === "non_firing") return gameplayTruth === "present" ? "false_negative" : "true_negative";
  if (opportunityStatus === "abstained") return gameplayTruth === "present" ? "abstained_present" : "abstained_absent";
  throw new Error(`Unsupported opportunity status: ${opportunityStatus}.`);
}

/**
 * Validate two or more independently completed blind packets, retain every
 * source judgment and only then join consensus truth to the hidden model
 * decision. This function fails closed on provenance, coverage or schema drift.
 */
export function mergeBlindReviewerSubmissions(reviewQueue, submissions = []) {
  const queueCandidates = reviewQueue?.candidates ?? [];
  const candidateById = new Map(queueCandidates.map((candidate) => [candidate.id, candidate]));
  if (!queueCandidates.length || candidateById.size !== queueCandidates.length) {
    throw new Error("Blind review merge requires a unique non-empty master queue.");
  }
  if (!reviewQueue?.blindReview || reviewQueue?.holdoutIncluded !== false) {
    throw new Error("Blind review merge accepts only an explicit non-holdout blind queue.");
  }
  if (!Array.isArray(submissions) || submissions.length < 2) {
    throw new Error("Blind review merge requires at least two reviewer submissions.");
  }

  const reviewerSlots = new Set();
  const reviewerIds = new Set();
  const labelManualFingerprints = new Set();
  const labels = [];
  for (const submission of submissions) {
    exactKeys(submission, blindPacketKeys, "Reviewer submission");
    exactKeys(submission?.reviewer, blindReviewerKeys, "Reviewer provenance");
    if (submission?.schemaVersion !== "rocket-league-blind-reviewer-packet.v1" || submission?.blindReview !== true) {
      throw new Error("Reviewer submission has an unsupported schema or is not marked blind.");
    }
    if (submission.sourceReportFingerprint !== reviewQueue.sourceReportFingerprint
      || submission.labelSetVersion !== reviewQueue.labelSetVersion) {
      throw new Error("Reviewer submission provenance does not match the master queue.");
    }
    if (!/^[a-f0-9]{64}$/.test(String(submission.labelManualFingerprint ?? ""))) {
      throw new Error("Reviewer submission lacks a valid label-manual fingerprint.");
    }
    labelManualFingerprints.add(submission.labelManualFingerprint);
    const reviewerSlot = requiredText(submission.reviewerSlot, "Reviewer slot");
    const reviewerId = requiredText(submission.reviewer?.reviewerId, `Reviewer id for ${reviewerSlot}`).toLowerCase();
    const reviewerQualification = requiredText(submission.reviewer?.qualification, `Reviewer qualification for ${reviewerSlot}`);
    const submittedAt = requiredText(submission.reviewer?.submittedAt, `Submission timestamp for ${reviewerSlot}`);
    if (Number.isNaN(Date.parse(submittedAt))) throw new Error(`Submission timestamp for ${reviewerSlot} is invalid.`);
    if (reviewerSlots.has(reviewerSlot) || reviewerIds.has(reviewerId)) {
      throw new Error("Reviewer slots and reviewer identities must be unique.");
    }
    reviewerSlots.add(reviewerSlot);
    reviewerIds.add(reviewerId);

    for (const round of submission.rounds ?? []) exactKeys(round, blindRoundKeys, `Round in ${reviewerSlot}`);
    const reviews = (submission.rounds ?? []).flatMap((round) => round?.reviews ?? []);
    if (reviews.length !== queueCandidates.length || submission.candidateCount !== queueCandidates.length) {
      throw new Error(`Reviewer ${reviewerSlot} does not cover the complete candidate set.`);
    }
    const seen = new Set();
    for (const review of reviews) {
      exactKeys(review, blindReviewKeys, `Review in ${reviewerSlot}`);
      exactKeys(review.label, blindLabelKeys, `Label in ${reviewerSlot}`);
      const candidate = candidateById.get(review.candidateId);
      if (!candidate || seen.has(review.candidateId)) {
        throw new Error(`Reviewer ${reviewerSlot} contains a missing or duplicate candidate.`);
      }
      seen.add(review.candidateId);
      const immutablePairs = [
        ["momentKey", review.candidateId],
        ["detectorId", candidate.detectorId],
        ["detectorVersion", candidate.detectorVersion],
        ["reviewQuestion", candidate.reviewQuestion],
        ["replayFingerprint", candidate.replayFingerprint],
        ["timestampSeconds", candidate.timestampSeconds],
        ["frame", candidate.frame],
        ["mode", candidate.mode],
        ["rankCohort", candidate.rankCohort],
      ];
      for (const [key, expected] of immutablePairs) {
        if (review[key] !== expected) throw new Error(`Reviewer ${reviewerSlot} changed immutable field ${key}.`);
      }
      const label = review.label ?? {};
      if (!gameplayTruthValues.has(label.gameplayTruth)) throw new Error(`Reviewer ${reviewerSlot} has an incomplete gameplayTruth label.`);
      for (const field of ["timestampVerified", "contextCorrect", "coachingRelevance", "ambiguous"]) {
        if (typeof label[field] !== "boolean") throw new Error(`Reviewer ${reviewerSlot} has an incomplete ${field} label.`);
      }
      const notes = String(label.notes ?? "").trim();
      if ((label.gameplayTruth === "uncertain" || label.ambiguous || !label.timestampVerified) && !notes) {
        throw new Error(`Reviewer ${reviewerSlot} must explain uncertain, ambiguous or timestamp-invalid labels.`);
      }
      labels.push({
        candidateKey: candidate.id,
        detectorId: candidate.detectorId,
        detectorVersion: candidate.detectorVersion,
        opportunityContextKey: candidate.opportunityContextKey,
        reviewerSlot,
        reviewerId,
        reviewerQualification,
        labelSetVersion: reviewQueue.labelSetVersion,
        createdAt: submittedAt,
        gameplayTruth: label.gameplayTruth,
        timestampVerified: label.timestampVerified,
        contextCorrect: label.contextCorrect,
        coachingRelevance: label.coachingRelevance,
        ambiguous: label.ambiguous,
        notes,
      });
    }
  }
  if (labelManualFingerprints.size !== 1) throw new Error("Reviewer submissions used different label manuals.");

  const byCandidate = Map.groupBy(labels, (label) => label.candidateKey);
  const resolvedCandidates = [];
  for (const candidate of queueCandidates) {
    const reviews = byCandidate.get(candidate.id) ?? [];
    if (reviews.length !== submissions.length) throw new Error(`Candidate ${candidate.id} lacks independent review coverage.`);
    const truths = new Set(reviews.map((review) => review.gameplayTruth));
    const needsAdjudication = truths.size !== 1 || truths.has("uncertain") || reviews.some((review) => review.ambiguous);
    if (needsAdjudication) continue;
    const gameplayTruth = reviews[0].gameplayTruth;
    resolvedCandidates.push({
      ...candidate,
      observation: undefined,
      gameplayTruth,
      timestampVerified: reviews.every((review) => review.timestampVerified),
      contextCorrect: reviews.every((review) => review.contextCorrect),
      coachingRelevance: reviews.every((review) => review.coachingRelevance),
      independentReviewCount: reviews.length,
      modelOutcome: modelOutcome(candidate.opportunityStatus, gameplayTruth),
    });
  }
  const labelManualFingerprint = [...labelManualFingerprints][0];
  const adjudicationQueue = buildAdjudicationQueue({ ...reviewQueue, labelManualFingerprint }, labels);
  const reviewerAgreement = reviewerAgreementMetrics(labels);
  const resolvedQueue = {
    schemaVersion: "rocket-league-consensus-opportunity-labels.v1",
    sourceReportFingerprint: reviewQueue.sourceReportFingerprint,
    labelSetVersion: reviewQueue.labelSetVersion,
    labelManualFingerprint,
    holdoutIncluded: false,
    reviewerCount: submissions.length,
    reviewerAgreement,
    labelProvenanceComplete: true,
    candidates: resolvedCandidates,
  };
  const detectorIds = [...new Set(queueCandidates.map((candidate) => candidate.detectorId))].sort();
  return {
    schemaVersion: "rocket-league-blind-review-merge.v1",
    sourceQueueVersion: reviewQueue.schemaVersion ?? null,
    sourceReportFingerprint: reviewQueue.sourceReportFingerprint,
    labelSetVersion: reviewQueue.labelSetVersion,
    labelManualFingerprint,
    holdoutIncluded: false,
    reviewerCount: submissions.length,
    candidateCount: queueCandidates.length,
    independentDecisionCount: labels.length,
    resolvedConsensusCount: resolvedCandidates.length,
    unresolvedAdjudicationCount: adjudicationQueue.unresolvedCount,
    reviewerAgreement,
    reviewerAgreementByStratum: reviewerAgreementByStratum(labels),
    labels,
    resolvedQueue,
    adjudicationQueue,
    detectorMetrics: Object.fromEntries(detectorIds.map((detectorId) => [
      detectorId,
      opportunityMetricsFromLabels(resolvedQueue, detectorId),
    ])),
  };
}

const adjudicationPacketKeys = new Set([
  "schemaVersion", "sourceQueueVersion", "sourceReportFingerprint", "labelSetVersion",
  "labelManualFingerprint", "blindToModelDecision", "adjudicator", "generatedAt",
  "unresolvedCount", "candidates",
]);
const adjudicatorKeys = new Set(["adjudicatorId", "qualification", "submittedAt"]);
const adjudicationCandidateKeys = new Set([
  "candidateKey", "detectorId", "detectorVersion", "opportunityContextKey", "reviewQuestion",
  "timestampSeconds", "replayFingerprint", "reason", "reviewerLabels", "adjudication",
]);
const adjudicationLabelKeys = new Set([
  "gameplayTruth", "timestampVerified", "contextCorrect", "coachingRelevance", "ambiguous", "rationale",
]);

/**
 * Finalize a completed redacted adjudication packet. Source reviews stay
 * immutable; adjudicated gameplay truth is joined to hidden model status only
 * inside the resulting private calibration artifact.
 */
export function finalizeBlindReviewAdjudication(reviewQueue, mergeResult, adjudicationSubmission) {
  if (mergeResult?.schemaVersion !== "rocket-league-blind-review-merge.v1"
    || mergeResult?.sourceReportFingerprint !== reviewQueue?.sourceReportFingerprint
    || mergeResult?.labelSetVersion !== reviewQueue?.labelSetVersion
    || mergeResult?.holdoutIncluded !== false) {
    throw new Error("Blind review merge provenance does not match the master queue.");
  }
  exactKeys(adjudicationSubmission, adjudicationPacketKeys, "Adjudication submission");
  exactKeys(adjudicationSubmission?.adjudicator, adjudicatorKeys, "Adjudicator provenance");
  if (adjudicationSubmission?.schemaVersion !== "rocket-league-adjudication-queue.v1"
    || adjudicationSubmission?.blindToModelDecision !== true
    || adjudicationSubmission?.sourceReportFingerprint !== reviewQueue.sourceReportFingerprint
    || adjudicationSubmission?.labelSetVersion !== reviewQueue.labelSetVersion
    || adjudicationSubmission?.labelManualFingerprint !== mergeResult.labelManualFingerprint) {
    throw new Error("Adjudication provenance does not match the blind review merge.");
  }
  const adjudicatorId = requiredText(adjudicationSubmission.adjudicator?.adjudicatorId, "Adjudicator id").toLowerCase();
  const adjudicatorQualification = requiredText(adjudicationSubmission.adjudicator?.qualification, "Adjudicator qualification");
  const adjudicatedAt = requiredText(adjudicationSubmission.adjudicator?.submittedAt, "Adjudication timestamp");
  if (Number.isNaN(Date.parse(adjudicatedAt))) throw new Error("Adjudication timestamp is invalid.");
  if (new Set((mergeResult.labels ?? []).map((label) => String(label.reviewerId).toLowerCase())).has(adjudicatorId)) {
    throw new Error("Adjudicator must be independent from both source reviewers.");
  }

  const masterById = new Map((reviewQueue.candidates ?? []).map((candidate) => [candidate.id, candidate]));
  const expectedAdjudication = new Map((mergeResult.adjudicationQueue?.candidates ?? []).map((candidate) => [candidate.candidateKey, candidate]));
  const submitted = adjudicationSubmission.candidates ?? [];
  if (submitted.length !== expectedAdjudication.size || adjudicationSubmission.unresolvedCount !== expectedAdjudication.size) {
    throw new Error("Adjudication submission does not cover the exact unresolved set.");
  }
  const seen = new Set();
  const adjudicatedCandidates = [];
  const unresolvedCandidates = [];
  const unresolvedLabeledCandidates = [];
  for (const candidate of submitted) {
    exactKeys(candidate, adjudicationCandidateKeys, "Adjudication candidate");
    const expected = expectedAdjudication.get(candidate.candidateKey);
    const master = masterById.get(candidate.candidateKey);
    if (!expected || !master || seen.has(candidate.candidateKey)) throw new Error("Adjudication contains a missing or duplicate candidate.");
    seen.add(candidate.candidateKey);
    for (const key of ["detectorId", "detectorVersion", "opportunityContextKey", "reviewQuestion", "timestampSeconds", "replayFingerprint", "reason"]) {
      if (candidate[key] !== expected[key]) throw new Error(`Adjudication changed immutable field ${key}.`);
    }
    if (JSON.stringify(candidate.reviewerLabels) !== JSON.stringify(expected.reviewerLabels)) {
      throw new Error("Adjudication changed immutable source reviewer labels.");
    }
    exactKeys(candidate.adjudication, adjudicationLabelKeys, "Adjudication label");
    const label = candidate.adjudication ?? {};
    if (!gameplayTruthValues.has(label.gameplayTruth)) throw new Error("Adjudication has an incomplete gameplayTruth label.");
    for (const field of ["timestampVerified", "contextCorrect", "coachingRelevance", "ambiguous"]) {
      if (typeof label[field] !== "boolean") throw new Error(`Adjudication has an incomplete ${field} label.`);
    }
    const rationale = requiredText(label.rationale, "Adjudication rationale");
    if (label.gameplayTruth === "uncertain" || label.ambiguous || !label.timestampVerified) {
      unresolvedCandidates.push({ candidateKey: candidate.candidateKey, gameplayTruth: label.gameplayTruth, rationale });
      unresolvedLabeledCandidates.push({
        ...master,
        observation: undefined,
        gameplayTruth: "uncertain",
        adjudicatedGameplayTruth: label.gameplayTruth,
        timestampVerified: label.timestampVerified,
        contextCorrect: label.contextCorrect,
        coachingRelevance: label.coachingRelevance,
        resolution: "unresolved_after_adjudication",
        adjudicatorId,
        adjudicatedAt,
        adjudicationRationale: rationale,
      });
      continue;
    }
    adjudicatedCandidates.push({
      ...master,
      observation: undefined,
      gameplayTruth: label.gameplayTruth,
      timestampVerified: label.timestampVerified,
      contextCorrect: label.contextCorrect,
      coachingRelevance: label.coachingRelevance,
      resolution: "adjudicated",
      adjudicatorId,
      adjudicatorQualification,
      adjudicatedAt,
      adjudicationRationale: rationale,
      modelOutcome: modelOutcome(master.opportunityStatus, label.gameplayTruth),
    });
  }
  if (seen.size !== expectedAdjudication.size) throw new Error("Adjudication submission is missing unresolved candidates.");

  const expectedConsensusIds = new Set([...masterById.keys()].filter((candidateId) => !expectedAdjudication.has(candidateId)));
  const consensusCandidates = (mergeResult.resolvedQueue?.candidates ?? []).map((candidate) => {
    const master = masterById.get(candidate.id);
    if (!master || !expectedConsensusIds.has(candidate.id) || !["present", "absent"].includes(candidate.gameplayTruth)) {
      throw new Error("Blind review merge contains an invalid consensus candidate.");
    }
    if (candidate.modelOutcome !== modelOutcome(master.opportunityStatus, candidate.gameplayTruth)) {
      throw new Error("Blind review merge contains an invalid consensus model outcome.");
    }
    return { ...candidate, resolution: "reviewer_consensus" };
  });
  if (consensusCandidates.length !== expectedConsensusIds.size) {
    throw new Error("Blind review merge does not cover the exact consensus set.");
  }
  const resolvedIds = new Set([...consensusCandidates, ...adjudicatedCandidates].map((candidate) => candidate.id));
  if (resolvedIds.size !== consensusCandidates.length + adjudicatedCandidates.length) {
    throw new Error("Finalized labels contain duplicate candidate resolutions.");
  }
  if (resolvedIds.size + unresolvedCandidates.length !== reviewQueue.candidates.length) {
    throw new Error("Finalized labels do not account for the complete master queue.");
  }
  const finalQueue = {
    schemaVersion: "rocket-league-final-opportunity-labels.v1",
    sourceReportFingerprint: reviewQueue.sourceReportFingerprint,
    labelSetVersion: reviewQueue.labelSetVersion,
    labelManualFingerprint: mergeResult.labelManualFingerprint,
    holdoutIncluded: false,
    reviewerCount: mergeResult.reviewerCount,
    reviewerAgreement: mergeResult.reviewerAgreement,
    labelProvenanceComplete: true,
    candidates: [...consensusCandidates, ...adjudicatedCandidates, ...unresolvedLabeledCandidates],
  };
  const detectorIds = [...new Set((reviewQueue.candidates ?? []).map((candidate) => candidate.detectorId))].sort();
  return {
    schemaVersion: "rocket-league-adjudicated-calibration.v1",
    sourceReportFingerprint: reviewQueue.sourceReportFingerprint,
    labelSetVersion: reviewQueue.labelSetVersion,
    labelManualFingerprint: mergeResult.labelManualFingerprint,
    holdoutIncluded: false,
    reviewerCount: mergeResult.reviewerCount,
    adjudicatorId,
    sourceCandidateCount: reviewQueue.candidates.length,
    consensusCount: consensusCandidates.length,
    adjudicatedCount: adjudicatedCandidates.length,
    unresolvedUncertainCount: unresolvedCandidates.length,
    unresolvedCandidates,
    reviewerAgreement: mergeResult.reviewerAgreement,
    reviewerAgreementByStratum: mergeResult.reviewerAgreementByStratum,
    finalQueue,
    detectorMetrics: Object.fromEntries(detectorIds.map((detectorId) => [
      detectorId,
      opportunityMetricsFromLabels(finalQueue, detectorId),
    ])),
  };
}

const reviewQuestions = Object.freeze({
  "boost.low_exposure": "Did low or zero boost materially remove a useful option in this critical context?",
  "boost.large_pad_detour": "Did the large-pad route materially remove the player's useful involvement in the play?",
  "boost.small_pad_blindness": "Was a reachable small-pad route clearly available and materially better than the observed route?",
  "boost.teammate_starvation": "Did this boost pickup materially remove a teammate's needed reserve or coverage option?",
  "rotation.caught_ahead": "Was the player caught ahead of the ball in a way that materially exposed the transition?",
  "rotation.cut": "Did this intervention take a covered teammate's turn and reduce team options?",
  "rotation.same_lane": "Did same-lane positioning duplicate coverage or remove a useful team lane?",
  "rotation.spacing_too_far": "Was the nearest support layer too far away to provide a useful option in this moment?",
  "rotation.back_post_bypass": "Did the defensive route bypass a reachable back-post entry and materially reduce save options?",
  "rotation.goal_side_loss": "Did the player surrender goal-side position and materially weaken the defensive layer?",
  "rotation.backboard_uncovered": "Was a replay-visible backboard threat left without an appropriate defensive layer?",
  "challenge.late": "Was this challenge meaningfully late relative to replay-visible access and consequence?",
  "challenge.fake_opportunity": "Was a fake challenge clearly available and materially better than the observed commitment?",
  "challenge.low_probability_aerial": "Was this aerial commitment low-probability and did it create material team risk?",
  "challenge.advantage_state": "Was this challenge choice materially wrong for the score, clock and coverage state?",
  "recovery.demolition_reentry": "Did the respawn route measurably delay restoration of useful coverage or access?",
  "recovery.play_reentry": "Did the recovery path measurably delay useful re-entry into the live play?",
  "possession.panic_clear": "Did this clear unnecessarily return possession despite replay-visible control space?",
  "possession.touch_frequency": "Did an extra touch materially reduce the next controllable option in this sequence?",
  "offense.shot_quality": "Did this shot have materially lower threat than a replay-visible stronger possession option?",
  "offense.open_net_execution": "Was the net genuinely open, and did the execution fail a materially convertible chance?",
  "offense.pass_lane": "Was a reachable higher-value pass lane clearly available and missed?",
  "offense.follow_up": "Did the team's follow-up structure materially fail after this shot?",
  "offense.backboard_use": "Was a reachable backboard creation option clearly available and materially better?",
  "defense.near_post_trap": "Did near-post positioning materially reduce the player's save or exit options?",
  "defense.corner_overcommit": "Did this defensive-corner commitment materially expose the middle?",
  "defense.goal_line_congestion": "Did goal-line positioning duplicate a teammate's coverage and remove a useful layer?",
  "defense.shadow_distance": "Did the observed shadow distance materially concede the attacker's decisive option?",
  "defense.post_save_recovery": "Did the post-save action fail to create replay-visible relief or team access?",
  "kickoff.cheat_distance": "Was the non-taker's kickoff distance materially wrong for the replay-visible outcome?",
  "kickoff.role_compliance": "Did the subject's kickoff role leave a material immediate coverage gap?",
  "teamplay.support_angle": "Did the support angle materially remove a pass, challenge or coverage option?",
  "teamplay.role_overlap": "Did role overlap materially duplicate responsibility and leave useful space empty?",
  "teamplay.trust_break": "Did the subject override a clearly covered teammate and materially reduce team options?",
  "teamplay.transition_balance": "Did the team transition lack a materially necessary attack-defense layer?",
  "boost.zero_duration": "Did zero boost materially reduce this player's useful options in this moment?",
  "boost.supersonic_waste": "Was boost spent without creating useful additional speed or positional value?",
  "kickoff.speed": "Was this kickoff arrival or contact meaningfully late for the spawn and approach?",
  "possession.first_touch": "Did this first touch give away a stronger controllable option?",
  "challenge.dive": "Was this commitment avoidable and did it create meaningful team risk?",
  "rotation.spacing_too_close": "Did this spacing duplicate a teammate's coverage or reduce reaction time?",
  "teamplay.double_commit": "Did both teammates commit to the same ball without enough layered coverage?",
  "recovery.momentum_loss": "Was this low-speed interval avoidable and did it delay useful re-entry?",
  "possession.first_touch_retention": "Did the first touch surrender control in a comparable, attributable opportunity?",
  "challenge.quality": "Did this challenge lose the player's assigned access while leaving insufficient coverage?",
  "recovery.reentry_quality": "Did this landing measurably delay useful re-entry in the retained detail window?",
  "boost.overfill": "Did this pickup discard material boost without enough route, denial or role value to justify it?",
  "boost.defensive_reserve": "Did the available boost reserve materially remove a needed defensive option at this commitment?",
  "rotation.third_overextension": "Did the defensive last layer overextend beyond recoverable coverage in this decision?",
  "challenge.teammate_coverage": "Did this challenge create material risk because no usable teammate layer covered the next outcome?",
  "challenge.last_player": "Did this last-player challenge create an avoidable open-net or uncontested-access risk?",
  "kickoff.contact": "Did the subject's kickoff contact give the opponent immediate attributable leverage?",
  "possession.giveaway": "Did this low-pressure touch surrender controllable possession to the opponent?",
  "offense.center_to_opponent": "Did this center favor an opponent follow-up over a reachable teammate continuation?",
  "defense.clear_direction": "Did this defensive clear direction enable an avoidable opponent recycle?",
  "recovery.landing_orientation": "Did this landing orientation measurably delay stable, useful movement after contact with the surface?",
  "recovery.post_aerial_exit": "Did the player's post-aerial orientation measurably delay a controlled re-entry into the next play?",
  "recovery.wall_to_ground": "Did this wall-to-ground transition measurably delay stable, useful ground movement?",
  "possession.control_space": "Did this touch execution reduce controllable follow-up space despite a replay-visible controlled option?",
  "possession.wall_control": "Did this wall touch execution surrender a replay-visible controllable continuation?",
});

export function detectorReviewQuestion(detectorId) {
  return reviewQuestions[detectorId] ?? "Is the described behavior present in this gameplay moment?";
}

export function aggregateCalibrationRuns(entries, failures = []) {
  const detectors = new Map();
  for (const entry of entries) {
    const calibrationEligible = entry.evidenceSource === "real_replay";
    for (const run of entry.shadowRuns ?? []) {
      const applicable = run.status !== "not_applicable";
      const aggregate = detectors.get(run.detectorId) ?? {
        detectorId: run.detectorId,
        detectorVersion: run.detectorVersion,
        replayRuns: 0,
        executionErrors: 0,
        replaysWithSignal: 0,
        candidateCount: 0,
        ineligibleReplayRuns: 0,
        notApplicableRuns: 0,
      };
      aggregate.replayRuns += calibrationEligible && applicable ? 1 : 0;
      aggregate.ineligibleReplayRuns += !calibrationEligible && applicable ? 1 : 0;
      aggregate.notApplicableRuns += applicable ? 0 : 1;
      aggregate.executionErrors += run.status === "error" ? 1 : 0;
      aggregate.replaysWithSignal += run.status === "observed" ? 1 : 0;
      aggregate.candidateCount += run.candidateCount ?? 0;
      detectors.set(run.detectorId, aggregate);
    }
  }

  const modes = entries.reduce((counts, entry) => {
    const mode = entry.mode || "unknown";
    counts[mode] = (counts[mode] ?? 0) + 1;
    return counts;
  }, {});
  const detectorResults = [...detectors.values()].map((detector) => ({
    ...detector,
    signalReplayRate: detector.replayRuns ? detector.replaysWithSignal / detector.replayRuns : 0,
    publicQualityGate: assessPublicDetectorGate({ replayCount: detector.replayRuns }),
  }));
  const runtimes = entries.map((entry) => entry.operational?.runtimeMs).filter(Number.isFinite).sort((left, right) => left - right);
  const rssAfter = entries.map((entry) => entry.operational?.rssAfterBytes).filter(Number.isFinite);
  const percentile = (values, fraction) => values.length ? values[Math.min(values.length - 1, Math.ceil(values.length * fraction) - 1)] : null;

  const report = {
    schemaVersion: CALIBRATION_REPORT_VERSION,
    generatedAt: new Date().toISOString(),
    corpus: {
      replayCount: entries.length,
      calibrationEligibleReplayCount: entries.filter((entry) => entry.evidenceSource === "real_replay").length,
      failureCount: failures.length,
      modeMismatchCount: entries.filter((entry) => entry.modeMatchesManifest === false).length,
      attributionVerifiedCount: entries.filter((entry) => entry.attributionState === "verified").length,
      modes,
      totalSampledFrames: entries.reduce((sum, entry) => sum + (entry.sampledFrames ?? 0), 0),
      totalParserEvents: entries.reduce((sum, entry) => sum + (entry.parserEvents ?? 0), 0),
      totalDecisionEvents: entries.reduce((sum, entry) => sum + (entry.decisionEvents ?? 0), 0),
    },
    replays: entries,
    detectors: detectorResults,
    failures,
    operational: {
      measuredReplayCount: runtimes.length,
      totalRuntimeMs: runtimes.length ? runtimes.reduce((sum, value) => sum + value, 0) : null,
      meanRuntimeMs: runtimes.length ? runtimes.reduce((sum, value) => sum + value, 0) / runtimes.length : null,
      p50RuntimeMs: percentile(runtimes, 0.5),
      p95RuntimeMs: percentile(runtimes, 0.95),
      maximumRuntimeMs: runtimes.length ? runtimes.at(-1) : null,
      maximumObservedRssBytes: rssAfter.length ? Math.max(...rssAfter) : null,
      limitation: "RSS is sampled after each replay inside one long-lived calibration process; it is not per-request peak memory.",
    },
    conclusions: {
      parserCoverageEstablished: entries.length > 0 && failures.length === 0,
      publicDetectorsEnabled: detectorResults.filter((detector) => detector.publicQualityGate.eligible).length,
      nextGate: "Add timestamp-reviewed expert labels across representative rank and mode cohorts.",
    },
  };
  return { ...report, reproducibilityFingerprint: calibrationFingerprint(report) };
}

export function buildReviewQueue(calibrationReport) {
  const candidates = [];
  for (const replay of calibrationReport?.replays ?? []) {
    for (const run of replay.shadowRuns ?? []) {
      for (const [index, evidence] of (run.evidence ?? []).entries()) {
        candidates.push({
          id: `${replay.replayFingerprint}:${run.detectorId}@${run.detectorVersion}:${index + 1}`,
          replayFingerprint: replay.replayFingerprint,
          evidenceSource: replay.evidenceSource ?? "unknown",
          mode: replay.mode ?? null,
          rankCohort: replay.rankCohort ?? "unranked-unknown",
          cohortKey: replay.cohortKey ?? `${replay.mode ?? "unknown"}:${replay.rankCohort ?? "unranked-unknown"}`,
          metadataProvenance: replay.metadataProvenance ?? "unknown",
          gameVersion: replay.gameVersion ?? null,
          detectorId: run.detectorId,
          detectorVersion: run.detectorVersion,
          reviewQuestion: detectorReviewQuestion(run.detectorId),
          timestampSeconds: evidence.timeSeconds ?? evidence.startTimeSeconds ?? null,
          frame: evidence.frame ?? evidence.startFrame ?? null,
          observation: evidence,
          label: null,
          timestampVerified: null,
          notes: "",
        });
      }
    }
  }
  return {
    schemaVersion: REVIEW_QUEUE_VERSION,
    sourceReportVersion: calibrationReport?.schemaVersion ?? null,
    generatedAt: new Date().toISOString(),
    candidates,
  };
}

function opportunityCandidates(calibrationReport, detectorIds) {
  const selectedDetectors = new Set(detectorIds);
  const candidates = [];
  for (const replay of calibrationReport?.replays ?? []) {
    for (const contract of replay.opportunityContracts ?? []) {
      if (!selectedDetectors.has(contract.detectorId)) continue;
      for (const evaluation of contract.evaluations ?? []) {
        if (!Number.isFinite(evaluation.timestampSeconds)) continue;
        candidates.push({
          id: `${replay.replayFingerprint}:${contract.detectorId}@${contract.detectorVersion}:${evaluation.opportunityId}`,
          replayFingerprint: replay.replayFingerprint,
          subjectRosterIndex: Number.isInteger(replay.subjectRosterIndex) ? replay.subjectRosterIndex : null,
          evidenceSource: replay.evidenceSource ?? "unknown",
          mode: replay.mode ?? null,
          rankCohort: replay.rankCohort ?? "unranked-unknown",
          cohortKey: replay.cohortKey ?? `${replay.mode ?? "unknown"}:${replay.rankCohort ?? "unranked-unknown"}`,
          metadataProvenance: replay.metadataProvenance ?? "unknown",
          corpusAssignment: replay.corpusAssignment ?? null,
          gameVersion: replay.gameVersion ?? null,
          detectorId: contract.detectorId,
          detectorVersion: contract.detectorVersion,
          opportunityType: contract.opportunityType,
          opportunityStatus: evaluation.status,
          opportunityContextKey: evaluation.contextKey ?? "unknown",
          reviewQuestion: detectorReviewQuestion(contract.detectorId),
          timestampSeconds: evaluation.timestampSeconds,
          frame: evaluation.frame ?? null,
          observation: {
            opportunityStatus: evaluation.status,
            classification: evaluation.classification ?? "unclassified",
            contextKey: evaluation.contextKey ?? "unknown",
            context: evaluation.context ?? {},
            reasons: evaluation.reasons ?? [],
            evidence: evaluation.evidence ?? {},
          },
          label: null,
          gameplayTruth: null,
          timestampVerified: null,
          contextCorrect: null,
          coachingRelevance: null,
          notes: "",
        });
      }
    }
  }
  return candidates.sort((left, right) => (
    left.detectorId.localeCompare(right.detectorId)
    || left.opportunityStatus.localeCompare(right.opportunityStatus)
    || left.opportunityContextKey.localeCompare(right.opportunityContextKey)
    || left.replayFingerprint.localeCompare(right.replayFingerprint)
    || left.timestampSeconds - right.timestampSeconds
    || left.id.localeCompare(right.id)
  ));
}

function balancedOpportunitySample(candidates, perStatus, maxPerReplay) {
  const cohorts = Map.groupBy(candidates, (candidate) => (
    candidate.cohortKey ?? `${candidate.mode ?? "unknown"}:${candidate.rankCohort ?? "unranked-unknown"}`
  ));
  const cohortStates = [...cohorts.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([cohortKey, rows]) => {
    const contexts = Map.groupBy(rows, (candidate) => candidate.opportunityContextKey);
    const contextKeys = [...contexts.keys()].sort();
    return {
      cohortKey,
      contexts,
      contextKeys,
      cursors: new Map(contextKeys.map((key) => [key, 0])),
      nextContext: 0,
    };
  });
  const replayCounts = new Map();
  const selected = [];
  while (selected.length < perStatus) {
    let added = false;
    for (const state of cohortStates) {
      let cohortAdded = false;
      for (let attempt = 0; attempt < state.contextKeys.length; attempt += 1) {
        const contextIndex = (state.nextContext + attempt) % state.contextKeys.length;
        const contextKey = state.contextKeys[contextIndex];
        const rows = state.contexts.get(contextKey) ?? [];
        let cursor = state.cursors.get(contextKey) ?? 0;
        while (cursor < rows.length) {
          const candidate = rows[cursor++];
          const replayKey = `${candidate.detectorId}:${candidate.opportunityStatus}:${candidate.replayFingerprint}`;
          if ((replayCounts.get(replayKey) ?? 0) >= maxPerReplay) continue;
          replayCounts.set(replayKey, (replayCounts.get(replayKey) ?? 0) + 1);
          selected.push(candidate);
          added = true;
          cohortAdded = true;
          state.nextContext = (contextIndex + 1) % state.contextKeys.length;
          break;
        }
        state.cursors.set(contextKey, cursor);
        if (cohortAdded) break;
      }
      if (selected.length >= perStatus) break;
    }
    if (!added) break;
  }
  return selected;
}

/**
 * Builds a new, blind review queue from the complete opportunity denominator.
 * The historical candidate-only queue remains a separate locked artifact.
 */
export function buildOpportunityReviewQueue(calibrationReport, {
  detectorIds = FOUNDATION_DETECTOR_IDS,
  perStatus = 40,
  maxPerReplay = 2,
  labelSetVersion = "rocket-league-expert-labels.v4-opportunity",
} = {}) {
  if (!Number.isInteger(perStatus) || perStatus < 1) throw new Error("perStatus must be a positive integer.");
  if (!Number.isInteger(maxPerReplay) || maxPerReplay < 1) throw new Error("maxPerReplay must be a positive integer.");
  const sourceReplays = calibrationReport?.replays ?? [];
  if (!sourceReplays.length) throw new Error("Opportunity review queue requires a non-empty calibration_dev report.");
  if (!String(calibrationReport?.reproducibilityFingerprint ?? "").trim()) {
    throw new Error("Opportunity review queue requires a reproducibility fingerprint.");
  }
  const invalidAssignments = [...new Set(sourceReplays
    .map((replay) => replay.corpusAssignment ?? "missing")
    .filter((assignment) => assignment !== "calibration_dev"))];
  if (invalidAssignments.length) {
    throw new Error(`Opportunity review queue accepts only explicit calibration_dev assignments; rejected: ${invalidAssignments.join(", ")}.`);
  }
  if (sourceReplays.some((replay) => replay.evidenceSource !== "real_replay")) {
    throw new Error("Opportunity review queue accepts only real_replay evidence.");
  }
  if (sourceReplays.some((replay) => replay.attributionState !== "verified")) {
    throw new Error("Opportunity review queue requires verified player attribution for every replay.");
  }
  if (sourceReplays.some((replay) => replay.modeMatchesManifest === false)) {
    throw new Error("Opportunity review queue rejects replay/manifest mode mismatches.");
  }
  if (sourceReplays.some((replay) => (replay.opportunityContracts ?? []).some((contract) => contract.summary?.integrityPassed === false
    || Number(contract.summary?.duplicateOpportunitiesDropped ?? 0) > 0))) {
    throw new Error("Opportunity review queue rejects duplicate or integrity-failed opportunity contracts.");
  }
  const replayFingerprints = sourceReplays.map((replay) => replay.replayFingerprint);
  if (replayFingerprints.some((fingerprint) => !fingerprint) || new Set(replayFingerprints).size !== replayFingerprints.length) {
    throw new Error("Opportunity review queue requires unique replay fingerprints.");
  }
  const complete = opportunityCandidates(calibrationReport, detectorIds);
  const groups = Map.groupBy(complete, (candidate) => `${candidate.detectorId}:${candidate.opportunityStatus}`);
  const candidates = [...groups.entries()].flatMap(([, rows]) => balancedOpportunitySample(rows, perStatus, maxPerReplay));
  const statusCounts = Object.fromEntries([...Map.groupBy(candidates, (candidate) => candidate.opportunityStatus).entries()]
    .map(([key, rows]) => [key, rows.length]));
  const detectorStatusCounts = Object.fromEntries([...Map.groupBy(candidates, (candidate) => candidate.detectorId).entries()]
    .map(([detectorId, rows]) => [detectorId, Object.fromEntries([...Map.groupBy(rows, (candidate) => candidate.opportunityStatus).entries()]
      .map(([status, statusRows]) => [status, statusRows.length]))]));
  return {
    schemaVersion: OPPORTUNITY_REVIEW_QUEUE_VERSION,
    sourceReportVersion: calibrationReport?.schemaVersion ?? null,
    sourceReportFingerprint: calibrationReport?.reproducibilityFingerprint ?? null,
    generatedAt: new Date().toISOString(),
    labelSetVersion: String(labelSetVersion),
    sourceCorpusAssignment: "calibration_dev",
    holdoutIncluded: false,
    blindReview: true,
    selection: {
      detectorIds: [...detectorIds],
      strategy: "Hierarchical round-robin across mode/rank cohorts and then opportunity contexts, with a per-replay cap, sampled separately for firing, non-firing and abstained decisions.",
      requestedPerDetectorStatus: perStatus,
      maxPerReplayPerDetectorStatus: maxPerReplay,
      availableCandidates: complete.length,
      selectedCandidates: candidates.length,
      statusCounts,
      detectorStatusCounts,
    },
    candidates,
  };
}

/**
 * Merge shard-local candidate pools without ever materializing one giant
 * calibration report. The final sampling pass is global and uses the exact
 * same cohort/context balancing and replay cap as an unsharded queue.
 */
export function mergeOpportunityReviewQueues(queues, {
  sourceReportFingerprint,
  sourceShardFingerprints = [],
  perStatus = 40,
  maxPerReplay = 2,
} = {}) {
  if (!Array.isArray(queues) || !queues.length) throw new Error("At least one shard review queue is required.");
  if (!/^[a-f0-9]{64}$/.test(String(sourceReportFingerprint ?? ""))) {
    throw new Error("Merged review queue requires the combined shard-manifest fingerprint.");
  }
  if (!Number.isInteger(perStatus) || perStatus < 1 || !Number.isInteger(maxPerReplay) || maxPerReplay < 1) {
    throw new Error("Merged review queue limits must be positive integers.");
  }
  const reference = queues[0];
  for (const queue of queues) {
    if (queue.schemaVersion !== OPPORTUNITY_REVIEW_QUEUE_VERSION
      || queue.sourceReportVersion !== reference.sourceReportVersion
      || queue.labelSetVersion !== reference.labelSetVersion
      || queue.sourceCorpusAssignment !== "calibration_dev"
      || queue.holdoutIncluded !== false
      || queue.blindReview !== true) {
      throw new Error("Shard review queues have incompatible or unsafe provenance.");
    }
  }
  const actualShardFingerprints = queues.map((queue) => queue.sourceReportFingerprint).sort();
  const expectedShardFingerprints = [...sourceShardFingerprints].sort();
  if (expectedShardFingerprints.length && JSON.stringify(actualShardFingerprints) !== JSON.stringify(expectedShardFingerprints)) {
    throw new Error("Shard review queue fingerprints do not match the calibration shard manifest.");
  }
  const candidates = queues.flatMap((queue) => queue.candidates ?? []);
  const candidateIds = candidates.map((candidate) => candidate.id);
  if (candidateIds.some((id) => !id) || new Set(candidateIds).size !== candidateIds.length) {
    throw new Error("Shard review candidates must be unique.");
  }
  const orderedCandidates = candidates.sort((left, right) => (
    left.detectorId.localeCompare(right.detectorId)
    || left.opportunityStatus.localeCompare(right.opportunityStatus)
    || left.opportunityContextKey.localeCompare(right.opportunityContextKey)
    || left.replayFingerprint.localeCompare(right.replayFingerprint)
    || left.timestampSeconds - right.timestampSeconds
    || left.id.localeCompare(right.id)
  ));
  const groups = Map.groupBy(orderedCandidates, (candidate) => `${candidate.detectorId}:${candidate.opportunityStatus}`);
  const selected = [...groups.values()].flatMap((rows) => balancedOpportunitySample(rows, perStatus, maxPerReplay));
  const detectorIds = [...new Set(queues.flatMap((queue) => queue.selection?.detectorIds ?? []))].sort();
  const statusCounts = Object.fromEntries([...Map.groupBy(selected, (candidate) => candidate.opportunityStatus).entries()]
    .map(([key, rows]) => [key, rows.length]));
  const detectorStatusCounts = Object.fromEntries([...Map.groupBy(selected, (candidate) => candidate.detectorId).entries()]
    .map(([detectorId, rows]) => [detectorId, Object.fromEntries([...Map.groupBy(rows, (candidate) => candidate.opportunityStatus).entries()]
      .map(([status, statusRows]) => [status, statusRows.length]))]));
  return {
    schemaVersion: OPPORTUNITY_REVIEW_QUEUE_VERSION,
    sourceReportVersion: reference.sourceReportVersion,
    sourceReportFingerprint,
    sourceShardReportFingerprints: actualShardFingerprints,
    generatedAt: new Date().toISOString(),
    labelSetVersion: reference.labelSetVersion,
    sourceCorpusAssignment: "calibration_dev",
    holdoutIncluded: false,
    blindReview: true,
    selection: {
      detectorIds,
      strategy: "Global hierarchical round-robin over shard-local complete candidate pools, balanced across mode/rank cohorts and opportunity contexts with a per-replay cap.",
      requestedPerDetectorStatus: perStatus,
      maxPerReplayPerDetectorStatus: maxPerReplay,
      availableCandidates: queues.reduce((sum, queue) => sum + (queue.selection?.availableCandidates ?? 0), 0),
      candidatePoolSize: candidates.length,
      selectedCandidates: selected.length,
      statusCounts,
      detectorStatusCounts,
    },
    candidates: selected,
  };
}

/**
 * Creates a bounded first-pass work session from a larger private opportunity
 * queue. Model status is used only for hidden stratification and remains
 * redacted from exported reviewer packets.
 */
export function buildReviewWorkSession(reviewQueue, reviewMoments, {
  perDetector = 8,
  rareFiringThreshold = 12,
  labelSetVersion = "rocket-league-expert-labels.v11-all-60-context-0.9",
} = {}) {
  if (!Number.isInteger(perDetector) || perDetector < 6) {
    throw new Error("Review work sessions require at least six candidates per detector.");
  }
  if (!Number.isInteger(rareFiringThreshold) || rareFiringThreshold < 1) {
    throw new Error("rareFiringThreshold must be a positive integer.");
  }
  if (reviewQueue?.schemaVersion !== OPPORTUNITY_REVIEW_QUEUE_VERSION
    || reviewQueue?.sourceCorpusAssignment !== "calibration_dev"
    || reviewQueue?.holdoutIncluded !== false
    || reviewQueue?.blindReview !== true) {
    throw new Error("Review work sessions require a blind calibration_dev opportunity queue with no holdout data.");
  }
  const sourceCandidates = reviewQueue.candidates ?? [];
  const sourceIds = sourceCandidates.map((candidate) => candidate.id);
  if (!sourceIds.length || new Set(sourceIds).size !== sourceIds.length) {
    throw new Error("Review work sessions require unique source candidates.");
  }
  if (!["rocket-league-review-moments.v2", "rocket-league-review-moments.v3"].includes(reviewMoments?.schemaVersion)
    || sourceCandidates.some((candidate) => !reviewMoments.moments?.[candidate.id])) {
    throw new Error("Review work sessions require a materialized moment for every source candidate.");
  }

  const statusOrder = ["firing", "non_firing", "abstained"];
  const selected = [];
  const rareDetectors = [];
  const detectorGroups = [...Map.groupBy(sourceCandidates, (candidate) => candidate.detectorId).entries()]
    .sort(([left], [right]) => left.localeCompare(right));

  for (const [detectorId, detectorCandidates] of detectorGroups) {
    const byStatus = Map.groupBy(detectorCandidates, (candidate) => candidate.opportunityStatus);
    const chosen = [];
    const chosenIds = new Set();
    const add = (rows) => {
      for (const row of rows) {
        if (chosenIds.has(row.id)) continue;
        chosenIds.add(row.id);
        chosen.push(row);
      }
    };
    const sample = (status, count) => balancedOpportunitySample(
      (byStatus.get(status) ?? []).filter((candidate) => !chosenIds.has(candidate.id)),
      Math.max(0, count),
      1,
    );
    const firing = byStatus.get("firing") ?? [];
    if (firing.length > 0 && firing.length <= rareFiringThreshold) {
      rareDetectors.push({ detectorId, availableFirings: firing.length });
      add(firing);
      if (firing.length <= perDetector) {
        const remaining = perDetector - firing.length;
        add(sample("non_firing", Math.ceil(remaining / 2)));
        add(sample("abstained", Math.floor(remaining / 2)));
      } else {
        add(sample("non_firing", 2));
        add(sample("abstained", 2));
      }
    } else {
      const base = Math.floor(perDetector / statusOrder.length);
      const remainder = perDetector % statusOrder.length;
      statusOrder.forEach((status, index) => add(sample(status, base + (index < remainder ? 1 : 0))));
    }

    let fillIndex = 0;
    while (chosen.length < perDetector) {
      const before = chosen.length;
      add(sample(statusOrder[fillIndex % statusOrder.length], 1));
      fillIndex += 1;
      if (fillIndex >= statusOrder.length && chosen.length === before) {
        const fallback = detectorCandidates.find((candidate) => !chosenIds.has(candidate.id));
        if (!fallback) break;
        add([fallback]);
        fillIndex = 0;
      }
    }
    if (chosen.length < perDetector) {
      throw new Error(`${detectorId} has only ${chosen.length} usable review candidates; ${perDetector} are required.`);
    }
    selected.push(...chosen);
  }

  const detectorStatusCounts = Object.fromEntries([...Map.groupBy(selected, (candidate) => candidate.detectorId).entries()]
    .map(([detectorId, rows]) => [detectorId, Object.fromEntries([...Map.groupBy(rows, (candidate) => candidate.opportunityStatus).entries()]
      .map(([status, statusRows]) => [status, statusRows.length]))]));
  const candidates = selected.map((candidate) => structuredClone(candidate));
  const moments = Object.fromEntries(candidates.map((candidate) => [candidate.id, reviewMoments.moments[candidate.id]]));
  return {
    queue: {
      ...reviewQueue,
      generatedAt: new Date().toISOString(),
      labelSetVersion: String(labelSetVersion),
      sourceQueueLabelSetVersion: reviewQueue.labelSetVersion,
      selection: {
        strategy: "Deterministic first-pass review: eight balanced firing/non-firing/abstained candidates per detector, while retaining every rare firing plus control examples.",
        requestedPerDetector: perDetector,
        rareFiringThreshold,
        selectedCandidates: candidates.length,
        detectorCount: detectorGroups.length,
        rareDetectors,
        detectorStatusCounts,
      },
      candidates,
    },
    moments: {
      ...reviewMoments,
      generatedAt: new Date().toISOString(),
      replayCount: new Set(candidates.map((candidate) => candidate.replayFingerprint)).size,
      candidateCount: candidates.length,
      missingCandidateCount: 0,
      missingReplays: [],
      moments,
    },
  };
}

export function opportunityMetricsFromLabels(reviewQueue, detectorId) {
  const reviewed = (reviewQueue?.candidates ?? []).filter((candidate) => (
    candidate.detectorId === detectorId
    && ["present", "absent", "uncertain"].includes(candidate.gameplayTruth)
  ));
  const decided = reviewed.filter((candidate) => candidate.gameplayTruth !== "uncertain");
  const scored = decided.filter((candidate) => ["firing", "non_firing"].includes(candidate.opportunityStatus));
  const positive = (candidate) => candidate.gameplayTruth === "present";
  const firing = (candidate) => candidate.opportunityStatus === "firing";
  const nonFiring = (candidate) => candidate.opportunityStatus === "non_firing";
  const truePositives = scored.filter((candidate) => firing(candidate) && positive(candidate)).length;
  const falsePositives = scored.filter((candidate) => firing(candidate) && !positive(candidate)).length;
  const trueNegatives = scored.filter((candidate) => nonFiring(candidate) && !positive(candidate)).length;
  const falseNegatives = scored.filter((candidate) => nonFiring(candidate) && positive(candidate)).length;
  const abstentions = reviewed.filter((candidate) => candidate.opportunityStatus === "abstained");
  const interval = (successes, total) => {
    if (!total) return { lower: null, upper: null };
    const lower = wilsonLowerBound(successes, total);
    const upper = 1 - wilsonLowerBound(total - successes, total);
    return { lower, upper };
  };
  const predictedPositive = truePositives + falsePositives;
  const actualPositive = truePositives + falseNegatives;
  const actualNegative = trueNegatives + falsePositives;
  const abstentionUncertain = abstentions.filter((candidate) => candidate.gameplayTruth === "uncertain").length;
  const uncertainReviewed = reviewed.filter((candidate) => candidate.gameplayTruth === "uncertain").length;
  const cohortCounts = scored.reduce((counts, candidate) => {
    const key = candidate.cohortKey ?? `${candidate.mode ?? "unknown"}:${candidate.rankCohort ?? "unranked-unknown"}`;
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
  const coveredCohortCounts = Object.entries(cohortCounts)
    .filter(([key]) => !key.startsWith("unknown:") && !key.endsWith(":unranked-unknown"))
    .map(([, count]) => count);
  return {
    reviewedOpportunities: reviewed.length,
    decidedOpportunities: decided.length,
    scoredOpportunities: scored.length,
    replayCount: new Set(scored.map((candidate) => candidate.replayFingerprint).filter(Boolean)).size,
    reviewedPositives: scored.filter(positive).length,
    reviewedNegatives: scored.filter((candidate) => !positive(candidate)).length,
    truePositives,
    falsePositives,
    trueNegatives,
    falseNegatives,
    precision: predictedPositive ? truePositives / predictedPositive : null,
    precision95: interval(truePositives, predictedPositive),
    recall: actualPositive ? truePositives / actualPositive : null,
    recall95: interval(truePositives, actualPositive),
    specificity: actualNegative ? trueNegatives / actualNegative : null,
    specificity95: interval(trueNegatives, actualNegative),
    falsePositiveRate: actualNegative ? falsePositives / actualNegative : null,
    falsePositiveRate95: interval(falsePositives, actualNegative),
    timestampVerifiedRate: scored.length
      ? scored.filter((candidate) => candidate.timestampVerified === true).length / scored.length
      : null,
    rankModeCohorts: coveredCohortCounts.length,
    cohortCounts,
    minimumCohortSamples: coveredCohortCounts.length ? Math.min(...coveredCohortCounts) : 0,
    uncertainReviewed,
    uncertainRate: reviewed.length ? uncertainReviewed / reviewed.length : null,
    uncertainRate95: interval(uncertainReviewed, reviewed.length),
    abstentionReviewed: abstentions.length,
    abstentionUncertainRate: abstentions.length
      ? abstentionUncertain / abstentions.length
      : null,
    abstentionUncertainRate95: interval(abstentionUncertain, abstentions.length),
    independentReviewers: reviewQueue?.reviewerCount ?? null,
    reviewerAgreement: reviewQueue?.reviewerAgreement?.rawAgreement ?? reviewQueue?.reviewerAgreement ?? null,
    labelProvenanceComplete: reviewQueue?.labelProvenanceComplete === true,
    expertLabelSetVersion: reviewQueue?.labelSetVersion ?? null,
  };
}

export function calibrationMetricsFromLabels(reviewQueue, detectorId, labelHistory = []) {
  const candidates = (reviewQueue?.candidates ?? []).filter((candidate) => (
    candidate.detectorId === detectorId && candidate.evidenceSource === "real_replay"
  ));
  const confirmed = candidates.filter((candidate) => candidate.label === "confirmed");
  const rejected = candidates.filter((candidate) => candidate.label === "rejected");
  const reviewed = [...confirmed, ...rejected];
  const cohortCounts = reviewed.reduce((counts, candidate) => {
    const key = candidate.cohortKey ?? `${candidate.mode ?? "unknown"}:${candidate.rankCohort ?? "unranked-unknown"}`;
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
  const relevantHistory = labelHistory.filter((label) => !label.detectorId || label.detectorId === detectorId);
  const agreement = reviewerAgreementMetrics(relevantHistory);
  const decidedHistory = relevantHistory.filter((label) => decidedVerdicts.has(label.verdict));
  const coveredCohortCounts = Object.entries(cohortCounts)
    .filter(([key]) => !key.startsWith("unknown:") && !key.endsWith(":unranked-unknown"))
    .map(([, count]) => count);
  return {
    replayCount: new Set(reviewed.map((candidate) => candidate.replayFingerprint)).size,
    reviewedPositives: confirmed.length,
    reviewedNegatives: rejected.length,
    candidateConfirmationRate: reviewed.length ? confirmed.length / reviewed.length : null,
    candidateConfirmationRateLowerBound: wilsonLowerBound(confirmed.length, reviewed.length),
    precision: null,
    precisionLowerBound: null,
    falsePositiveRate: null,
    recall: null,
    timestampVerifiedRate: reviewed.length
      ? reviewed.filter((candidate) => candidate.timestampVerified === true).length / reviewed.length
      : null,
    rankModeCohorts: Object.keys(cohortCounts).filter((key) => !key.startsWith("unknown:") && !key.endsWith(":unranked-unknown")).length,
    cohortCounts,
    minimumCohortSamples: coveredCohortCounts.length ? Math.min(...coveredCohortCounts) : 0,
    independentReviewers: agreement.independentReviewers,
    reviewerAgreement: agreement.rawAgreement,
    reviewerRawAgreement: agreement.rawAgreement,
    doubleReviewedCandidates: agreement.doubleReviewedCandidates,
    labelProvenanceComplete: decidedHistory.length > 0 && decidedHistory.every((label) => (
      (label.reviewerId || label.reviewerEmail)
      && label.reviewerQualification
      && label.labelSetVersion
      && label.createdAt
    )),
    expertLabelSetVersion: reviewQueue?.labelSetVersion ?? null,
    patchRegressionPassed: reviewQueue?.patchRegressionPassed === true,
    versionDriftPassed: reviewQueue?.versionDriftPassed === true,
    confidenceCalibrationPassed: reviewQueue?.confidenceCalibrationPassed === true,
    reproducibilityPassed: reviewQueue?.reproducibilityPassed === true,
    detectorDependenciesPassed: reviewQueue?.detectorDependenciesPassed === true,
    conflictResolutionTested: reviewQueue?.conflictResolutionTested === true,
    abstentionRuleTested: reviewQueue?.abstentionRuleTested === true,
  };
}
