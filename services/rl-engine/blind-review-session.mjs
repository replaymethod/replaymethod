export const BLIND_REVIEW_SESSION_VERSION = "rocket-league-blind-review-session@0.1.0";

const truthValues = new Set(["present", "absent", "uncertain"]);
const forbiddenModelFields = new Set([
  "opportunityStatus", "classification", "modelOutcome", "modelEvidence",
]);

function clone(value) {
  return structuredClone(value);
}

function reviews(packet) {
  return (packet?.rounds ?? []).flatMap((round) => round.reviews ?? []);
}

function findForbiddenField(value) {
  if (!value || typeof value !== "object") return null;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenModelFields.has(key)) return key;
    const nested = findForbiddenField(child);
    if (nested) return nested;
  }
  return null;
}

export function validateBlindReviewAssets(packet, moments) {
  if (packet?.schemaVersion !== "rocket-league-blind-reviewer-packet.v1"
    || packet?.blindReview !== true
    || packet?.redactionPolicy !== "model_decision_and_rationale_removed") {
    throw new Error("Review session requires a redacted blind reviewer packet.");
  }
  const forbidden = findForbiddenField(packet);
  if (forbidden) throw new Error(`Review packet leaked forbidden model field: ${forbidden}.`);
  const rows = reviews(packet);
  const ids = rows.map((review) => review.candidateId);
  if (!rows.length || rows.length !== packet.candidateCount || new Set(ids).size !== rows.length) {
    throw new Error("Review packet candidate coverage is incomplete or duplicated.");
  }
  if (moments?.schemaVersion !== "rocket-league-review-moments.v2") {
    throw new Error("Review session requires a versioned anonymized moment artifact.");
  }
  const missing = ids.filter((id) => !moments.moments?.[id]);
  if (missing.length) throw new Error(`Review moments are missing ${missing.length} assigned candidates.`);
  return {
    reviewerSlot: packet.reviewerSlot,
    candidateCount: rows.length,
    roundCount: packet.rounds.length,
    labelSetVersion: packet.labelSetVersion,
    labelManualFingerprint: packet.labelManualFingerprint,
  };
}

export function normalizeBlindLabel(label) {
  const gameplayTruth = String(label?.gameplayTruth ?? "");
  if (!truthValues.has(gameplayTruth)) throw new Error("gameplayTruth must be present, absent or uncertain.");
  for (const key of ["timestampVerified", "contextCorrect", "coachingRelevance", "ambiguous"]) {
    if (typeof label?.[key] !== "boolean") throw new Error(`${key} must be true or false.`);
  }
  const notes = String(label?.notes ?? "").trim();
  if ((gameplayTruth === "uncertain" || label.ambiguous) && !notes) {
    throw new Error("Uncertain or ambiguous decisions require a concrete note.");
  }
  return {
    gameplayTruth,
    timestampVerified: label.timestampVerified,
    contextCorrect: label.contextCorrect,
    coachingRelevance: label.coachingRelevance,
    ambiguous: label.ambiguous,
    notes,
  };
}

export function applyBlindReviewDecision(packet, candidateId, label) {
  const next = clone(packet);
  const row = reviews(next).find((review) => review.candidateId === candidateId);
  if (!row) throw new Error("Candidate is not assigned to this reviewer packet.");
  row.label = normalizeBlindLabel(label);
  next.reviewer.submittedAt = null;
  return next;
}

export function reviewProgress(packet) {
  const rows = reviews(packet);
  const complete = rows.filter((review) => truthValues.has(review.label?.gameplayTruth)
    && ["timestampVerified", "contextCorrect", "coachingRelevance", "ambiguous"]
      .every((key) => typeof review.label?.[key] === "boolean")).length;
  return { complete, total: rows.length, remaining: rows.length - complete };
}

export function finalizeBlindReviewPacket(packet, { reviewerId, qualification, submittedAt = new Date().toISOString() }) {
  const progress = reviewProgress(packet);
  if (!progress.total || progress.remaining) throw new Error(`Cannot finalize with ${progress.remaining} incomplete decisions.`);
  const normalizedReviewerId = String(reviewerId ?? "").trim();
  const normalizedQualification = String(qualification ?? "").trim();
  if (!normalizedReviewerId || !normalizedQualification) throw new Error("Reviewer identity and qualification are required.");
  const timestamp = String(submittedAt ?? "").trim();
  if (!Number.isFinite(Date.parse(timestamp))) throw new Error("submittedAt must be a valid ISO-8601 timestamp.");
  const next = clone(packet);
  next.reviewer = {
    reviewerId: normalizedReviewerId,
    qualification: normalizedQualification,
    submittedAt: timestamp,
  };
  return next;
}

export function reviewAt(packet, moments, index) {
  const rows = reviews(packet);
  if (!Number.isInteger(index) || index < 0 || index >= rows.length) throw new Error("Review index is out of range.");
  const review = rows[index];
  return { index, review, moment: moments.moments[review.momentKey] };
}
