import { assessPublicDetectorGate } from "./quality-gates.mjs";
import { normalizeMode } from "./context.mjs";
import { adaptiveSamplingSummary } from "./adaptive-sampling.mjs";
import { decisionContextSummary } from "./decision-context.mjs";
import { buildOpportunityContract, opportunityContractSummary } from "./opportunity-contract.mjs";
import { ROCKET_LEAGUE_DETECTOR_CATALOG } from "./detector-catalog.mjs";
import { boostDeltaRawToPercent, boostRawToPercent } from "./boost-units.mjs";
import { mechanicsModelSummary } from "./mechanics-model.mjs";
import { composeSuperAnalysis } from "./super-analysis.mjs";
import { EXPANDED_MEASURING_DETECTORS } from "./expanded-detectors.mjs";

export const SHADOW_RUNTIME_VERSION = "rocket-league-shadow-runtime@0.9.0";
export const DECISION_ENGINE_METADATA_VERSION = "rocket-league-decision-engine-metadata@0.8.0";

function contractEvidence(contract, description) {
  return contract.evaluations.filter((evaluation) => evaluation.status === "firing").slice(0, 20).map((evaluation) => ({
    timeSeconds: evaluation.timestampSeconds,
    frame: evaluation.frame,
    contextKey: evaluation.contextKey,
    classification: evaluation.classification,
    description: description(evaluation),
    ...(evaluation.evidence ?? {}),
  }));
}

function zeroBoostExposureContract(evidence) {
  const detectorId = "boost.zero_duration";
  const detectorVersion = "0.2.0";
  const contract = buildOpportunityContract({
    detectorId,
    detectorVersion,
    opportunityType: "zero_boost_exposure",
    decisionContext: evidence.decisionContext,
    classify(opportunity) {
      const durationSeconds = Number(opportunity.eventFacts?.duration_seconds);
      const item = {
        durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : null,
        endedWithReserve: opportunity.eventFacts?.ended_with_reserve ?? null,
        minimumSpeed: opportunity.eventFacts?.minimum_speed ?? null,
        meanDistanceToBall: opportunity.eventFacts?.mean_distance_to_ball ?? null,
      };
      if (!Number.isFinite(durationSeconds)) return { status: "abstained", classification: "duration_unresolved", reasons: ["The zero-reserve episode duration was unavailable."], evidence: item };
      if (durationSeconds >= 0.5) return { status: "firing", classification: "sustained_zero_reserve", evidence: item };
      if (durationSeconds <= 0.2) return { status: "non_firing", classification: "reserve_restored_immediately", evidence: item };
      return { status: "abstained", classification: "borderline_zero_reserve", reasons: ["The private duration band deliberately abstains on brief zero-reserve episodes."], evidence: item };
    },
  });
  return {
    candidateCount: contract.summary.firingOpportunities,
    measurements: opportunityContractSummary(contract),
    evidence: contractEvidence(contract, (evaluation) => `The subject remained at effectively zero boost for ${Number(evaluation.evidence?.durationSeconds ?? 0).toFixed(2)} seconds of live play.`),
    opportunityContract: contract,
  };
}

function supersonicBoostEfficiency(evidence) {
  const detectorId = "boost.supersonic_waste";
  const detectorVersion = "0.4.0";
  const contract = buildOpportunityContract({
    detectorId,
    detectorVersion,
    opportunityType: "boost_press_efficiency",
    decisionContext: evidence.decisionContext,
    classify(opportunity) {
      const facts = opportunity.eventFacts ?? {};
      const item = {
        boostSpent: Number.isFinite(facts.boost_spent_percent) ? facts.boost_spent_percent : null,
        supersonicFraction: Number.isFinite(facts.supersonic_fraction) ? facts.supersonic_fraction : null,
        speedGain: Number.isFinite(facts.speed_gain) ? facts.speed_gain : null,
        peakSpeed: Number.isFinite(facts.peak_speed) ? facts.peak_speed : null,
        durationSeconds: Number.isFinite(facts.duration_seconds) ? facts.duration_seconds : null,
        sampledFrames: Number.isFinite(facts.sampled_frames) ? facts.sampled_frames : null,
      };
      if (![item.boostSpent, item.supersonicFraction].every(Number.isFinite)) {
        return { status: "abstained", classification: "boost_press_unresolved", reasons: ["Normalized boost spend or speed telemetry was unavailable."], evidence: item };
      }
      if (item.boostSpent >= 2 && item.supersonicFraction >= 0.8 && (!Number.isFinite(item.speedGain) || item.speedGain < 120)) {
        return { status: "firing", classification: "supersonic_press_without_speed_value", evidence: item };
      }
      if (item.supersonicFraction <= 0.25 || (Number.isFinite(item.speedGain) && item.speedGain >= 180)) {
        return { status: "non_firing", classification: "boost_press_created_speed_value", evidence: item };
      }
      return { status: "abstained", classification: "boost_press_value_ambiguous", reasons: ["The press mixed supersonic and acceleration frames, so positional value cannot be inferred safely."], evidence: item };
    },
  });
  return {
    candidateCount: contract.summary.firingOpportunities,
    measurements: opportunityContractSummary(contract),
    evidence: contractEvidence(contract, (evaluation) => `A boost press spent ${Number(evaluation.evidence?.boostSpent ?? 0).toFixed(1)}% while already supersonic without measurable speed value.`),
    opportunityContract: contract,
  };
}

function kickoffSpeedQuality(evidence) {
  const detectorId = "kickoff.speed";
  const detectorVersion = "0.2.0";
  const contract = buildOpportunityContract({
    detectorId,
    detectorVersion,
    opportunityType: "kickoff_speed",
    decisionContext: evidence.decisionContext,
    classify(opportunity) {
      const facts = opportunity.eventFacts ?? {};
      const taker = opportunity.context?.subjectTeam === 0 ? facts.team_zero_taker
        : opportunity.context?.subjectTeam === 1 ? facts.team_one_taker : null;
      const timeToBall = Number(taker?.time_to_ball);
      const spawnPosition = String(taker?.spawn_position ?? "unknown");
      const approach = String(taker?.approach ?? "unknown");
      const bands = spawnPosition.startsWith("diagonal") ? { safe: 2.2, late: 2.35 }
        : spawnPosition.startsWith("off_center") ? { safe: 2.45, late: 2.6 }
          : spawnPosition === "center" ? { safe: 2.65, late: 2.8 } : null;
      const item = { timeToBall: Number.isFinite(timeToBall) ? timeToBall : null, spawnPosition, approach, bands };
      if (!bands || !Number.isFinite(timeToBall)) return { status: "abstained", classification: "kickoff_timing_unresolved", reasons: ["Spawn-specific timing telemetry was unavailable."], evidence: item };
      if (timeToBall >= bands.late) return { status: "firing", classification: "late_for_spawn_band", evidence: item };
      if (timeToBall <= bands.safe) return { status: "non_firing", classification: "within_spawn_timing_band", evidence: item };
      return { status: "abstained", classification: "borderline_spawn_timing", reasons: ["The private spawn-specific timing band deliberately abstains on borderline arrivals."], evidence: item };
    },
  });
  return {
    candidateCount: contract.summary.firingOpportunities,
    measurements: opportunityContractSummary(contract),
    evidence: contractEvidence(contract, (evaluation) => `Kickoff arrival took ${Number(evaluation.evidence?.timeToBall ?? 0).toFixed(2)} seconds from ${evaluation.evidence?.spawnPosition ?? "the recorded spawn"}.`),
    opportunityContract: contract,
  };
}

function firstTouchQuality(evidence) {
  const detectorId = "possession.first_touch";
  const detectorVersion = "0.2.0";
  const contract = buildOpportunityContract({
    detectorId,
    detectorVersion,
    opportunityType: "first_touch_quality",
    decisionContext: evidence.decisionContext,
    classify(opportunity) {
      const action = opportunity.eventFacts?.tags?.find((tag) => tag.group === "action")?.value ?? "unclassified";
      const ballSpeedChange = Number(opportunity.eventFacts?.ball_speed_change);
      const item = { action, ballSpeedChange: Number.isFinite(ballSpeedChange) ? ballSpeedChange : null, nextEventSeconds: opportunity.outcome?.nextEventSeconds ?? null };
      if (opportunity.outcome?.nextTeam === "subject_team") return { status: "non_firing", classification: "useful_team_continuation", evidence: item };
      if (opportunity.outcome?.nextTeam === "opponent") {
        if (opportunity.context?.pressure === "high" && ["boom", "clear"].includes(action)) {
          return { status: "abstained", classification: "forced_relief_touch", reasons: ["High pressure makes a relief touch incomparable to a controllable first touch."], evidence: item };
        }
        if (Number.isFinite(ballSpeedChange) && ballSpeedChange >= 1500) {
          return { status: "firing", classification: "hard_first_touch_conceded_next_control", evidence: item };
        }
        return { status: "abstained", classification: "soft_touch_alternative_unresolved", reasons: ["Opponent control after a softer touch does not prove that a stronger controllable option existed."], evidence: item };
      }
      return { status: "abstained", classification: "first_touch_outcome_unresolved", reasons: ["No attributable next control event occurred inside the bounded window."], evidence: item };
    },
  });
  return {
    candidateCount: contract.summary.firingOpportunities,
    measurements: opportunityContractSummary(contract),
    evidence: contractEvidence(contract, (evaluation) => `A ${evaluation.evidence?.action ?? "first touch"} conceded the next attributable controllable action.`),
    opportunityContract: contract,
  };
}

function challengeDiveQuality(evidence) {
  const detectorId = "challenge.dive";
  const detectorVersion = "0.2.0";
  const contract = buildOpportunityContract({
    detectorId,
    detectorVersion,
    opportunityType: "challenge_dive",
    decisionContext: evidence.decisionContext,
    classify(opportunity) {
      const kind = opportunity.eventFacts?.kind ?? opportunity.sourceEventType;
      const item = {
        kind,
        coverage: opportunity.context?.coverage ?? "unknown",
        defensiveRole: opportunity.context?.defensiveRole ?? "unknown",
        nextTeam: opportunity.outcome?.nextTeam ?? "unknown",
        closestApproachDistance: opportunity.eventFacts?.closest_approach_distance ?? null,
      };
      if (opportunity.sourceEventType === "fifty_fifty") return { status: "non_firing", classification: "challenge_contact_made", evidence: item };
      const exposed = item.coverage === "exposed" || item.defensiveRole === "last_layer" || opportunity.context?.mode === "1v1";
      if (kind === "beaten_to_ball" && item.nextTeam === "opponent" && exposed) return { status: "firing", classification: "uncovered_dive_beaten", evidence: item };
      if (item.nextTeam === "subject_team") return { status: "non_firing", classification: "challenge_recovered_team_access", evidence: item };
      return { status: "abstained", classification: "challenge_intent_or_outcome_unresolved", reasons: ["A whiff can represent a fake, forced miss or recoverable challenge; the retained outcome did not resolve it."], evidence: item };
    },
  });
  return {
    candidateCount: contract.summary.firingOpportunities,
    measurements: opportunityContractSummary(contract),
    evidence: contractEvidence(contract, () => "The subject was beaten on an uncovered challenge and the opponent received the next attributable access."),
    opportunityContract: contract,
  };
}

function teamSpacingDecision(evidence) {
  const detectorId = "rotation.spacing_too_close";
  const detectorVersion = "0.2.0";
  const contract = buildOpportunityContract({
    detectorId,
    detectorVersion,
    opportunityType: "team_spacing_decision",
    decisionContext: evidence.decisionContext,
    classify(opportunity) {
      const distance = opportunity.context?.nearestTeammateDistanceToSubject;
      const sameLane = opportunity.context?.sameLaneTeammates;
      const accessMargin = opportunity.context?.teammateAccessMarginSeconds;
      const item = { nearestTeammateDistance: distance ?? null, sameLaneTeammates: sameLane ?? null, teammateAccessMarginSeconds: accessMargin ?? null };
      if (!Number.isFinite(distance) || !Number.isFinite(sameLane)) return { status: "abstained", classification: "spacing_geometry_unresolved", reasons: ["Teammate distance or lane geometry was unavailable."], evidence: item };
      if (sameLane === 0 || distance >= 1400) return { status: "non_firing", classification: "layered_spacing_available", evidence: item };
      if (distance <= 950 && sameLane > 0 && Number.isFinite(accessMargin) && Math.abs(accessMargin) <= 0.45) {
        return { status: "firing", classification: "close_same_lane_access_duplication", evidence: item };
      }
      return { status: "abstained", classification: "close_but_role_value_unresolved", reasons: ["Close spacing without comparable access timing may still represent a deliberate layer, pass or bump route."], evidence: item };
    },
  });
  return {
    candidateCount: contract.summary.firingOpportunities,
    measurements: opportunityContractSummary(contract),
    evidence: contractEvidence(contract, (evaluation) => `A teammate was ${Number(evaluation.evidence?.nearestTeammateDistance ?? 0).toFixed(0)} uu away in the same lane with comparable ball access.`),
    opportunityContract: contract,
  };
}

function teamCommitmentDecision(evidence) {
  const detectorId = "teamplay.double_commit";
  const detectorVersion = "0.2.0";
  const contract = buildOpportunityContract({
    detectorId,
    detectorVersion,
    opportunityType: "team_commitment_decision",
    decisionContext: evidence.decisionContext,
    classify(opportunity) {
      const item = {
        subjectDistanceToBall: opportunity.subject?.distanceToBall ?? null,
        teammateDistanceToBall: opportunity.context?.nearestTeammateDistanceToBall ?? null,
        subjectTowardBall: opportunity.context?.subjectTowardBall ?? null,
        teammateTowardBall: opportunity.context?.nearestTeammateTowardBall ?? null,
        sameLaneTeammates: opportunity.context?.sameLaneTeammates ?? null,
        teammateAccessMarginSeconds: opportunity.context?.teammateAccessMarginSeconds ?? null,
      };
      if (![item.subjectDistanceToBall, item.teammateDistanceToBall, item.subjectTowardBall, item.teammateTowardBall].every(Number.isFinite)) {
        return { status: "abstained", classification: "commitment_geometry_unresolved", reasons: ["Subject/teammate ball distance or approach velocity was unavailable."], evidence: item };
      }
      if (item.subjectDistanceToBall <= 900 && item.teammateDistanceToBall <= 900 && item.subjectTowardBall >= 250 && item.teammateTowardBall >= 250) {
        return { status: "firing", classification: "simultaneous_close_ball_commitment", evidence: item };
      }
      if (item.sameLaneTeammates === 0 || item.teammateDistanceToBall >= 1600
        || (Number.isFinite(item.teammateAccessMarginSeconds) && Math.abs(item.teammateAccessMarginSeconds) >= 0.75)) {
        return { status: "non_firing", classification: "layered_or_separated_commitment", evidence: item };
      }
      return { status: "abstained", classification: "commitment_overlap_ambiguous", reasons: ["The players approached the same play, but simultaneous material commitment was not established."], evidence: item };
    },
  });
  return {
    candidateCount: contract.summary.firingOpportunities,
    measurements: opportunityContractSummary(contract),
    evidence: contractEvidence(contract, () => "Subject and teammate were simultaneously close to and moving toward the ball."),
    opportunityContract: contract,
  };
}

function recoveryMomentumQuality(evidence) {
  const detectorId = "recovery.momentum_loss";
  const detectorVersion = "0.2.0";
  const contract = buildOpportunityContract({
    detectorId,
    detectorVersion,
    opportunityType: "recovery_reentry",
    decisionContext: evidence.decisionContext,
    classify(opportunity) {
      const timeToUsefulSpeed = opportunity.outcome?.timeToUsefulSpeed;
      const distanceToBall = opportunity.subject?.distanceToBall;
      const item = { timeToUsefulSpeed: timeToUsefulSpeed ?? null, peakSpeed: opportunity.outcome?.peakSpeed ?? null, distanceToBall: distanceToBall ?? null };
      if (Number.isFinite(timeToUsefulSpeed) && timeToUsefulSpeed <= 0.8) return { status: "non_firing", classification: "momentum_restored_promptly", evidence: item };
      if (Number.isFinite(timeToUsefulSpeed) && timeToUsefulSpeed >= 1.2 && Number.isFinite(distanceToBall) && distanceToBall >= 1800) {
        return { status: "firing", classification: "delayed_momentum_restoration", evidence: item };
      }
      return { status: "abstained", classification: "momentum_value_unresolved", reasons: ["The retained landing window did not prove prompt restoration or material momentum loss."], evidence: item };
    },
  });
  return {
    candidateCount: contract.summary.firingOpportunities,
    measurements: opportunityContractSummary(contract),
    evidence: contractEvidence(contract, (evaluation) => `Useful speed returned after ${Number(evaluation.evidence?.timeToUsefulSpeed ?? 0).toFixed(2)} seconds while the subject was far from the ball.`),
    opportunityContract: contract,
  };
}

function firstTouchRetention(evidence) {
  const detectorId = "possession.first_touch_retention";
  const detectorVersion = "0.2.0";
  const contract = buildOpportunityContract({
    detectorId,
    detectorVersion,
    opportunityType: "first_touch_retention",
    decisionContext: evidence.decisionContext,
    classify(opportunity) {
      const action = opportunity.eventFacts?.tags?.find((tag) => tag.group === "action")?.value ?? "unclassified";
      if (opportunity.outcome?.nextTeam === "subject_team") {
        return { status: "non_firing", classification: "team_retained", evidence: { action } };
      }
      if (opportunity.outcome?.nextTeam === "opponent") {
        if (opportunity.context.pressure === "high" && ["boom", "clear"].includes(action)) {
          return { status: "abstained", classification: "forced_relief_unresolved", reasons: ["High pressure makes immediate opponent contact insufficient to prove a giveaway."], evidence: { action } };
        }
        return { status: "firing", classification: "opponent_gain", evidence: { action, nextEventSeconds: opportunity.outcome.nextEventSeconds } };
      }
      return { status: "abstained", classification: "outcome_unresolved", reasons: ["No attributable next possession event occurred inside the bounded window."], evidence: { action } };
    },
  });
  const evidenceItems = contractEvidence(contract, (evaluation) => `First-touch outcome was classified as ${evaluation.classification.replaceAll("_", " ")} in ${evaluation.contextKey}.`);
  return {
    candidateCount: contract.summary.firingOpportunities,
    measurements: opportunityContractSummary(contract),
    evidence: evidenceItems,
    opportunityContract: contract,
  };
}

function contextualChallengeQuality(evidence) {
  const detectorId = "challenge.quality";
  const detectorVersion = "0.3.0";
  const contract = buildOpportunityContract({
    detectorId,
    detectorVersion,
    opportunityType: "challenge_quality",
    decisionContext: evidence.decisionContext,
    classify(opportunity) {
      if (opportunity.sourceEventType === "fifty_fifty") {
        return { status: "non_firing", classification: "contact_resolved", evidence: { kind: "fifty_fifty" } };
      }
      const kind = opportunity.eventFacts?.kind ?? "whiff";
      const exposed = opportunity.context.coverage === "exposed" || opportunity.context.mode.includes("duel") || opportunity.context.mode.includes("1v1");
      if (kind === "beaten_to_ball" && exposed) {
        return {
          status: "firing",
          classification: opportunity.context.defensiveRole === "last_layer" ? "last_layer_beaten" : "uncovered_dive",
          evidence: {
            kind,
            closestApproachDistance: opportunity.eventFacts?.closest_approach_distance ?? null,
            approachSpeed: opportunity.eventFacts?.approach_speed ?? null,
          },
        };
      }
      return {
        status: "abstained",
        classification: "whiff_without_proven_team_risk",
        reasons: ["A whiff without attributable coverage loss is not enough to label the challenge poor."],
        evidence: { kind },
      };
    },
  });
  return {
    candidateCount: contract.summary.firingOpportunities,
    measurements: opportunityContractSummary(contract),
    evidence: contractEvidence(contract, (evaluation) => `Challenge opportunity was classified as ${evaluation.classification.replaceAll("_", " ")} with explicit access and coverage context.`),
    opportunityContract: contract,
  };
}

function recoveryReentryQuality(evidence) {
  const detectorId = "recovery.reentry_quality";
  const detectorVersion = "0.2.0";
  const contract = buildOpportunityContract({
    detectorId,
    detectorVersion,
    opportunityType: "recovery_reentry",
    decisionContext: evidence.decisionContext,
    classify(opportunity) {
      const classification = opportunity.outcome?.classification ?? "unresolved";
      if (classification === "useful_reentry") {
        return { status: "non_firing", classification, evidence: { timeToUsefulSpeed: opportunity.outcome.timeToUsefulSpeed } };
      }
      if (classification === "slow_reentry" && opportunity.subject?.distanceToBall >= 1800) {
        return {
          status: "firing",
          classification: opportunity.context.coverage === "exposed" ? "slow_reentry_exposed" : "slow_reentry",
          evidence: {
            timeToUsefulSpeed: opportunity.outcome.timeToUsefulSpeed,
            peakSpeed: opportunity.outcome.peakSpeed,
            distanceToBall: opportunity.subject.distanceToBall,
          },
        };
      }
      return { status: "abstained", classification: "reentry_unresolved", reasons: ["The retained detail window did not prove a useful or delayed re-entry."] };
    },
  });
  return {
    candidateCount: contract.summary.firingOpportunities,
    measurements: opportunityContractSummary(contract),
    evidence: contractEvidence(contract, (evaluation) => `Post-landing re-entry was classified as ${evaluation.classification.replaceAll("_", " ")} in a retained 30 Hz detail window.`),
    opportunityContract: contract,
  };
}

function boostOverfill(evidence) {
  const detectorId = "boost.overfill";
  const detectorVersion = "0.3.0";
  const contract = buildOpportunityContract({
    detectorId,
    detectorVersion,
    opportunityType: "boost_overfill",
    decisionContext: evidence.decisionContext,
    classify(opportunity) {
      const overfillRaw = Number(opportunity.eventFacts?.overfill_amount);
      const overfill = boostDeltaRawToPercent(overfillRaw);
      const padType = String(opportunity.eventFacts?.pad_type ?? "unknown");
      if (!Number.isFinite(overfill)) {
        return { status: "abstained", classification: "pickup_telemetry_unresolved", reasons: ["The replay did not expose a finite overfill amount for this pickup."], evidence: { padType } };
      }
      if (overfill <= 10) return { status: "non_firing", classification: "efficient_pickup", evidence: { padType, overfill } };
      const materialThreshold = padType === "large" ? 20 : 25;
      if (overfill < materialThreshold) {
        return { status: "abstained", classification: "borderline_overfill", reasons: ["The private threshold deliberately abstains on marginal overfill."], evidence: { padType, overfill } };
      }
      return {
        status: "firing",
        classification: "material_overfill",
        evidence: {
          padType,
          overfill,
          overfillRaw,
          boostBefore: boostRawToPercent(Number(opportunity.eventFacts?.boost_before)),
          boostAfter: boostRawToPercent(Number(opportunity.eventFacts?.boost_after)),
          fieldHalf: opportunity.eventFacts?.field_half ?? null,
        },
      };
    },
  });
  return {
    candidateCount: contract.summary.firingOpportunities,
    measurements: opportunityContractSummary(contract),
    evidence: contractEvidence(contract, (evaluation) => `A boost pickup discarded ${Number(evaluation.evidence?.overfill ?? 0).toFixed(1)} boost beyond the private material-overfill threshold.`),
    opportunityContract: contract,
  };
}

function kickoffContactQuality(evidence) {
  const detectorId = "kickoff.contact";
  const detectorVersion = "0.2.0";
  const contract = buildOpportunityContract({
    detectorId,
    detectorVersion,
    opportunityType: "kickoff_contact",
    decisionContext: evidence.decisionContext,
    classify(opportunity) {
      const subjectTeam = opportunity.context?.subjectTeam;
      const facts = opportunity.eventFacts ?? {};
      const possessionTeam = facts.kickoff_possession_team_is_team_0 === true ? 0
        : facts.kickoff_possession_team_is_team_0 === false ? 1 : null;
      const winningTeam = facts.winning_team_is_team_0 === true ? 0
        : facts.winning_team_is_team_0 === false ? 1 : null;
      const resolvedTeam = possessionTeam ?? winningTeam;
      const evidenceItem = {
        kickoffType: facts.kickoff_type ?? null,
        direction: facts.direction ?? null,
        outcome: facts.outcome ?? null,
        winStrengthBand: facts.win_strength_band ?? null,
      };
      if (![0, 1].includes(subjectTeam) || ![0, 1].includes(resolvedTeam)) {
        return { status: "abstained", classification: "neutral_or_unresolved_contact", reasons: ["The kickoff telemetry did not attribute immediate leverage to either team."], evidence: evidenceItem };
      }
      if (resolvedTeam === subjectTeam) return { status: "non_firing", classification: "team_leverage", evidence: evidenceItem };
      if (["dominant", "clear"].includes(String(facts.win_strength_band ?? "")) || possessionTeam !== null) {
        return { status: "firing", classification: "opponent_leverage", evidence: evidenceItem };
      }
      return { status: "abstained", classification: "narrow_opponent_outcome", reasons: ["A narrow kickoff outcome is not enough to prove poor contact."], evidence: evidenceItem };
    },
  });
  return {
    candidateCount: contract.summary.firingOpportunities,
    measurements: opportunityContractSummary(contract),
    evidence: contractEvidence(contract, (evaluation) => `The immediate kickoff outcome gave the opponent attributable leverage (${evaluation.evidence?.outcome ?? "recorded outcome"}).`),
    opportunityContract: contract,
  };
}

function possessionGiveaway(evidence) {
  const detectorId = "possession.giveaway";
  const detectorVersion = "0.2.0";
  const contract = buildOpportunityContract({
    detectorId,
    detectorVersion,
    opportunityType: "possession_giveaway",
    decisionContext: evidence.decisionContext,
    classify(opportunity) {
      const action = opportunity.eventFacts?.tags?.find((tag) => tag.group === "action")?.value ?? "unclassified";
      if (opportunity.outcome?.nextTeam === "subject_team") {
        return { status: "non_firing", classification: "team_retained", evidence: { action, nextEventSeconds: opportunity.outcome.nextEventSeconds } };
      }
      if (opportunity.outcome?.nextTeam === "opponent") {
        if (opportunity.context?.pressure === "high") {
          return { status: "abstained", classification: "forced_touch_unresolved", reasons: ["Immediate opponent pressure prevents an unforced-giveaway claim."], evidence: { action } };
        }
        return { status: "firing", classification: "unforced_opponent_gain", evidence: { action, nextEventSeconds: opportunity.outcome.nextEventSeconds } };
      }
      return { status: "abstained", classification: "outcome_unresolved", reasons: ["No attributable next possession event occurred inside the bounded window."], evidence: { action } };
    },
  });
  return {
    candidateCount: contract.summary.firingOpportunities,
    measurements: opportunityContractSummary(contract),
    evidence: contractEvidence(contract, (evaluation) => `A low-pressure ${evaluation.evidence?.action ?? "touch"} was followed by attributable opponent possession.`),
    opportunityContract: contract,
  };
}

function centerToOpponent(evidence) {
  const detectorId = "offense.center_to_opponent";
  const detectorVersion = "0.2.0";
  const contract = buildOpportunityContract({
    detectorId,
    detectorVersion,
    opportunityType: "offense_center_outcome",
    decisionContext: evidence.decisionContext,
    classify(opportunity) {
      const facts = opportunity.eventFacts ?? {};
      const item = {
        travelDistance: facts.ball_travel_distance ?? null,
        advanceDistance: facts.ball_advance_distance ?? null,
        lateralDistance: facts.lateral_centering_distance ?? null,
        nextEventSeconds: opportunity.outcome?.nextEventSeconds ?? null,
      };
      if (opportunity.outcome?.nextTeam === "subject_team") return { status: "non_firing", classification: "team_follow_up", evidence: item };
      if (opportunity.outcome?.nextTeam === "opponent" && Number(opportunity.outcome?.nextEventSeconds) <= 3) {
        return { status: "firing", classification: "opponent_first_to_center", evidence: item };
      }
      return { status: "abstained", classification: "center_outcome_unresolved", reasons: ["The bounded outcome window did not identify a first follow-up team."], evidence: item };
    },
  });
  return {
    candidateCount: contract.summary.firingOpportunities,
    measurements: opportunityContractSummary(contract),
    evidence: contractEvidence(contract, () => "The opponent reached an attributable centered ball before the subject team."),
    opportunityContract: contract,
  };
}

function defensiveClearDirection(evidence) {
  const detectorId = "defense.clear_direction";
  const detectorVersion = "0.2.0";
  const contract = buildOpportunityContract({
    detectorId,
    detectorVersion,
    opportunityType: "defensive_clear_outcome",
    decisionContext: evidence.decisionContext,
    classify(opportunity) {
      const action = opportunity.eventFacts?.tags?.find((tag) => tag.group === "action")?.value ?? "clear";
      const item = { action, ballPosition: opportunity.eventFacts?.ball_position ?? null, nextEventSeconds: opportunity.outcome?.nextEventSeconds ?? null };
      if (opportunity.outcome?.nextTeam === "subject_team") return { status: "non_firing", classification: "team_relief", evidence: item };
      if (opportunity.outcome?.nextTeam === "opponent") return { status: "firing", classification: "opponent_recycle", evidence: item };
      return { status: "abstained", classification: "clear_outcome_unresolved", reasons: ["The next possession could not be attributed inside the bounded window."], evidence: item };
    },
  });
  return {
    candidateCount: contract.summary.firingOpportunities,
    measurements: opportunityContractSummary(contract),
    evidence: contractEvidence(contract, (evaluation) => `A defensive ${evaluation.evidence?.action ?? "clear"} was followed by attributable opponent possession.`),
    opportunityContract: contract,
  };
}

function challengeCoverageQuality(evidence) {
  const detectorId = "challenge.teammate_coverage";
  const detectorVersion = "0.1.0";
  const contract = buildOpportunityContract({
    detectorId,
    detectorVersion,
    opportunityType: "challenge_quality",
    decisionContext: evidence.decisionContext,
    classify(opportunity) {
      const item = {
        coverage: opportunity.context?.coverage ?? "unknown",
        goalSideTeammates: opportunity.context?.goalSideTeammates ?? null,
        nextTeam: opportunity.outcome?.nextTeam ?? "unknown",
      };
      if (item.coverage === "layered") return { status: "non_firing", classification: "goal_side_layer_present", evidence: item };
      if (item.coverage !== "exposed") return { status: "abstained", classification: "coverage_not_resolved", reasons: ["Teammate coverage could not be established for this challenge."], evidence: item };
      if (item.nextTeam === "opponent") return { status: "firing", classification: "uncovered_challenge_opponent_access", evidence: item };
      if (item.nextTeam === "subject_team") return { status: "non_firing", classification: "uncovered_challenge_resolved", evidence: item };
      return { status: "abstained", classification: "uncovered_outcome_unresolved", reasons: ["The player challenged without a goal-side layer, but the bounded outcome was unresolved."], evidence: item };
    },
  });
  return {
    candidateCount: contract.summary.firingOpportunities,
    measurements: opportunityContractSummary(contract),
    evidence: contractEvidence(contract, () => "A challenge without a goal-side teammate layer was followed by attributable opponent access."),
    opportunityContract: contract,
  };
}

function lastPlayerChallenge(evidence) {
  const detectorId = "challenge.last_player";
  const detectorVersion = "0.1.0";
  const contract = buildOpportunityContract({
    detectorId,
    detectorVersion,
    opportunityType: "challenge_quality",
    decisionContext: evidence.decisionContext,
    classify(opportunity) {
      const item = {
        defensiveRole: opportunity.context?.defensiveRole ?? "unknown",
        fieldZone: opportunity.context?.fieldZone ?? "unknown",
        nextTeam: opportunity.outcome?.nextTeam ?? "unknown",
        opponentAccessMarginSeconds: opportunity.context?.opponentAccessMarginSeconds ?? null,
      };
      if (item.defensiveRole !== "last_layer") return { status: "non_firing", classification: "not_last_layer", evidence: item };
      if (item.nextTeam === "subject_team") return { status: "non_firing", classification: "last_layer_challenge_resolved", evidence: item };
      if (item.nextTeam === "opponent" && ["own_third", "own_half", "opponent_half"].includes(item.fieldZone)) {
        return { status: "firing", classification: "last_layer_opponent_access", evidence: item };
      }
      return { status: "abstained", classification: "last_layer_outcome_unresolved", reasons: ["Last-layer status was observed, but the bounded outcome did not prove opponent access."], evidence: item };
    },
  });
  return {
    candidateCount: contract.summary.firingOpportunities,
    measurements: opportunityContractSummary(contract),
    evidence: contractEvidence(contract, () => "A last-layer challenge was followed by attributable opponent access in a potentially exposed state."),
    opportunityContract: contract,
  };
}

function thirdOverextension(evidence) {
  const detectorId = "rotation.third_overextension";
  const detectorVersion = "0.1.0";
  const contract = buildOpportunityContract({
    detectorId,
    detectorVersion,
    opportunityType: "defensive_commitment",
    decisionContext: evidence.decisionContext,
    classify(opportunity) {
      const item = {
        defensiveRole: opportunity.context?.defensiveRole ?? "unknown",
        subjectAheadOfBall: opportunity.context?.subjectAheadOfBall ?? null,
        nextTeam: opportunity.outcome?.nextTeam ?? "unknown",
        fieldZone: opportunity.context?.fieldZone ?? "unknown",
      };
      if (item.defensiveRole !== "last_layer") return { status: "non_firing", classification: "not_last_layer", evidence: item };
      if (item.subjectAheadOfBall !== true) return { status: "non_firing", classification: "last_layer_remained_goal_side", evidence: item };
      if (item.nextTeam === "opponent") return { status: "firing", classification: "last_layer_crossed_play_opponent_access", evidence: item };
      if (item.nextTeam === "subject_team") return { status: "non_firing", classification: "last_layer_commitment_resolved", evidence: item };
      return { status: "abstained", classification: "overextension_outcome_unresolved", reasons: ["The last layer crossed ahead of the ball, but the next access could not be attributed."], evidence: item };
    },
  });
  return {
    candidateCount: contract.summary.firingOpportunities,
    measurements: opportunityContractSummary(contract),
    evidence: contractEvidence(contract, () => "The defensive last layer crossed ahead of the ball and the opponent received the next attributable access."),
    opportunityContract: contract,
  };
}

function defensiveReserve(evidence) {
  const detectorId = "boost.defensive_reserve";
  const detectorVersion = "0.1.0";
  const contract = buildOpportunityContract({
    detectorId,
    detectorVersion,
    opportunityType: "defensive_commitment",
    decisionContext: evidence.decisionContext,
    classify(opportunity) {
      const boostPercent = opportunity.subject?.boostPercent;
      const item = {
        boostPercent: Number.isFinite(boostPercent) ? boostPercent : null,
        fieldZone: opportunity.context?.fieldZone ?? "unknown",
        pressure: opportunity.context?.pressure ?? "unknown",
        opponentAccessMarginSeconds: opportunity.context?.opponentAccessMarginSeconds ?? null,
        defensiveRole: opportunity.context?.defensiveRole ?? "unknown",
      };
      if (!["own_third", "own_half"].includes(item.fieldZone)) {
        return { status: "abstained", classification: "not_defensive_transition", reasons: ["Reserve is evaluated only for commitments in the subject team's defensive half."], evidence: item };
      }
      if (!Number.isFinite(item.boostPercent)) return { status: "abstained", classification: "boost_unresolved", reasons: ["Normalized boost telemetry was unavailable."], evidence: item };
      if (item.boostPercent >= 35) return { status: "non_firing", classification: "reserve_available", evidence: item };
      const accessUrgent = item.pressure === "high" || (Number.isFinite(item.opponentAccessMarginSeconds) && item.opponentAccessMarginSeconds <= 0.25);
      if (item.boostPercent <= 15 && accessUrgent) return { status: "firing", classification: "low_reserve_under_defensive_access_pressure", evidence: item };
      return { status: "abstained", classification: "reserve_value_ambiguous", reasons: ["The private bands do not prove that the remaining reserve materially removed a defensive option."], evidence: item };
    },
  });
  return {
    candidateCount: contract.summary.firingOpportunities,
    measurements: opportunityContractSummary(contract),
    evidence: contractEvidence(contract, (evaluation) => `A defensive commitment began with ${Number(evaluation.evidence?.boostPercent ?? 0).toFixed(1)}% boost under immediate access pressure.`),
    opportunityContract: contract,
  };
}

function landingOrientationQuality(evidence) {
  const detectorId = "recovery.landing_orientation";
  const detectorVersion = "0.1.0";
  const contract = buildOpportunityContract({
    detectorId,
    detectorVersion,
    opportunityType: "landing_execution",
    decisionContext: evidence.decisionContext,
    classify(opportunity) {
      const facts = opportunity.eventFacts ?? {};
      const item = {
        sourceSurface: facts.source_surface ?? "unknown",
        uprightDeviationDegrees: Number.isFinite(facts.uprightDeviationDegrees) ? facts.uprightDeviationDegrees : null,
        forwardToVelocityDegrees: Number.isFinite(facts.forwardToVelocityDegrees) ? facts.forwardToVelocityDegrees : null,
        timeToUsefulSpeed: Number.isFinite(facts.timeToUsefulSpeed) ? facts.timeToUsefulSpeed : null,
        touchdownPlanarSpeed: Number.isFinite(facts.touchdownPlanarSpeed) ? facts.touchdownPlanarSpeed : null,
      };
      if (!Number.isFinite(item.uprightDeviationDegrees) || !Number.isFinite(item.timeToUsefulSpeed)) {
        return { status: "abstained", classification: "landing_kinematics_unresolved", reasons: ["Landing rotation or bounded post-landing speed was unavailable."], evidence: item };
      }
      const misaligned = item.uprightDeviationDegrees >= 35
        || (Number.isFinite(item.forwardToVelocityDegrees) && item.forwardToVelocityDegrees >= 100);
      const aligned = item.uprightDeviationDegrees <= 15
        && (!Number.isFinite(item.forwardToVelocityDegrees) || item.forwardToVelocityDegrees <= 45);
      if (misaligned && item.timeToUsefulSpeed >= 1) {
        return { status: "firing", classification: "misaligned_landing_delayed_reentry", evidence: item };
      }
      if (aligned && item.timeToUsefulSpeed <= 0.8) {
        return { status: "non_firing", classification: "aligned_landing_prompt_reentry", evidence: item };
      }
      return { status: "abstained", classification: "landing_value_ambiguous", reasons: ["Body alignment and re-entry timing did not jointly prove a costly or clean landing."], evidence: item };
    },
  });
  return {
    candidateCount: contract.summary.firingOpportunities,
    measurements: opportunityContractSummary(contract),
    evidence: contractEvidence(contract, (evaluation) => `The car landed ${Number(evaluation.evidence?.uprightDeviationDegrees ?? 0).toFixed(1)} degrees from upright and required ${Number(evaluation.evidence?.timeToUsefulSpeed ?? 0).toFixed(2)} seconds to restore useful speed.`),
    opportunityContract: contract,
  };
}

function postAerialExitQuality(evidence) {
  const detectorId = "recovery.post_aerial_exit";
  const detectorVersion = "0.1.0";
  const contract = buildOpportunityContract({
    detectorId,
    detectorVersion,
    opportunityType: "post_aerial_exit",
    decisionContext: evidence.decisionContext,
    classify(opportunity) {
      const facts = opportunity.eventFacts ?? {};
      const item = {
        timeToUsefulSpeed: Number.isFinite(facts.timeToUsefulSpeed) ? facts.timeToUsefulSpeed : null,
        timeToStableHeading: Number.isFinite(facts.timeToStableHeading) ? facts.timeToStableHeading : null,
        postLandingPeakSpeed: Number.isFinite(facts.postLandingPeakSpeed) ? facts.postLandingPeakSpeed : null,
        uprightDeviationDegrees: Number.isFinite(facts.uprightDeviationDegrees) ? facts.uprightDeviationDegrees : null,
      };
      if (!Number.isFinite(item.timeToUsefulSpeed)) {
        return { status: "abstained", classification: "aerial_exit_unresolved", reasons: ["The retained post-aerial window did not establish time to useful speed."], evidence: item };
      }
      if (item.timeToUsefulSpeed >= 1.1 && (!Number.isFinite(item.timeToStableHeading) || item.timeToStableHeading >= 0.8)) {
        return { status: "firing", classification: "slow_post_aerial_exit", evidence: item };
      }
      if (item.timeToUsefulSpeed <= 0.7 && (!Number.isFinite(item.timeToStableHeading) || item.timeToStableHeading <= 0.6)) {
        return { status: "non_firing", classification: "prompt_post_aerial_exit", evidence: item };
      }
      return { status: "abstained", classification: "aerial_exit_value_ambiguous", reasons: ["The exit mixed useful and delayed kinematic signals."], evidence: item };
    },
  });
  return {
    candidateCount: contract.summary.firingOpportunities,
    measurements: opportunityContractSummary(contract),
    evidence: contractEvidence(contract, (evaluation) => `After aerial involvement, useful speed returned after ${Number(evaluation.evidence?.timeToUsefulSpeed ?? 0).toFixed(2)} seconds.`),
    opportunityContract: contract,
  };
}

function wallToGroundQuality(evidence) {
  const detectorId = "recovery.wall_to_ground";
  const detectorVersion = "0.1.0";
  const contract = buildOpportunityContract({
    detectorId,
    detectorVersion,
    opportunityType: "wall_to_ground_transition",
    decisionContext: evidence.decisionContext,
    classify(opportunity) {
      const facts = opportunity.eventFacts ?? {};
      const item = {
        wallToGroundSeconds: Number.isFinite(facts.wallToGroundSeconds) ? facts.wallToGroundSeconds : null,
        timeToUsefulSpeed: Number.isFinite(facts.timeToUsefulSpeed) ? facts.timeToUsefulSpeed : null,
        uprightDeviationDegrees: Number.isFinite(facts.uprightDeviationDegrees) ? facts.uprightDeviationDegrees : null,
        pressure: opportunity.context?.pressure ?? "unknown",
      };
      if (![item.wallToGroundSeconds, item.timeToUsefulSpeed].every(Number.isFinite)) {
        return { status: "abstained", classification: "wall_transition_unresolved", reasons: ["The wall departure or post-landing speed window was incomplete."], evidence: item };
      }
      if (item.wallToGroundSeconds >= 0.7 && item.timeToUsefulSpeed >= 1) {
        return { status: "firing", classification: "wall_exit_lost_tempo", evidence: item };
      }
      if (item.wallToGroundSeconds <= 0.45 && item.timeToUsefulSpeed <= 0.8) {
        return { status: "non_firing", classification: "wall_exit_preserved_tempo", evidence: item };
      }
      return { status: "abstained", classification: "wall_transition_value_ambiguous", reasons: ["Transition duration and useful-speed recovery did not agree strongly enough."], evidence: item };
    },
  });
  return {
    candidateCount: contract.summary.firingOpportunities,
    measurements: opportunityContractSummary(contract),
    evidence: contractEvidence(contract, (evaluation) => `The wall-to-ground transition took ${Number(evaluation.evidence?.wallToGroundSeconds ?? 0).toFixed(2)} seconds before a further ${Number(evaluation.evidence?.timeToUsefulSpeed ?? 0).toFixed(2)}-second useful-speed recovery.`),
    opportunityContract: contract,
  };
}

function controlSpaceQuality(evidence) {
  const detectorId = "possession.control_space";
  const detectorVersion = "0.1.0";
  const contract = buildOpportunityContract({
    detectorId,
    detectorVersion,
    opportunityType: "touch_control_execution",
    decisionContext: evidence.decisionContext,
    classify(opportunity) {
      const facts = opportunity.eventFacts ?? {};
      const item = {
        pressure: opportunity.context?.pressure ?? "unknown",
        nextTeam: opportunity.outcome?.nextTeam ?? "unknown",
        nextEventSeconds: opportunity.outcome?.nextEventSeconds ?? null,
        relativeCarBallSpeed: Number.isFinite(facts.relativeCarBallSpeed) ? facts.relativeCarBallSpeed : null,
        postTouchCloseControlFraction: Number.isFinite(facts.postTouchCloseControlFraction) ? facts.postTouchCloseControlFraction : null,
        postTouchMedianDistanceToBall: Number.isFinite(facts.postTouchMedianDistanceToBall) ? facts.postTouchMedianDistanceToBall : null,
        observedAction: facts.observed_action ?? "unclassified",
      };
      if (![item.postTouchCloseControlFraction, item.postTouchMedianDistanceToBall].every(Number.isFinite)) {
        return { status: "abstained", classification: "touch_control_window_unresolved", reasons: ["The post-touch proximity window was incomplete."], evidence: item };
      }
      if (item.pressure === "high") {
        return { status: "abstained", classification: "forced_touch_unresolved", reasons: ["Immediate opponent pressure prevents a claim that control space was available."], evidence: item };
      }
      if (item.nextTeam === "opponent" && item.postTouchCloseControlFraction <= 0.25 && item.postTouchMedianDistanceToBall >= 650) {
        return { status: "firing", classification: "available_space_touch_separated_control", evidence: item };
      }
      if (item.nextTeam === "subject_team" && item.postTouchCloseControlFraction >= 0.5) {
        return { status: "non_firing", classification: "touch_preserved_close_control", evidence: item };
      }
      return { status: "abstained", classification: "control_value_ambiguous", reasons: ["Proximity and next-access evidence did not establish lost or preserved control."], evidence: item };
    },
  });
  return {
    candidateCount: contract.summary.firingOpportunities,
    measurements: opportunityContractSummary(contract),
    evidence: contractEvidence(contract, (evaluation) => `In non-high pressure, the post-touch median ball distance reached ${Number(evaluation.evidence?.postTouchMedianDistanceToBall ?? 0).toFixed(0)} units before attributable opponent access.`),
    opportunityContract: contract,
  };
}

function wallControlQuality(evidence) {
  const detectorId = "possession.wall_control";
  const detectorVersion = "0.1.0";
  const contract = buildOpportunityContract({
    detectorId,
    detectorVersion,
    opportunityType: "wall_control_execution",
    decisionContext: evidence.decisionContext,
    classify(opportunity) {
      const facts = opportunity.eventFacts ?? {};
      const item = {
        nextTeam: opportunity.outcome?.nextTeam ?? "unknown",
        nextEventSeconds: opportunity.outcome?.nextEventSeconds ?? null,
        postTouchCloseControlFraction: Number.isFinite(facts.postTouchCloseControlFraction) ? facts.postTouchCloseControlFraction : null,
        postTouchMedianDistanceToBall: Number.isFinite(facts.postTouchMedianDistanceToBall) ? facts.postTouchMedianDistanceToBall : null,
        approachToBallDegrees: Number.isFinite(facts.approachToBallDegrees) ? facts.approachToBallDegrees : null,
      };
      if (![item.postTouchCloseControlFraction, item.postTouchMedianDistanceToBall].every(Number.isFinite)) {
        return { status: "abstained", classification: "wall_control_window_unresolved", reasons: ["The retained wall-touch control window was incomplete."], evidence: item };
      }
      if (item.nextTeam === "opponent" && Number(item.nextEventSeconds) <= 3
        && item.postTouchCloseControlFraction <= 0.2 && item.postTouchMedianDistanceToBall >= 700) {
        return { status: "firing", classification: "wall_touch_broke_control_early", evidence: item };
      }
      if (item.nextTeam === "subject_team" && item.postTouchCloseControlFraction >= 0.45) {
        return { status: "non_firing", classification: "wall_touch_retained_control", evidence: item };
      }
      return { status: "abstained", classification: "wall_control_value_ambiguous", reasons: ["The wall touch did not prove an early breakdown or retained control."], evidence: item };
    },
  });
  return {
    candidateCount: contract.summary.firingOpportunities,
    measurements: opportunityContractSummary(contract),
    evidence: contractEvidence(contract, (evaluation) => `The wall touch separated the player from the ball to a ${Number(evaluation.evidence?.postTouchMedianDistanceToBall ?? 0).toFixed(0)}-unit median before opponent access.`),
    opportunityContract: contract,
  };
}

const MEASURING_DETECTORS = Object.freeze([
  Object.freeze({ id: "boost.zero_duration", version: "0.2.0", modes: ["1v1", "2v2", "3v3"], evaluate: zeroBoostExposureContract }),
  Object.freeze({ id: "boost.supersonic_waste", version: "0.4.0", modes: ["1v1", "2v2", "3v3"], evaluate: supersonicBoostEfficiency }),
  Object.freeze({ id: "kickoff.speed", version: "0.2.0", modes: ["1v1", "2v2", "3v3"], evaluate: kickoffSpeedQuality }),
  Object.freeze({ id: "possession.first_touch", version: "0.2.0", modes: ["1v1", "2v2", "3v3"], evaluate: firstTouchQuality }),
  Object.freeze({ id: "challenge.dive", version: "0.2.0", modes: ["1v1", "2v2", "3v3"], evaluate: challengeDiveQuality }),
  Object.freeze({ id: "rotation.spacing_too_close", version: "0.2.0", modes: ["2v2", "3v3"], evaluate: teamSpacingDecision }),
  Object.freeze({ id: "teamplay.double_commit", version: "0.2.0", modes: ["2v2", "3v3"], evaluate: teamCommitmentDecision }),
  Object.freeze({ id: "recovery.momentum_loss", version: "0.2.0", modes: ["1v1", "2v2", "3v3"], evaluate: recoveryMomentumQuality }),
  Object.freeze({ id: "possession.first_touch_retention", version: "0.2.0", modes: ["1v1", "2v2", "3v3"], evaluate: firstTouchRetention }),
  Object.freeze({ id: "challenge.quality", version: "0.3.0", modes: ["1v1", "2v2", "3v3"], evaluate: contextualChallengeQuality }),
  Object.freeze({ id: "recovery.reentry_quality", version: "0.2.0", modes: ["1v1", "2v2", "3v3"], evaluate: recoveryReentryQuality }),
  Object.freeze({ id: "boost.overfill", version: "0.3.0", modes: ["1v1", "2v2", "3v3"], evaluate: boostOverfill }),
  Object.freeze({ id: "kickoff.contact", version: "0.2.0", modes: ["1v1", "2v2", "3v3"], evaluate: kickoffContactQuality }),
  Object.freeze({ id: "possession.giveaway", version: "0.2.0", modes: ["1v1", "2v2", "3v3"], evaluate: possessionGiveaway }),
  Object.freeze({ id: "offense.center_to_opponent", version: "0.2.0", modes: ["1v1", "2v2", "3v3"], evaluate: centerToOpponent }),
  Object.freeze({ id: "defense.clear_direction", version: "0.2.0", modes: ["1v1", "2v2", "3v3"], evaluate: defensiveClearDirection }),
  Object.freeze({ id: "boost.defensive_reserve", version: "0.1.0", modes: ["1v1", "2v2", "3v3"], evaluate: defensiveReserve }),
  Object.freeze({ id: "rotation.third_overextension", version: "0.1.0", modes: ["2v2", "3v3"], evaluate: thirdOverextension }),
  Object.freeze({ id: "challenge.teammate_coverage", version: "0.1.0", modes: ["2v2", "3v3"], evaluate: challengeCoverageQuality }),
  Object.freeze({ id: "challenge.last_player", version: "0.1.0", modes: ["2v2", "3v3"], evaluate: lastPlayerChallenge }),
  Object.freeze({ id: "recovery.landing_orientation", version: "0.1.0", modes: ["1v1", "2v2", "3v3"], evaluate: landingOrientationQuality }),
  Object.freeze({ id: "recovery.post_aerial_exit", version: "0.1.0", modes: ["1v1", "2v2", "3v3"], evaluate: postAerialExitQuality }),
  Object.freeze({ id: "recovery.wall_to_ground", version: "0.1.0", modes: ["1v1", "2v2", "3v3"], evaluate: wallToGroundQuality }),
  Object.freeze({ id: "possession.control_space", version: "0.1.0", modes: ["1v1", "2v2", "3v3"], evaluate: controlSpaceQuality }),
  Object.freeze({ id: "possession.wall_control", version: "0.1.0", modes: ["1v1", "2v2", "3v3"], evaluate: wallControlQuality }),
]);

const measuringById = new Map([...MEASURING_DETECTORS, ...EXPANDED_MEASURING_DETECTORS]
  .map((detector) => [detector.id, detector]));

if (measuringById.size !== ROCKET_LEAGUE_DETECTOR_CATALOG.length) {
  const missing = ROCKET_LEAGUE_DETECTOR_CATALOG.filter((definition) => !measuringById.has(definition.id)).map((definition) => definition.id);
  throw new Error(`Every catalog lane must have a measuring opportunity contract. Missing: ${missing.join(", ")}`);
}

export const SHADOW_DETECTORS = Object.freeze(ROCKET_LEAGUE_DETECTOR_CATALOG.map((definition) => {
  const measuring = measuringById.get(definition.id);
  return Object.freeze({ ...measuring, implementationStatus: "measuring" });
}));

export function decisionEngineMetadata(evidence, shadowRun) {
  return {
    schemaVersion: DECISION_ENGINE_METADATA_VERSION,
    context: decisionContextSummary(evidence.decisionContext),
    adaptiveSampling: adaptiveSamplingSummary(evidence.adaptiveSampling),
    mechanics: mechanicsModelSummary(evidence.mechanicsModel),
    superAnalysis: composeSuperAnalysis(shadowRun, evidence.mechanicsModel),
    detectors: shadowRun.runs.filter((run) => run.opportunityContract)
      .map((run) => opportunityContractSummary(run.opportunityContract, { includeEvaluations: true })),
  };
}

export function runShadowDetectors(evidence, detectors = SHADOW_DETECTORS) {
  const mode = normalizeMode(evidence.normalized.mode);
  const runs = detectors.map((detector) => {
    if (mode !== "unknown" && Array.isArray(detector.modes) && !detector.modes.includes(mode)) {
      return {
        detectorId: detector.id,
        detectorVersion: detector.version,
        implementationStatus: detector.implementationStatus,
        lifecycle: "shadow",
        public: false,
        status: "not_applicable",
        applicableModes: detector.modes,
        candidateCount: 0,
        measurements: {},
        evidence: [],
        qualityGate: assessPublicDetectorGate(),
      };
    }
    try {
      const observation = detector.evaluate(evidence);
      return {
        detectorId: detector.id,
        detectorVersion: detector.version,
        implementationStatus: detector.implementationStatus,
        lifecycle: "shadow",
        public: false,
        status: detector.implementationStatus === "capability_abstention"
          ? "capability_abstained"
          : observation.candidateCount ? "observed" : "no_signal",
        ...observation,
        qualityGate: assessPublicDetectorGate(),
      };
    } catch (error) {
      return {
        detectorId: detector.id,
        detectorVersion: detector.version,
        implementationStatus: detector.implementationStatus,
        lifecycle: "shadow",
        public: false,
        status: "error",
        candidateCount: 0,
        measurements: {},
        evidence: [],
        error: error instanceof Error ? error.message : "Unknown detector error",
        qualityGate: assessPublicDetectorGate(),
      };
    }
  });

  return {
    runtimeVersion: SHADOW_RUNTIME_VERSION,
    subjectPlayerId: evidence.normalized.subjectPlayerId,
    runs,
    summary: {
      detectorCount: runs.length,
      executed: runs.filter((run) => !["error", "not_applicable"].includes(run.status)).length,
      measuringExecuted: runs.filter((run) => run.implementationStatus === "measuring" && !["error", "not_applicable"].includes(run.status)).length,
      notApplicable: runs.filter((run) => run.status === "not_applicable").length,
      errors: runs.filter((run) => run.status === "error").length,
      observed: runs.filter((run) => run.status === "observed").length,
      candidateCount: runs.reduce((sum, run) => sum + run.candidateCount, 0),
      publicEligible: runs.filter((run) => run.qualityGate.eligible).length,
      measuring: runs.filter((run) => run.implementationStatus === "measuring").length,
      capabilityAbstained: runs.filter((run) => run.implementationStatus === "capability_abstention").length,
    },
  };
}
