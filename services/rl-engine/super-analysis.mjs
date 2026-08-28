import { detectorDefinition } from "./detector-registry.mjs";

export const SUPER_ANALYSIS_VERSION = "rocket-league-super-analysis@0.2.0";

const profiles = Object.freeze({
  "recovery.landing_orientation": Object.freeze({
    pillar: "mechanics",
    technicalReason: "Landing body alignment and travel direction jointly determine how quickly the car can apply useful acceleration after contact.",
    correctionHypothesis: "Reduce pitch/roll error before contact and align the car's forward axis with the next useful lane.",
    practice: "Chain aerial exits into wheels-first landings from both sides, choosing the next lane before contact.",
    remeasure: ["uprightDeviationDegrees", "forwardToVelocityDegrees", "timeToUsefulSpeed"],
  }),
  "recovery.post_aerial_exit": Object.freeze({
    pillar: "motor_execution",
    technicalReason: "An aerial only finishes when the player can re-enter a useful ground or wall state; delayed heading and speed extend the effective commitment.",
    correctionHypothesis: "Plan the landing surface and exit heading before the final aerial touch.",
    practice: "Repeat aerial touches that must end on a named pad route or defensive lane, not at the touch itself.",
    remeasure: ["timeToUsefulSpeed", "timeToStableHeading", "postLandingPeakSpeed"],
  }),
  "recovery.wall_to_ground": Object.freeze({
    pillar: "motor_execution",
    technicalReason: "A slow wall departure plus a second acceleration delay creates two separate tempo losses in one transition.",
    correctionHypothesis: "Leave the wall on a shallower path and arrive ground-aligned for immediate acceleration.",
    practice: "Alternate wall exits into near-post, midfield and small-pad routes while preserving speed.",
    remeasure: ["wallToGroundSeconds", "timeToUsefulSpeed", "uprightDeviationDegrees"],
  }),
  "possession.control_space": Object.freeze({
    pillar: "ball_control",
    technicalReason: "In low-pressure space, large post-touch separation removes the player's next controlled option and transfers first access.",
    correctionHypothesis: "Match car speed and contact angle to the intended second touch instead of maximizing ball speed.",
    practice: "From identical approaches, alternate catch, carry and purposeful release while keeping a planned second action.",
    remeasure: ["relativeCarBallSpeed", "postTouchCloseControlFraction", "postTouchMedianDistanceToBall"],
  }),
  "possession.wall_control": Object.freeze({
    pillar: "ball_control",
    technicalReason: "Wall control depends on keeping the car-ball separation inside a reachable continuation window after contact.",
    correctionHypothesis: "Reduce relative contact speed and align the approach with the intended wall continuation.",
    practice: "Repeat wall touches where success is two controlled touches or a deliberate release, not height alone.",
    remeasure: ["approachToBallDegrees", "postTouchCloseControlFraction", "postTouchMedianDistanceToBall"],
  }),
});

function privateCandidate(run) {
  const profile = profiles[run.detectorId];
  if (!profile || run.status !== "observed" || !run.candidateCount) return null;
  return {
    detectorId: run.detectorId,
    detectorVersion: run.detectorVersion,
    pillar: profile.pillar,
    publicationStatus: "private_shadow",
    observedWindows: run.candidateCount,
    verifiedObservation: run.evidence?.[0]?.description ?? null,
    technicalReason: profile.technicalReason,
    causalStatus: "kinematic_association_not_controller_input_attribution",
    correctionHypothesis: profile.correctionHypothesis,
    practiceHypothesis: profile.practice,
    remeasureMetrics: profile.remeasure,
    evidence: (run.evidence ?? []).slice(0, 3).map((item) => ({
      timestampSeconds: item.timeSeconds ?? item.timestampSeconds ?? null,
      frame: item.frame ?? null,
      classification: item.classification ?? null,
      contextKey: item.contextKey ?? null,
    })),
  };
}

function reviewOrder(left, right) {
  const leftPhase = detectorDefinition(left.detectorId)?.phase ?? 99;
  const rightPhase = detectorDefinition(right.detectorId)?.phase ?? 99;
  return leftPhase - rightPhase
    || right.observedWindows - left.observedWindows
    || left.detectorId.localeCompare(right.detectorId);
}

function firingMoments(shadowRun) {
  const raw = (shadowRun?.runs ?? []).flatMap((run) => {
    const definition = detectorDefinition(run.detectorId);
    return (run.opportunityContract?.evaluations ?? [])
      .filter((evaluation) => evaluation.status === "firing" && Number.isFinite(evaluation.timestampSeconds))
      .map((evaluation) => ({
        timestampSeconds: evaluation.timestampSeconds,
        frame: evaluation.frame ?? null,
        detectorId: run.detectorId,
        detectorVersion: run.detectorVersion,
        category: definition?.category ?? "unknown",
        duplicateGroup: definition?.duplicateGroup ?? run.detectorId,
        classification: evaluation.classification,
        contextKey: evaluation.contextKey,
      }));
  }).sort((left, right) => left.timestampSeconds - right.timestampSeconds || left.detectorId.localeCompare(right.detectorId));

  const moments = [];
  for (const item of raw) {
    const current = moments.at(-1);
    if (current && Math.abs(current.timestampSeconds - item.timestampSeconds) <= 0.08) {
      if (!current.signals.some((signal) => signal.detectorId === item.detectorId)) current.signals.push(item);
      continue;
    }
    moments.push({ timestampSeconds: item.timestampSeconds, frame: item.frame, signals: [item] });
  }
  return moments;
}

function privateRootCauseCandidates(shadowRun) {
  const moments = firingMoments(shadowRun);
  const chains = [];
  let active = [];
  const finish = () => {
    if (active.length >= 2) {
      const detectorIds = [...new Set(active.flatMap((moment) => moment.signals.map((signal) => signal.detectorId)))];
      const categories = [...new Set(active.flatMap((moment) => moment.signals.map((signal) => signal.category)))];
      if (detectorIds.length >= 2) {
        chains.push({
          id: `chain:${active[0].frame ?? Math.round(active[0].timestampSeconds * 100)}:${active.at(-1).frame ?? Math.round(active.at(-1).timestampSeconds * 100)}`,
          publicationStatus: "private_shadow",
          rootCauseStatus: "temporal_hypothesis_not_causal_proof",
          startTimeSeconds: active[0].timestampSeconds,
          endTimeSeconds: active.at(-1).timestampSeconds,
          durationSeconds: active.at(-1).timestampSeconds - active[0].timestampSeconds,
          detectorIds,
          categories,
          rootCandidate: active[0],
          sequence: active,
          relationship: "observed_before_within_bounded_window",
          limitation: "Temporal order can identify an earlier review target, but it cannot prove that the earlier movement caused the later event.",
        });
      }
    }
    active = [];
  };
  for (const moment of moments) {
    if (!active.length) {
      active = [moment];
      continue;
    }
    const gap = moment.timestampSeconds - active.at(-1).timestampSeconds;
    const duration = moment.timestampSeconds - active[0].timestampSeconds;
    if (gap <= 4 && duration <= 8) active.push(moment);
    else {
      finish();
      active = [moment];
    }
  }
  finish();
  return chains.sort((left, right) => right.sequence.length - left.sequence.length
    || left.startTimeSeconds - right.startTimeSeconds).slice(0, 20);
}

export function composeSuperAnalysis(shadowRun, mechanicsModel) {
  const reviewCandidates = (shadowRun?.runs ?? []).map(privateCandidate).filter(Boolean).sort(reviewOrder);
  const eligibleCandidates = reviewCandidates.filter((candidate) => (
    shadowRun.runs.find((run) => run.detectorId === candidate.detectorId)?.qualityGate?.eligible === true
  ));
  const qualityGateBlocked = eligibleCandidates.length === 0;
  return {
    schemaVersion: SUPER_ANALYSIS_VERSION,
    publicationStatus: qualityGateBlocked ? "private_shadow" : "customer_eligible",
    status: qualityGateBlocked ? "quality_gate_blocked" : "ready",
    primaryFocus: qualityGateBlocked ? null : eligibleCandidates[0],
    supportingFocuses: qualityGateBlocked ? [] : eligibleCandidates.slice(1, 3),
    weeklyPlan: qualityGateBlocked ? {
      status: "withheld_until_quality_gate",
      reason: "A practice prescription cannot be promoted from an unvalidated shadow association.",
    } : {
      status: "ready",
      sessions: [
        { day: 1, focus: eligibleCandidates[0].practiceHypothesis, durationMinutes: 15 },
        { day: 3, focus: "Apply one correction cue in three representative matches.", durationMinutes: 30 },
        { day: 6, focus: `Upload a new replay and remeasure ${eligibleCandidates[0].remeasureMetrics.join(", ")}.`, durationMinutes: 10 },
      ],
    },
    privateReviewCandidates: reviewCandidates,
    privateRootCauseCandidates: privateRootCauseCandidates(shadowRun),
    mechanicsProfile: {
      schemaVersion: mechanicsModel?.schemaVersion ?? null,
      publicationStatus: mechanicsModel?.publicationStatus ?? "private_shadow",
      observedExecutionEvents: mechanicsModel?.summary?.executionEventCounts ?? {},
      measuredTouchEpisodes: mechanicsModel?.summary?.eligibleTouchEpisodes ?? 0,
      measuredRecoveryEpisodes: mechanicsModel?.summary?.eligibleRecoveryEpisodes ?? 0,
      surfaceFractions: mechanicsModel?.summary?.surfaceFractions ?? {},
    },
    evidenceBoundaries: {
      measured: ["car_and_ball_kinematics", "contact_and_recovery_sequences", "bounded_next_access", "spatial_pressure_proxies"],
      inferredWithAbstention: ["control_value", "recovery_cost", "decision_context"],
      notObserved: ["controller_inputs", "camera_view", "communications", "intent", "fatigue", "motor_impairment"],
    },
  };
}
