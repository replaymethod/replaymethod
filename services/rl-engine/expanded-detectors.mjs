import { buildOpportunityContract, opportunityContractSummary } from "./opportunity-contract.mjs";
import { boostDeltaRawToPercent, boostRawToPercent } from "./boost-units.mjs";

export const EXPANDED_DETECTOR_SUITE_VERSION = "rocket-league-expanded-detectors@0.2.0";

const allModes = Object.freeze(["1v1", "2v2", "3v3"]);
const teamModes = Object.freeze(["2v2", "3v3"]);
const AERIAL_CLOSEST_APPROACH_HIGH_TAIL = 200;

const number = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const action = (opportunity) => opportunity.eventFacts?.tags?.find((tag) => tag.group === "action")?.value ?? "unclassified";
const item = (opportunity, extra = {}) => ({
  pressure: opportunity.context?.pressure ?? "unknown",
  possession: opportunity.context?.possession ?? "unknown",
  fieldZone: opportunity.context?.fieldZone ?? "unknown",
  coverage: opportunity.context?.coverage ?? "unknown",
  accessOrder: opportunity.context?.accessOrder ?? "unknown",
  teammateAccessMarginSeconds: number(opportunity.context?.teammateAccessMarginSeconds),
  opponentAccessMarginSeconds: number(opportunity.context?.opponentAccessMarginSeconds),
  nearestTeammateDistance: number(opportunity.context?.nearestTeammateDistanceToSubject),
  sameLaneTeammates: number(opportunity.context?.sameLaneTeammates),
  subjectGoalSide: opportunity.context?.subjectGoalSide ?? null,
  subjectAheadOfBall: opportunity.context?.subjectAheadOfBall ?? null,
  nextTeam: opportunity.outcome?.nextTeam ?? "unknown",
  nextEventSeconds: number(opportunity.outcome?.nextEventSeconds),
  goalWithinWindow: opportunity.outcome?.goalWithinWindow ?? null,
  action: action(opportunity),
  ...extra,
});

const firing = (classification, evidence) => ({ status: "firing", classification, evidence });
const nonFiring = (classification, evidence) => ({ status: "non_firing", classification, evidence });
const abstain = (classification, reason, evidence) => ({ status: "abstained", classification, reasons: [reason], evidence });

function identityValue(identity) {
  if (typeof identity === "string") return identity.toLowerCase();
  if (!identity || typeof identity !== "object") return "";
  const entry = Object.entries(identity).find(([, value]) => String(value ?? "").trim());
  return entry ? `${entry[0].toLowerCase()}:${String(entry[1]).trim().toLowerCase()}` : "";
}

function kickoffEntry(opportunity, evidence) {
  const subjectId = String(evidence.decisionContext?.subjectPlayerId ?? evidence.normalized?.subjectPlayerId ?? "").toLowerCase();
  const facts = opportunity.eventFacts ?? {};
  return [facts.team_zero_taker, facts.team_one_taker, ...(facts.team_zero_non_takers ?? []), ...(facts.team_one_non_takers ?? [])]
    .filter(Boolean).find((entry) => identityValue(entry.player) === subjectId) ?? null;
}

function samePostSide(opportunity) {
  const subjectX = number(opportunity.subject?.position?.x);
  const ballX = number(opportunity.ball?.position?.x);
  return Number.isFinite(subjectX) && Number.isFinite(ballX) && Math.abs(ballX) >= 300
    ? Math.sign(subjectX) === Math.sign(ballX) : null;
}

function supportSeparationDegrees(opportunity) {
  const ball = opportunity.ball?.position;
  const subject = opportunity.subject?.position;
  const mate = opportunity.context?.nearestTeammatePosition;
  if (![ball?.x, ball?.y, subject?.x, subject?.y, mate?.x, mate?.y].every(Number.isFinite)) return null;
  const left = { x: subject.x - ball.x, y: subject.y - ball.y };
  const right = { x: mate.x - ball.x, y: mate.y - ball.y };
  const denominator = Math.hypot(left.x, left.y) * Math.hypot(right.x, right.y);
  if (!denominator) return null;
  const cosine = Math.max(-1, Math.min(1, ((left.x * right.x) + (left.y * right.y)) / denominator));
  return Math.acos(cosine) * 180 / Math.PI;
}

const configs = [
  {
    id: "boost.low_exposure", type: "zero_boost_exposure", modes: allModes,
    classify(opportunity) {
      const duration = number(opportunity.eventFacts?.duration_seconds);
      const evidence = item(opportunity, { durationSeconds: duration, distanceToBall: number(opportunity.subject?.distanceToBall) });
      if (!Number.isFinite(duration)) return abstain("critical_zero_window_unresolved", "Zero-reserve duration was unavailable.", evidence);
      const critical = ["own_third", "own_half"].includes(evidence.fieldZone) || evidence.pressure === "high" || evidence.possession === "opponent_control";
      if (critical && duration >= 0.4) return firing("sustained_zero_reserve_in_critical_context", evidence);
      if (!critical || duration <= 0.2) return nonFiring("zero_reserve_not_sustained_in_critical_context", evidence);
      return abstain("borderline_critical_zero_window", "The reserve episode was too brief to classify safely.", evidence);
    },
  },
  {
    id: "boost.large_pad_detour", type: "boost_route_pickup", modes: allModes,
    classify(opportunity) {
      const facts = opportunity.eventFacts ?? {};
      const evidence = item(opportunity, {
        padType: facts.pad_type ?? "unknown",
        boostBeforePercent: boostRawToPercent(number(facts.boost_before)),
        overfillPercent: boostDeltaRawToPercent(number(facts.overfill_amount)),
        distanceToBall: number(opportunity.subject?.distanceToBall),
      });
      if (!Number.isFinite(evidence.distanceToBall)) return abstain("pickup_route_geometry_unresolved", "Ball distance at pickup was unavailable.", evidence);
      if (evidence.padType === "large" && evidence.distanceToBall >= 2600 && evidence.nextTeam === "opponent" && evidence.coverage === "exposed") return firing("large_pad_isolation_proxy", evidence);
      if (evidence.padType === "small" || evidence.distanceToBall <= 1600 || evidence.nextTeam === "subject_team") return nonFiring("pickup_preserved_play_proximity", evidence);
      return abstain("large_pad_route_counterfactual_unresolved", "A pickup alone cannot prove that a shorter useful route existed.", evidence);
    },
  },
  {
    id: "boost.small_pad_blindness", type: "boost_route_pickup", modes: allModes,
    classify(opportunity) {
      const facts = opportunity.eventFacts ?? {};
      const evidence = item(opportunity, {
        padType: facts.pad_type ?? "unknown",
        boostBeforePercent: boostRawToPercent(number(facts.boost_before)),
        collectedPercent: boostDeltaRawToPercent(number(facts.collected_amount)),
        overfillPercent: boostDeltaRawToPercent(number(facts.overfill_amount)),
      });
      if (!Number.isFinite(evidence.boostBeforePercent)) return abstain("pre_pickup_reserve_unresolved", "Pre-pickup reserve was unavailable.", evidence);
      if (evidence.padType === "large" && evidence.boostBeforePercent >= 35 && evidence.overfillPercent >= 20 && evidence.nextTeam === "opponent") return firing("full_pad_dependency_proxy", evidence);
      if (evidence.padType === "small" && evidence.boostBeforePercent <= 70) return nonFiring("small_pad_route_used", evidence);
      return abstain("missed_small_pad_counterfactual_unresolved", "Replay telemetry does not prove which uncollected pad route was available.", evidence);
    },
  },
  {
    id: "boost.teammate_starvation", type: "boost_route_pickup", modes: teamModes,
    classify(opportunity) {
      const facts = opportunity.eventFacts ?? {};
      const evidence = item(opportunity, {
        padType: facts.pad_type ?? "unknown",
        boostBeforePercent: boostRawToPercent(number(facts.boost_before)),
        teammateMinimumBoost: number(opportunity.context?.minimumTeammateBoostPercent),
        overfillPercent: boostDeltaRawToPercent(number(facts.overfill_amount)),
      });
      if (!Number.isFinite(evidence.teammateMinimumBoost) || !Number.isFinite(evidence.boostBeforePercent)) return abstain("team_reserve_unresolved", "Teammate or subject reserve was unavailable.", evidence);
      if (evidence.padType === "large" && evidence.teammateMinimumBoost <= 15 && evidence.boostBeforePercent >= 55 && evidence.overfillPercent >= 15) return firing("high_reserve_large_pad_with_low_reserve_teammate", evidence);
      if (evidence.teammateMinimumBoost >= 35 || evidence.boostBeforePercent <= 30 || evidence.padType === "small") return nonFiring("pickup_not_starving_by_reserve_proxy", evidence);
      return abstain("teammate_route_ownership_unresolved", "Reserve imbalance does not prove which player owned the pad route.", evidence);
    },
  },
  {
    id: "rotation.caught_ahead", type: "rotation_transition", modes: teamModes,
    classify(opportunity) {
      const evidence = item(opportunity);
      if (evidence.subjectAheadOfBall === true && evidence.coverage === "exposed" && evidence.nextTeam === "opponent") return firing("ahead_of_ball_during_exposed_turnover", evidence);
      if (evidence.subjectAheadOfBall === false || evidence.coverage === "layered" || evidence.nextTeam === "subject_team") return nonFiring("transition_layer_preserved", evidence);
      return abstain("transition_outcome_unresolved", "Position alone did not establish a costly caught-ahead transition.", evidence);
    },
  },
  {
    id: "rotation.cut", type: "rotation_transition", modes: teamModes,
    classify(opportunity) {
      const evidence = item(opportunity);
      if (!Number.isFinite(evidence.teammateAccessMarginSeconds)) return abstain("team_access_unresolved", "Comparable teammate access was unavailable.", evidence);
      if (evidence.teammateAccessMarginSeconds <= -0.35 && evidence.sameLaneTeammates > 0 && evidence.nextTeam === "opponent") return firing("slower_same_lane_intervention_proxy", evidence);
      if (evidence.teammateAccessMarginSeconds >= 0.35 || evidence.sameLaneTeammates === 0) return nonFiring("subject_turn_or_separate_lane", evidence);
      return abstain("rotation_ownership_borderline", "Near-equal access does not establish whose turn it was.", evidence);
    },
  },
  {
    id: "rotation.same_lane", type: "rotation_transition", modes: teamModes,
    classify(opportunity) {
      const evidence = item(opportunity);
      if (![evidence.sameLaneTeammates, evidence.nearestTeammateDistance].every(Number.isFinite)) return abstain("lane_geometry_unresolved", "Lane or teammate distance was unavailable.", evidence);
      if (evidence.sameLaneTeammates > 0 && evidence.nearestTeammateDistance <= 1500) return firing("compressed_same_lane_layer", evidence);
      if (evidence.sameLaneTeammates === 0 || evidence.nearestTeammateDistance >= 2100) return nonFiring("separate_team_lanes", evidence);
      return abstain("same_lane_cost_unresolved", "Overlap geometry was present without a proven removed option.", evidence);
    },
  },
  {
    id: "rotation.spacing_too_far", type: "team_support_decision", modes: teamModes,
    classify(opportunity) {
      const evidence = item(opportunity);
      if (!Number.isFinite(evidence.nearestTeammateDistance)) return abstain("support_distance_unresolved", "Nearest teammate distance was unavailable.", evidence);
      if (evidence.nearestTeammateDistance >= 3600 && evidence.nextTeam === "opponent" && evidence.coverage === "exposed") return firing("support_too_remote_for_turnover", evidence);
      if (evidence.nearestTeammateDistance <= 2600 && evidence.coverage === "layered") return nonFiring("reachable_layered_support", evidence);
      return abstain("far_spacing_role_value_unresolved", "Large spacing may be correct for field coverage or a pass lane.", evidence);
    },
  },
  {
    id: "rotation.back_post_bypass", type: "defensive_positioning", modes: teamModes,
    classify(opportunity) {
      const evidence = item(opportunity, { samePostSide: samePostSide(opportunity), subjectDistanceToOwnGoal: number(opportunity.context?.subjectDistanceToOwnGoal) });
      if (evidence.fieldZone !== "own_third") return nonFiring("outside_back_post_denominator", evidence);
      if (evidence.samePostSide === true && evidence.subjectDistanceToOwnGoal <= 2300 && evidence.subjectGoalSide === false && evidence.nextTeam === "opponent") return firing("near_side_defensive_entry_without_goal_side", evidence);
      if (evidence.samePostSide === false && evidence.subjectGoalSide === true) return nonFiring("far_side_goal_side_entry", evidence);
      return abstain("post_route_intent_unresolved", "A single frame cannot prove the complete defensive rotation route.", evidence);
    },
  },
  {
    id: "rotation.goal_side_loss", type: "defensive_positioning", modes: teamModes,
    classify(opportunity) {
      const evidence = item(opportunity);
      if (evidence.fieldZone === "own_third" && evidence.subjectGoalSide === false && evidence.coverage === "exposed" && evidence.nextTeam === "opponent") return firing("goal_side_lost_during_opponent_continuation", evidence);
      if (evidence.subjectGoalSide === true || evidence.coverage === "layered") return nonFiring("goal_side_or_layer_preserved", evidence);
      return abstain("goal_side_consequence_unresolved", "Goal-side geometry did not establish a removed defensive option.", evidence);
    },
  },
  {
    id: "rotation.backboard_uncovered", type: "defensive_positioning", modes: teamModes,
    classify(opportunity) {
      const ballHeight = number(opportunity.ball?.position?.z);
      const subjectHeight = number(opportunity.subject?.position?.z);
      const evidence = item(opportunity, { ballHeight, subjectHeight, goalSideTeammates: number(opportunity.context?.goalSideTeammates) });
      if (![ballHeight, subjectHeight].every(Number.isFinite)) return abstain("backboard_geometry_unresolved", "Ball or player height was unavailable.", evidence);
      if (evidence.fieldZone === "own_third" && ballHeight >= 550 && subjectHeight <= 220 && evidence.goalSideTeammates === 0 && evidence.nextTeam === "opponent") return firing("high_defensive_ball_without_backboard_layer", evidence);
      if (ballHeight < 350 || evidence.goalSideTeammates > 0 || subjectHeight >= 500) return nonFiring("backboard_threat_absent_or_covered", evidence);
      return abstain("backboard_responsibility_unresolved", "High-ball geometry did not establish player responsibility.", evidence);
    },
  },
  {
    id: "challenge.late", type: "tactical_challenge", modes: allModes,
    classify(opportunity) {
      const evidence = item(opportunity, { kind: opportunity.eventFacts?.kind ?? opportunity.sourceEventType, closestApproachDistance: number(opportunity.eventFacts?.closest_approach_distance) });
      if (opportunity.sourceEventType === "fifty_fifty") return nonFiring("challenge_contact_reached", evidence);
      if (evidence.kind === "beaten_to_ball" && evidence.nextTeam === "opponent" && number(evidence.opponentAccessMarginSeconds) <= 0) return firing("beaten_after_opponent_access_advantage", evidence);
      if (evidence.nextTeam === "subject_team") return nonFiring("team_access_recovered", evidence);
      return abstain("challenge_lateness_unresolved", "A whiff does not isolate timing from aim, fake intent or forced avoidance.", evidence);
    },
  },
  {
    id: "challenge.fake_opportunity", type: "tactical_challenge", modes: allModes,
    classify(opportunity) {
      const evidence = item(opportunity, { kind: opportunity.eventFacts?.kind ?? opportunity.sourceEventType, approachSpeed: number(opportunity.eventFacts?.approach_speed) });
      if (opportunity.sourceEventType === "fifty_fifty") return nonFiring("contact_commitment_reached", evidence);
      if (evidence.kind === "beaten_to_ball" && evidence.approachSpeed >= 1700 && evidence.coverage === "exposed" && evidence.nextTeam === "opponent") return firing("high_speed_commitment_fake_review_candidate", evidence);
      if (evidence.coverage === "layered" || evidence.nextTeam === "subject_team") return nonFiring("commitment_retained_layer_or_access", evidence);
      return abstain("fake_counterfactual_unresolved", "Replay telemetry cannot prove that a fake would have produced a better response.", evidence);
    },
  },
  {
    id: "challenge.low_probability_aerial", type: "tactical_challenge", modes: allModes,
    classify(opportunity) {
      const evidence = item(opportunity, {
        aerial: opportunity.eventFacts?.aerial ?? null,
        closestApproachDistance: number(opportunity.eventFacts?.closest_approach_distance),
        approachSpeed: number(opportunity.eventFacts?.approach_speed),
        closestApproachHighTailThreshold: AERIAL_CLOSEST_APPROACH_HIGH_TAIL,
      });
      if (evidence.aerial !== true) return nonFiring("ground_challenge_outside_aerial_risk", evidence);
      if (evidence.closestApproachDistance >= AERIAL_CLOSEST_APPROACH_HIGH_TAIL && evidence.nextTeam === "opponent" && ["exposed", "not_applicable"].includes(evidence.coverage)) return firing("high_tail_aerial_miss_conceded_access", evidence);
      if (opportunity.sourceEventType === "fifty_fifty" || evidence.nextTeam === "subject_team") return nonFiring("aerial_commitment_reached_or_recovered_access", evidence);
      return abstain("aerial_probability_unresolved", "A single aerial outcome cannot establish the full pre-takeoff probability.", evidence);
    },
  },
  {
    id: "challenge.advantage_state", type: "tactical_challenge", modes: allModes,
    classify(opportunity) {
      const evidence = item(opportunity, { riskAppetite: opportunity.context?.riskAppetite ?? "unknown", clock: opportunity.context?.clock ?? "unknown", score: opportunity.context?.score ?? "unknown" });
      if (evidence.riskAppetite === "protect_lead" && evidence.coverage === "exposed" && evidence.nextTeam === "opponent") return firing("protect_lead_state_exposed_by_commitment", evidence);
      if (evidence.riskAppetite === "balanced" || evidence.coverage === "layered" || evidence.nextTeam === "subject_team") return nonFiring("challenge_compatible_with_state_proxy", evidence);
      return abstain("score_state_choice_unresolved", "Score and clock context do not prove the intended strategic choice.", evidence);
    },
  },
  {
    id: "recovery.demolition_reentry", type: "demolition_reentry", modes: allModes,
    classify(opportunity) {
      const evidence = item(opportunity, { boostGranted: number(opportunity.eventFacts?.boost_granted), respawnPosition: opportunity.eventFacts?.player_position ?? null });
      if (evidence.nextTeam === "opponent" && evidence.nextEventSeconds <= 2.5 && ["own_third", "own_half"].includes(evidence.fieldZone) && evidence.coverage === "exposed") return firing("respawn_window_failed_to_restore_defensive_access", evidence);
      if (evidence.nextTeam === "subject_team" || evidence.coverage === "layered") return nonFiring("respawn_rejoined_with_access_or_layer", evidence);
      return abstain("respawn_route_value_unresolved", "The bounded post-respawn window did not resolve useful re-entry.", evidence);
    },
  },
  {
    id: "recovery.play_reentry", type: "recovery_reentry", modes: allModes,
    classify(opportunity) {
      const time = number(opportunity.outcome?.timeToUsefulSpeed);
      const evidence = item(opportunity, { timeToUsefulSpeed: time, peakSpeed: number(opportunity.outcome?.peakSpeed), distanceToBall: number(opportunity.subject?.distanceToBall) });
      if (!Number.isFinite(time)) return abstain("reentry_timing_unresolved", "Time to useful speed was unavailable.", evidence);
      if (time >= 1.2 && evidence.distanceToBall >= 1800) return firing("slow_useful_play_reentry", evidence);
      if (time <= 0.7) return nonFiring("prompt_useful_play_reentry", evidence);
      return abstain("reentry_value_borderline", "The recovery delay was not clearly costly or prompt.", evidence);
    },
  },
  {
    id: "possession.panic_clear", type: "possession_clear", modes: allModes,
    classify(opportunity) {
      const evidence = item(opportunity, { ballSpeedChange: number(opportunity.eventFacts?.ball_speed_change), playDepth: opportunity.eventFacts?.play_depth ?? null });
      if (["low", "medium"].includes(evidence.pressure) && evidence.nextTeam === "opponent" && evidence.nextEventSeconds <= 2.5) return firing("low_pressure_clear_returned_possession", evidence);
      if (evidence.pressure === "high" || evidence.nextTeam === "subject_team") return nonFiring("forced_relief_or_team_continuation", evidence);
      return abstain("clear_alternative_unresolved", "The replay did not establish a safer controllable alternative.", evidence);
    },
  },
  {
    id: "possession.touch_frequency", type: "possession_sequence", modes: allModes,
    classify(opportunity) {
      const touches = number(opportunity.eventFacts?.touch_count);
      const duration = number(opportunity.eventFacts?.duration);
      const rate = Number.isFinite(touches) && Number.isFinite(duration) && duration > 0 ? touches / duration : null;
      const evidence = item(opportunity, { touchCount: touches, durationSeconds: duration, touchesPerSecond: rate, sustainedControl: opportunity.eventFacts?.sustained_control ?? null });
      if (!Number.isFinite(rate)) return abstain("possession_sequence_rate_unresolved", "Touch count or sequence duration was unavailable.", evidence);
      if (rate >= 1.6 && evidence.nextTeam === "opponent") return firing("dense_touch_sequence_ended_in_opponent_access", evidence);
      if (rate <= 1.0 || opportunity.eventFacts?.sustained_control === true || evidence.nextTeam === "subject_team") return nonFiring("touch_sequence_preserved_options_proxy", evidence);
      return abstain("extra_touch_counterfactual_unresolved", "Touch density alone cannot prove that one touch removed an option.", evidence);
    },
  },
  {
    id: "offense.shot_quality", type: "shot_execution", modes: allModes,
    classify(opportunity) {
      const evidence = item(opportunity, { goalAlignment: number(opportunity.eventFacts?.goal_alignment), ballSpeed: number(opportunity.eventFacts?.ball_speed), ballSpeedChange: number(opportunity.eventFacts?.ball_speed_change) });
      if (evidence.goalWithinWindow === true) return nonFiring("shot_converted_inside_window", evidence);
      if ((Number.isFinite(evidence.goalAlignment) && evidence.goalAlignment <= 0.35) || (evidence.nextTeam === "opponent" && evidence.nextEventSeconds <= 2)) return firing("low_threat_or_immediately_conceded_shot", evidence);
      if ((Number.isFinite(evidence.goalAlignment) && evidence.goalAlignment >= 0.7) || evidence.nextTeam === "subject_team") return nonFiring("aligned_shot_or_team_follow_up", evidence);
      return abstain("shot_threat_unresolved", "The retained shot telemetry did not establish threat quality.", evidence);
    },
  },
  {
    id: "offense.open_net_execution", type: "shot_execution", modes: allModes,
    classify(opportunity) {
      const evidence = item(opportunity, { nearestOpponentDistance: number(opportunity.context?.nearestOpponentDistance), opponentCount: number(opportunity.context?.opponentCount) });
      const lowPressureCandidate = evidence.pressure === "low" && evidence.fieldZone === "opponent_third";
      if (lowPressureCandidate && evidence.goalWithinWindow === false && evidence.nextTeam === "opponent") return firing("unconverted_low_pressure_shot_proxy", evidence);
      if (lowPressureCandidate && evidence.goalWithinWindow === true) return nonFiring("low_pressure_shot_converted", evidence);
      return abstain("open_net_state_not_proven", "Low pressure is not sufficient to prove an open net.", evidence);
    },
  },
  {
    id: "offense.pass_lane", type: "tactical_touch", modes: teamModes,
    classify(opportunity) {
      const evidence = item(opportunity);
      if (evidence.action === "pass" && evidence.nextTeam === "subject_team") return nonFiring("pass_lane_used_with_team_continuation", evidence);
      if (evidence.action !== "pass" && evidence.pressure === "low" && evidence.teammateAccessMarginSeconds <= 0.25 && evidence.nextTeam === "opponent") return firing("available_teammate_lane_review_candidate", evidence);
      if (evidence.pressure === "high" || evidence.nextTeam === "subject_team") return nonFiring("forced_touch_or_team_continuation", evidence);
      return abstain("pass_counterfactual_unresolved", "Geometry does not prove that a pass was reachable or higher value.", evidence);
    },
  },
  {
    id: "offense.follow_up", type: "shot_follow_up", modes: allModes,
    classify(opportunity) {
      const evidence = item(opportunity);
      if (evidence.nextTeam === "opponent" && evidence.nextEventSeconds <= 2.5 && evidence.goalWithinWindow !== true) return firing("shot_ended_without_team_follow_up", evidence);
      if (evidence.nextTeam === "subject_team" || evidence.goalWithinWindow === true) return nonFiring("shot_created_follow_up_or_goal", evidence);
      return abstain("shot_follow_up_unresolved", "No attributable follow-up occurred inside the bounded window.", evidence);
    },
  },
  {
    id: "offense.backboard_use", type: "attack_creation", modes: allModes,
    classify(opportunity) {
      const evidence = item(opportunity, { travelDistance: number(opportunity.eventFacts?.ball_travel_distance), lateralCenteringDistance: number(opportunity.eventFacts?.lateral_centering_distance) });
      if (evidence.nextTeam === "opponent" && evidence.travelDistance >= 1400) return firing("direct_center_returned_possession_backboard_review", evidence);
      if (evidence.nextTeam === "subject_team") return nonFiring("creation_reached_team_follow_up", evidence);
      return abstain("backboard_counterfactual_unresolved", "A failed center does not prove that backboard use was available or superior.", evidence);
    },
  },
  {
    id: "defense.near_post_trap", type: "defensive_positioning", modes: allModes,
    classify(opportunity) {
      const evidence = item(opportunity, { samePostSide: samePostSide(opportunity), subjectDistanceToOwnGoal: number(opportunity.context?.subjectDistanceToOwnGoal) });
      if (evidence.fieldZone !== "own_third") return nonFiring("outside_near_post_denominator", evidence);
      if (evidence.samePostSide === true && evidence.subjectDistanceToOwnGoal <= 1800 && evidence.subjectGoalSide === false && evidence.nextTeam === "opponent") return firing("near_post_side_limited_goal_side_options", evidence);
      if (evidence.samePostSide === false || evidence.subjectGoalSide === true) return nonFiring("far_post_or_goal_side_position", evidence);
      return abstain("near_post_consequence_unresolved", "Near-post geometry alone did not establish a lost save option.", evidence);
    },
  },
  {
    id: "defense.corner_overcommit", type: "defensive_positioning", modes: allModes,
    classify(opportunity) {
      const x = Math.abs(number(opportunity.subject?.position?.x) ?? 0);
      const evidence = item(opportunity, { subjectAbsX: x });
      if (evidence.fieldZone === "own_third" && x >= 3000 && evidence.accessOrder === "first" && evidence.coverage === "exposed" && evidence.nextTeam === "opponent") return firing("corner_commitment_opened_middle_proxy", evidence);
      if (x <= 2200 || evidence.coverage === "layered" || evidence.nextTeam === "subject_team") return nonFiring("middle_layer_or_team_access_preserved", evidence);
      return abstain("corner_commitment_cost_unresolved", "Corner position did not prove that the middle became attackable.", evidence);
    },
  },
  {
    id: "defense.goal_line_congestion", type: "defensive_positioning", modes: teamModes,
    classify(opportunity) {
      const goalDistance = number(opportunity.context?.subjectDistanceToOwnGoal);
      const evidence = item(opportunity, { subjectDistanceToOwnGoal: goalDistance });
      if (goalDistance <= 1200 && evidence.nearestTeammateDistance <= 900 && evidence.sameLaneTeammates > 0) return firing("duplicated_goal_line_layer", evidence);
      if (goalDistance >= 1800 || evidence.nearestTeammateDistance >= 1500 || evidence.sameLaneTeammates === 0) return nonFiring("separated_defensive_layers", evidence);
      return abstain("goal_line_role_overlap_unresolved", "Close goal-line positions may still cover distinct shot lines.", evidence);
    },
  },
  {
    id: "defense.shadow_distance", type: "defensive_shadow", modes: allModes,
    classify(opportunity) {
      const distance = number(opportunity.subject?.distanceToBall);
      const evidence = item(opportunity, { distanceToBall: distance, shadowState: opportunity.eventFacts?.state ?? null });
      if (!Number.isFinite(distance)) return abstain("shadow_distance_unresolved", "Subject-to-ball distance was unavailable.", evidence);
      if ((distance <= 650 || distance >= 2800) && evidence.pressure === "high" && evidence.nextTeam === "opponent") return firing("shadow_distance_outside_private_band", evidence);
      if (distance >= 950 && distance <= 2200) return nonFiring("shadow_distance_inside_private_band", evidence);
      return abstain("shadow_option_value_unresolved", "Distance without attacker orientation cannot resolve the decisive option.", evidence);
    },
  },
  {
    id: "defense.post_save_recovery", type: "post_save_recovery", modes: allModes,
    classify(opportunity) {
      const evidence = item(opportunity);
      if (evidence.nextTeam === "opponent" && evidence.nextEventSeconds <= 2) return firing("save_returned_immediate_opponent_pressure", evidence);
      if (evidence.nextTeam === "subject_team" || evidence.goalWithinWindow === false && evidence.nextEventSeconds > 2.5) return nonFiring("save_created_relief_or_team_access", evidence);
      return abstain("post_save_relief_unresolved", "The bounded window did not establish restored or sustained pressure.", evidence);
    },
  },
  {
    id: "kickoff.cheat_distance", type: "kickoff_support", modes: teamModes,
    classify(opportunity, evidenceSource) {
      const entry = kickoffEntry(opportunity, evidenceSource);
      const distance = number(entry?.start_distance_from_center);
      const behavior = entry?.support_behavior ?? (entry?.time_to_ball ? "taker" : "unknown");
      const possessionTeam = opportunity.eventFacts?.kickoff_possession_team_is_team_0 === true ? 0 : opportunity.eventFacts?.kickoff_possession_team_is_team_0 === false ? 1 : null;
      const evidence = item(opportunity, { startDistanceFromCenter: distance, supportBehavior: behavior, possessionTeam });
      if (!entry || behavior === "taker") return abstain("non_taker_kickoff_role_unresolved", "No attributable non-taker support entry was available.", evidence);
      if (behavior === "go_for_boost" && possessionTeam !== opportunity.context?.subjectTeam) return firing("boost_route_missed_kickoff_follow_up_proxy", evidence);
      if (["cheat", "follow", "defend"].includes(behavior) || possessionTeam === opportunity.context?.subjectTeam) return nonFiring("support_route_covered_immediate_outcome", evidence);
      return abstain("cheat_distance_outcome_unresolved", "Spawn distance and behavior did not resolve likely follow-up reach.", evidence);
    },
  },
  {
    id: "kickoff.role_compliance", type: "kickoff_support", modes: teamModes,
    classify(opportunity, evidenceSource) {
      const entry = kickoffEntry(opportunity, evidenceSource);
      const behavior = entry?.support_behavior ?? (entry?.time_to_ball ? "taker" : "unknown");
      const opponentOutcome = opportunity.eventFacts?.kickoff_possession_team_is_team_0 === true
        ? opportunity.context?.subjectTeam !== 0 : opportunity.eventFacts?.kickoff_possession_team_is_team_0 === false
          ? opportunity.context?.subjectTeam !== 1 : null;
      const evidence = item(opportunity, { supportBehavior: behavior, opponentOutcome, kickoffGoal: opportunity.eventFacts?.kickoff_goal ?? null });
      if (!entry) return abstain("kickoff_role_entry_missing", "Subject kickoff role was not attributable.", evidence);
      if (behavior === "go_for_boost" && opponentOutcome === true && (opportunity.eventFacts?.kickoff_goal === true || evidence.nextTeam === "opponent")) return firing("support_role_left_immediate_gap_proxy", evidence);
      if (["cheat", "follow", "defend", "taker"].includes(behavior) || opponentOutcome === false) return nonFiring("kickoff_role_covered_immediate_state", evidence);
      return abstain("kickoff_role_consequence_unresolved", "The immediate kickoff state did not establish a role failure.", evidence);
    },
  },
  {
    id: "teamplay.support_angle", type: "team_support_decision", modes: teamModes,
    classify(opportunity) {
      const angle = supportSeparationDegrees(opportunity);
      const evidence = item(opportunity, { supportSeparationDegrees: angle });
      if (!Number.isFinite(angle)) return abstain("support_angle_unresolved", "Subject, teammate or ball planar position was unavailable.", evidence);
      if (angle <= 22 && evidence.sameLaneTeammates > 0 && Math.abs(evidence.teammateAccessMarginSeconds ?? Infinity) <= 0.5) return firing("narrow_duplicate_support_angle", evidence);
      if (angle >= 38 && angle <= 135 && evidence.nearestTeammateDistance >= 1100) return nonFiring("separated_support_angle", evidence);
      return abstain("support_angle_role_value_unresolved", "The angle did not prove that a pass or challenge option was removed.", evidence);
    },
  },
  {
    id: "teamplay.role_overlap", type: "team_support_decision", modes: teamModes,
    classify(opportunity) {
      const evidence = item(opportunity);
      if (evidence.sameLaneTeammates > 0 && Math.abs(evidence.teammateAccessMarginSeconds ?? Infinity) <= 0.4 && evidence.nearestTeammateDistance <= 1500) return firing("same_lane_same_access_role_overlap", evidence);
      if (evidence.sameLaneTeammates === 0 || Math.abs(evidence.teammateAccessMarginSeconds ?? 0) >= 0.8) return nonFiring("separate_lane_or_access_role", evidence);
      return abstain("role_overlap_consequence_unresolved", "Comparable access did not establish duplicated responsibility.", evidence);
    },
  },
  {
    id: "teamplay.trust_break", type: "team_support_decision", modes: teamModes,
    classify(opportunity) {
      const evidence = item(opportunity);
      if (evidence.teammateAccessMarginSeconds <= -0.35 && evidence.sameLaneTeammates > 0 && evidence.nextTeam === "opponent") return firing("intervention_overrode_faster_teammate_proxy", evidence);
      if (evidence.teammateAccessMarginSeconds >= 0.35 || evidence.sameLaneTeammates === 0 || evidence.nextTeam === "subject_team") return nonFiring("subject_access_or_team_continuation", evidence);
      return abstain("trust_intent_unresolved", "Access geometry cannot establish communication or player intent.", evidence);
    },
  },
  {
    id: "teamplay.transition_balance", type: "rotation_transition", modes: teamModes,
    classify(opportunity) {
      const evidence = item(opportunity, { defensiveRole: opportunity.context?.defensiveRole ?? "unknown" });
      if (["opponent_half", "opponent_third"].includes(evidence.fieldZone) && evidence.subjectAheadOfBall === true && evidence.coverage === "exposed" && evidence.nextTeam === "opponent") return firing("attack_heavy_transition_without_defensive_layer", evidence);
      if (evidence.coverage === "layered" || evidence.subjectAheadOfBall === false || evidence.nextTeam === "subject_team") return nonFiring("attack_defense_layer_preserved", evidence);
      return abstain("transition_balance_value_unresolved", "The snapshot did not resolve the complete team transition.", evidence);
    },
  },
];

function evidenceRows(contract, detectorId) {
  return contract.evaluations.filter((evaluation) => evaluation.status === "firing").slice(0, 20).map((evaluation) => ({
    timeSeconds: evaluation.timestampSeconds,
    frame: evaluation.frame,
    contextKey: evaluation.contextKey,
    classification: evaluation.classification,
    description: `${detectorId} measured ${evaluation.classification.replaceAll("_", " ")}; expert review must decide whether the proxy supports the coaching label.`,
    ...(evaluation.evidence ?? {}),
  }));
}

function evaluator(config) {
  return (evidence) => {
    const contract = buildOpportunityContract({
      detectorId: config.id,
      detectorVersion: "0.2.0",
      opportunityType: config.type,
      decisionContext: evidence.decisionContext,
      classify: (opportunity) => config.classify(opportunity, evidence),
    });
    return {
      candidateCount: contract.summary.firingOpportunities,
      measurements: opportunityContractSummary(contract),
      evidence: evidenceRows(contract, config.id),
      opportunityContract: contract,
    };
  };
}

export const EXPANDED_MEASURING_DETECTORS = Object.freeze(configs.map((config) => Object.freeze({
  id: config.id,
  version: "0.2.0",
  modes: config.modes,
  evaluate: evaluator(config),
})));

if (EXPANDED_MEASURING_DETECTORS.length !== 35) {
  throw new Error(`Expanded detector suite expected 35 contracts, received ${EXPANDED_MEASURING_DETECTORS.length}.`);
}
