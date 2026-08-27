import { normalizeMode } from "./context.mjs";
import { buildTacticalSpatialState, speed3d } from "./tactical-spatial.mjs";

import { boostRawToPercent } from "./boost-units.mjs";

export const DECISION_CONTEXT_VERSION = "rocket-league-decision-context@0.5.0";

const CHALLENGE_EVENT_TYPES = new Set(["fifty_fifty", "whiff"]);

function identityValue(identity) {
  if (typeof identity === "string") return identity.toLowerCase();
  if (!identity || typeof identity !== "object") return "";
  const entry = Object.entries(identity).find(([, value]) => String(value ?? "").trim());
  return entry ? `${entry[0].toLowerCase()}:${String(entry[1]).trim().toLowerCase()}` : "";
}

function closestFrame(frames, timeSeconds) {
  if (!frames?.length || !Number.isFinite(timeSeconds)) return null;
  return frames.reduce((best, frame) => (
    Math.abs(frame.timeSeconds - timeSeconds) < Math.abs(best.timeSeconds - timeSeconds) ? frame : best
  ));
}

function phaseState(phases, timestamp) {
  const phase = (phases ?? []).find((item) => Number.isFinite(item.startTimeSeconds)
    && Number.isFinite(item.endTimeSeconds)
    && timestamp >= item.startTimeSeconds
    && timestamp <= item.endTimeSeconds);
  return {
    matchPhase: String(phase?.phase ?? "unknown"),
    livePlay: phase ? phase.livePlay === true : null,
  };
}

function eventTeam(event, teamByPlayer) {
  if (event?.team === 0 || event?.team === 1) return event.team;
  if (event?.playerId && teamByPlayer.has(event.playerId)) return teamByPlayer.get(event.playerId);
  for (const id of event?.participantPlayerIds ?? []) if (teamByPlayer.has(id)) return teamByPlayer.get(id);
  return null;
}

function scoreState(events, timestamp, frame, subjectTeam, teamByPlayer) {
  const goals = events.filter((event) => event.type === "goal_context"
    && Number.isFinite(event.startTimeSeconds)
    && event.startTimeSeconds <= timestamp);
  const subjectScore = goals.filter((event) => {
    const scoringTeam = event.facts?.scoring_team_is_team_0 === true ? 0
      : event.facts?.scoring_team_is_team_0 === false ? 1
        : eventTeam(event, teamByPlayer);
    return scoringTeam === subjectTeam;
  }).length;
  const opponentScore = goals.length - subjectScore;
  const score = subjectTeam === 0 || subjectTeam === 1
    ? subjectScore > opponentScore ? "leading" : subjectScore < opponentScore ? "trailing" : "tied"
    : "unknown";
  const remaining = Number.isFinite(frame?.secondsRemaining) ? frame.secondsRemaining : null;
  const clock = remaining === null ? "unknown"
    : remaining <= 0 ? "overtime"
      : remaining <= 30 ? "final_30"
        : remaining <= 90 ? "final_90"
          : "normal";
  const riskAppetite = clock === "overtime" ? "sudden_death"
    : score === "leading" && ["final_30", "final_90"].includes(clock) ? "protect_lead"
      : score === "trailing" && ["final_30", "final_90"].includes(clock) ? "must_score"
        : "balanced";
  return { score, clock, riskAppetite, secondsRemaining: remaining, subjectScore, opponentScore, scoreDifferential: subjectScore - opponentScore };
}

function possessionState(events, timestamp, subjectTeam, teamByPlayer) {
  const relevant = events.filter((event) => Number.isFinite(event.startTimeSeconds)
    && event.startTimeSeconds <= timestamp
    && timestamp - event.startTimeSeconds <= 1.5
    && ["controlled_play", "loose_possession", "player_possession", "possession"].includes(event.type));
  const latest = relevant.at(-1);
  if (!latest || latest.type === "loose_possession") return "loose";
  const team = eventTeam(latest, teamByPlayer);
  if (team === subjectTeam) return latest.subjectInvolved ? "subject_control" : "team_control";
  if (team === 0 || team === 1) return "opponent_control";
  return "unknown";
}

function nextOutcome(events, timestamp, subjectTeam, teamByPlayer, horizonSeconds = 3) {
  const following = events.filter((event) => Number.isFinite(event.startTimeSeconds)
    && event.startTimeSeconds > timestamp + 0.02
    && event.startTimeSeconds <= timestamp + horizonSeconds);
  const goal = following.find((event) => event.type === "goal_context");
  const decisive = following.find((event) => ["controlled_play", "pass", "player_possession", "touch"].includes(event.type));
  const nextTeam = eventTeam(decisive, teamByPlayer);
  return {
    horizonSeconds,
    nextEventType: decisive?.type ?? null,
    nextEventSeconds: decisive ? decisive.startTimeSeconds - timestamp : null,
    nextTeam: nextTeam === subjectTeam ? "subject_team" : nextTeam === null ? "unknown" : "opponent",
    goalWithinWindow: Boolean(goal),
    goalTeam: goal ? eventTeam(goal, teamByPlayer) : null,
  };
}

const spatialState = buildTacticalSpatialState;

function isPrimarySubjectEvent(event, subjectId) {
  return String(event?.playerId ?? "").toLowerCase() === subjectId;
}

function subjectKickoffTeam(event, subjectId) {
  const teamZero = event?.facts?.team_zero_taker;
  const teamOne = event?.facts?.team_one_taker;
  if (identityValue(teamZero?.player) === subjectId) return 0;
  if (identityValue(teamOne?.player) === subjectId) return 1;
  return null;
}

function eventBallPosition(event) {
  const value = event?.facts?.ball_position;
  if (Array.isArray(value)) return { x: value[0], y: value[1], z: value[2] };
  return value && typeof value === "object" ? value : null;
}

function isDefensiveClear(event, subjectTeam) {
  if (event?.type !== "touch") return false;
  const action = event.facts?.tags?.find((tag) => tag.group === "action")?.value;
  if (!["clear", "boom"].includes(action)) return false;
  const ball = eventBallPosition(event);
  if (!Number.isFinite(ball?.y) || ![0, 1].includes(subjectTeam)) return false;
  return subjectTeam === 0 ? ball.y < 0 : ball.y > 0;
}

function opportunityTypes(event, input) {
  const types = [];
  if (event.type === "touch" && isPrimarySubjectEvent(event, input.subjectId)
    && event.facts?.tags?.some((tag) => tag.group === "reception" && tag.value === "first_touch")) {
    types.push("first_touch_retention");
    types.push("first_touch_quality");
  }
  if (CHALLENGE_EVENT_TYPES.has(event.type) && event.subjectInvolved) types.push("challenge_quality");
  if (CHALLENGE_EVENT_TYPES.has(event.type) && event.subjectInvolved) types.push("challenge_dive");
  if (CHALLENGE_EVENT_TYPES.has(event.type) && event.subjectInvolved) types.push("defensive_commitment");
  if (event.type === "boost_pickup" && isPrimarySubjectEvent(event, input.subjectId)) types.push("boost_overfill");
  if (event.type === "kickoff" && subjectKickoffTeam(event, input.subjectId) !== null) types.push("kickoff_contact");
  if (event.type === "kickoff" && subjectKickoffTeam(event, input.subjectId) !== null) types.push("kickoff_speed");
  if (event.type === "touch" && isPrimarySubjectEvent(event, input.subjectId)) types.push("possession_giveaway");
  if (event.type === "center" && isPrimarySubjectEvent(event, input.subjectId)) types.push("offense_center_outcome");
  if (event.type === "touch" && isPrimarySubjectEvent(event, input.subjectId) && isDefensiveClear(event, input.subjectTeam)) {
    types.push("defensive_clear_outcome");
    types.push("defensive_commitment");
  }
  if (input.mode !== "1v1" && ((event.type === "touch" && isPrimarySubjectEvent(event, input.subjectId))
    || (CHALLENGE_EVENT_TYPES.has(event.type) && event.subjectInvolved))) {
    types.push("team_spacing_decision");
    types.push("team_commitment_decision");
  }
  return types;
}

function eventQualifier(type, event) {
  if (type === "boost_overfill") return [event.facts?.pad_type, event.facts?.field_half, event.facts?.activity].filter(Boolean).join("_");
  if (type === "kickoff_contact") return [event.facts?.kickoff_type, event.facts?.direction].filter(Boolean).join("_");
  if (["possession_giveaway", "defensive_clear_outcome"].includes(type)) {
    return [
      event.facts?.tags?.find((tag) => tag.group === "action")?.value,
      event.facts?.play_depth,
    ].filter(Boolean).join("_");
  }
  return "";
}

function eventContext(input, event, window, type) {
  const timestamp = event.startTimeSeconds;
  const detailFrames = window?.frameIndexes?.map((index) => input.detailFramesByIndex.get(index)).filter(Boolean) ?? [];
  const frame = closestFrame(detailFrames.length ? detailFrames : input.frameState.frames, timestamp);
  const spatial = spatialState(frame, input.subjectId);
  const possession = possessionState(input.events, timestamp, input.subjectTeam, input.teamByPlayer);
  const score = scoreState(input.events, timestamp, frame, input.subjectTeam, input.teamByPlayer);
  const outcome = nextOutcome(input.events, timestamp, input.subjectTeam, input.teamByPlayer);
  const phase = phaseState(input.phases, timestamp);
  const qualifier = eventQualifier(type, event);
  const contextParts = [input.mode, type, phase.matchPhase, spatial.fieldZone ?? "unknown", spatial.accessOrder ?? "unknown", spatial.role ?? "unknown", spatial.defensiveRole ?? "unknown", possession, spatial.pressure ?? "unknown", spatial.coverage ?? "unknown", score.score, score.clock, score.riskAppetite];
  if (qualifier) contextParts.push(qualifier);
  const contextKey = contextParts.join(":");
  return {
    id: `decision:${event.id}:${type}`,
    opportunityType: type,
    sourceEventId: event.id,
    sourceEventType: event.type,
    timestampSeconds: timestamp,
    frame: event.startFrame ?? frame?.index ?? null,
    eligible: spatial.eligible,
    abstainReasons: spatial.eligible ? [] : [spatial.reason],
    contextKey,
    context: {
      mode: input.mode,
      matchPhase: phase.matchPhase,
      livePlay: phase.livePlay,
      accessOrder: spatial.accessOrder ?? "unknown",
      accessBasis: spatial.accessBasis ?? "unknown",
      timeToBallProxySeconds: spatial.subjectTimeToBallProxySeconds ?? null,
      teammateTimeToBallProxySeconds: spatial.nextTeammateTimeToBallProxySeconds ?? null,
      teammateAccessMarginSeconds: spatial.teammateAccessMarginSeconds ?? null,
      opponentTimeToBallProxySeconds: spatial.nearestOpponentTimeToBallProxySeconds ?? null,
      opponentAccessMarginSeconds: spatial.subjectOpponentAccessMarginSeconds ?? null,
      role: spatial.role ?? "unknown",
      defensiveRole: spatial.defensiveRole ?? "unknown",
      defensiveLayerIndex: spatial.defensiveLayerIndex ?? null,
      subjectGoalSide: spatial.subjectGoalSide ?? null,
      subjectAheadOfBall: spatial.subjectAheadOfBall ?? null,
      sameLaneTeammates: spatial.sameLaneTeammates ?? null,
      nearestTeammateDistanceToSubject: spatial.nearestTeammateDistanceToSubject ?? null,
      nearestTeammateDistanceToBall: spatial.nearestTeammateDistanceToBall ?? null,
      nearestTeammateTowardBall: spatial.nearestTeammateTowardBall ?? null,
      subjectTowardBall: spatial.subjectTowardBall ?? null,
      fieldZone: spatial.fieldZone ?? "unknown",
      possession,
      pressure: spatial.pressure ?? "unknown",
      coverage: spatial.coverage ?? "unknown",
      goalSideTeammates: spatial.goalSideTeammates ?? null,
      score: score.score,
      scoreDifferential: score.scoreDifferential,
      clock: score.clock,
      riskAppetite: score.riskAppetite,
      subjectTeam: input.subjectTeam,
      qualifier: qualifier || null,
    },
    subject: spatial.subject ? {
      boostPercent: spatial.subject.boostPercent ?? boostRawToPercent(spatial.subject.boostRaw ?? spatial.subject.boost),
      boostRaw: spatial.subject.boostRaw ?? spatial.subject.boost ?? null,
      speed: speed3d(spatial.subject.linearVelocity),
      distanceToBall: spatial.subject.distanceToBall,
      position: spatial.subject.position,
    } : null,
    eventFacts: event.facts ?? {},
    ball: frame?.ball ? { position: frame.ball.position, velocity: frame.ball.linearVelocity } : null,
    outcome,
    sampling: {
      macroRateHz: input.frameState.sampleRateHz ?? 10,
      detailRateHz: window?.sampleRateHz ?? null,
      detailFrameCount: window?.frameIndexes?.length ?? 0,
    },
  };
}

function uniqueDetailFrames(adaptiveSampling) {
  return (adaptiveSampling?.detailFrames ?? [])
    .filter((frame) => Number.isFinite(frame.timeSeconds))
    .sort((left, right) => left.timeSeconds - right.timeSeconds);
}

function frameOpportunity(input, { id, opportunityType, frame, eventFacts, outcome }) {
  const timestamp = frame?.timeSeconds;
  const spatial = spatialState(frame, input.subjectId);
  const possession = possessionState(input.events, timestamp, input.subjectTeam, input.teamByPlayer);
  const score = scoreState(input.events, timestamp, frame, input.subjectTeam, input.teamByPlayer);
  const phase = phaseState(input.phases, timestamp);
  const resolvedOutcome = outcome ?? nextOutcome(input.events, timestamp, input.subjectTeam, input.teamByPlayer);
  const contextKey = [
    input.mode, opportunityType, phase.matchPhase, spatial.fieldZone ?? "unknown",
    spatial.accessOrder ?? "unknown", spatial.role ?? "unknown", spatial.defensiveRole ?? "unknown",
    possession, spatial.pressure ?? "unknown", spatial.coverage ?? "unknown",
    score.score, score.clock, score.riskAppetite,
  ].join(":");
  const eligible = spatial.eligible && phase.livePlay === true;
  return {
    id,
    opportunityType,
    sourceEventId: null,
    sourceEventType: "frame_episode",
    timestampSeconds: timestamp,
    frame: frame?.index ?? null,
    eligible,
    abstainReasons: eligible ? [] : [spatial.reason ?? (phase.livePlay === false ? "not_live_play" : "live_phase_unresolved")],
    contextKey,
    context: {
      mode: input.mode,
      matchPhase: phase.matchPhase,
      livePlay: phase.livePlay,
      accessOrder: spatial.accessOrder ?? "unknown",
      accessBasis: spatial.accessBasis ?? "unknown",
      timeToBallProxySeconds: spatial.subjectTimeToBallProxySeconds ?? null,
      teammateTimeToBallProxySeconds: spatial.nextTeammateTimeToBallProxySeconds ?? null,
      teammateAccessMarginSeconds: spatial.teammateAccessMarginSeconds ?? null,
      opponentTimeToBallProxySeconds: spatial.nearestOpponentTimeToBallProxySeconds ?? null,
      opponentAccessMarginSeconds: spatial.subjectOpponentAccessMarginSeconds ?? null,
      role: spatial.role ?? "unknown",
      defensiveRole: spatial.defensiveRole ?? "unknown",
      defensiveLayerIndex: spatial.defensiveLayerIndex ?? null,
      subjectGoalSide: spatial.subjectGoalSide ?? null,
      subjectAheadOfBall: spatial.subjectAheadOfBall ?? null,
      sameLaneTeammates: spatial.sameLaneTeammates ?? null,
      nearestTeammateDistanceToSubject: spatial.nearestTeammateDistanceToSubject ?? null,
      nearestTeammateDistanceToBall: spatial.nearestTeammateDistanceToBall ?? null,
      nearestTeammateTowardBall: spatial.nearestTeammateTowardBall ?? null,
      subjectTowardBall: spatial.subjectTowardBall ?? null,
      fieldZone: spatial.fieldZone ?? "unknown",
      possession,
      pressure: spatial.pressure ?? "unknown",
      coverage: spatial.coverage ?? "unknown",
      goalSideTeammates: spatial.goalSideTeammates ?? null,
      score: score.score,
      scoreDifferential: score.scoreDifferential,
      clock: score.clock,
      riskAppetite: score.riskAppetite,
      subjectTeam: input.subjectTeam,
      qualifier: null,
    },
    subject: spatial.subject ? {
      boostPercent: spatial.subject.boostPercent ?? boostRawToPercent(spatial.subject.boostRaw ?? spatial.subject.boost),
      boostRaw: spatial.subject.boostRaw ?? spatial.subject.boost ?? null,
      speed: speed3d(spatial.subject.linearVelocity),
      distanceToBall: spatial.subject.distanceToBall,
      position: spatial.subject.position,
    } : null,
    eventFacts: eventFacts ?? {},
    ball: frame?.ball ? { position: frame.ball.position, velocity: frame.ball.linearVelocity } : null,
    outcome: resolvedOutcome,
    sampling: {
      macroRateHz: input.frameState.sampleRateHz ?? 10,
      detailRateHz: null,
      detailFrameCount: 0,
    },
  };
}

function subjectMacroFrames(input) {
  return (input.frameState?.frames ?? []).map((frame) => ({
    frame,
    subject: frame.players?.find((player) => player.id.toLowerCase() === input.subjectId),
  })).filter((item) => item.subject && Number.isFinite(item.frame.timeSeconds))
    .sort((left, right) => left.frame.timeSeconds - right.frame.timeSeconds || left.frame.index - right.frame.index);
}

function continuousFrameContexts(input) {
  const samples = subjectMacroFrames(input);
  const opportunities = [];
  let activePress = null;
  const finishPress = () => {
    if (!activePress?.samples.length) return;
    const first = activePress.samples[0];
    const last = activePress.samples.at(-1);
    const speeds = activePress.samples.map((sample) => sample.speed).filter(Number.isFinite);
    const supersonicSamples = speeds.filter((speed) => speed >= 2180).length;
    opportunities.push(frameOpportunity(input, {
      id: `decision:boost-press:${first.frame.index}`,
      opportunityType: "boost_press_efficiency",
      frame: first.frame,
      eventFacts: {
        start_frame: first.frame.index,
        end_frame: last.frame.index,
        duration_seconds: last.frame.timeSeconds - first.frame.timeSeconds,
        boost_spent_percent: activePress.samples.reduce((sum, sample) => sum + sample.boostSpentPercent, 0),
        start_speed: first.previousSpeed,
        end_speed: last.speed,
        peak_speed: speeds.length ? Math.max(...speeds) : null,
        speed_gain: Number.isFinite(first.previousSpeed) && Number.isFinite(last.speed) ? last.speed - first.previousSpeed : null,
        supersonic_fraction: speeds.length ? supersonicSamples / speeds.length : null,
        sampled_frames: activePress.samples.length,
      },
    }));
    activePress = null;
  };
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const current = samples[index];
    const previousBoost = previous.subject.boostPercent ?? boostRawToPercent(previous.subject.boostRaw ?? previous.subject.boost);
    const currentBoost = current.subject.boostPercent ?? boostRawToPercent(current.subject.boostRaw ?? current.subject.boost);
    const frameGap = current.frame.timeSeconds - previous.frame.timeSeconds;
    const boostSpentPercent = frameGap <= 0.25 && Number.isFinite(previousBoost) && Number.isFinite(currentBoost)
      ? previousBoost - currentBoost : null;
    const continuous = activePress && current.frame.timeSeconds - activePress.samples.at(-1).frame.timeSeconds <= 0.25;
    if (Number.isFinite(boostSpentPercent) && boostSpentPercent >= 0.2) {
      if (!continuous) finishPress();
      activePress ??= { samples: [] };
      activePress.samples.push({
        frame: current.frame,
        boostSpentPercent,
        speed: speed3d(current.subject.linearVelocity),
        previousSpeed: speed3d(previous.subject.linearVelocity),
      });
    } else {
      finishPress();
    }
  }
  finishPress();

  let zeroEpisode = null;
  const finishZero = (endedWithReserve) => {
    if (!zeroEpisode?.samples.length) return;
    const first = zeroEpisode.samples[0];
    const last = zeroEpisode.samples.at(-1);
    const speeds = zeroEpisode.samples.map((sample) => sample.speed).filter(Number.isFinite);
    const distances = zeroEpisode.samples.map((sample) => sample.subject.distanceToBall).filter(Number.isFinite);
    opportunities.push(frameOpportunity(input, {
      id: `decision:zero-boost:${first.frame.index}`,
      opportunityType: "zero_boost_exposure",
      frame: first.frame,
      eventFacts: {
        start_frame: first.frame.index,
        end_frame: last.frame.index,
        duration_seconds: last.frame.timeSeconds - first.frame.timeSeconds,
        ended_with_reserve: endedWithReserve,
        minimum_speed: speeds.length ? Math.min(...speeds) : null,
        mean_distance_to_ball: distances.length ? distances.reduce((sum, value) => sum + value, 0) / distances.length : null,
        sampled_frames: zeroEpisode.samples.length,
      },
    }));
    zeroEpisode = null;
  };
  for (const sample of samples) {
    const boostPercent = sample.subject.boostPercent ?? boostRawToPercent(sample.subject.boostRaw ?? sample.subject.boost);
    const atZero = Number.isFinite(boostPercent) && boostPercent <= 0.5;
    const continuous = zeroEpisode && sample.frame.timeSeconds - zeroEpisode.samples.at(-1).frame.timeSeconds <= 0.25;
    if (atZero) {
      if (!continuous) finishZero(false);
      zeroEpisode ??= { samples: [] };
      zeroEpisode.samples.push({ ...sample, speed: speed3d(sample.subject.linearVelocity) });
    } else {
      finishZero(true);
    }
  }
  finishZero(false);
  return opportunities;
}

function landingContexts(input) {
  const frames = uniqueDetailFrames(input.adaptiveSampling);
  const contexts = [];
  let lastLanding = -Infinity;
  for (let index = 1; index < frames.length; index += 1) {
    const previous = frames[index - 1];
    const current = frames[index];
    if (current.timeSeconds - previous.timeSeconds > 0.15) continue;
    const previousSubject = previous.players?.find((player) => player.id.toLowerCase() === input.subjectId);
    const currentSubject = current.players?.find((player) => player.id.toLowerCase() === input.subjectId);
    if (!previousSubject || !currentSubject
      || !Number.isFinite(previousSubject.position?.z) || !Number.isFinite(currentSubject.position?.z)
      || previousSubject.position.z <= 55 || currentSubject.position.z > 35) continue;
    if (current.timeSeconds - lastLanding < 0.5) continue;
    lastLanding = current.timeSeconds;
    const spatial = spatialState(current, input.subjectId);
    const after = frames.filter((frame) => frame.timeSeconds >= current.timeSeconds && frame.timeSeconds <= current.timeSeconds + 1.5);
    const speedSamples = after.map((frame) => ({
      frame,
      speed: speed3d(frame.players?.find((player) => player.id.toLowerCase() === input.subjectId)?.linearVelocity),
    })).filter((sample) => Number.isFinite(sample.speed));
    const useful = speedSamples.find((sample) => sample.speed >= 1000);
    const timeToUsefulSpeed = useful ? useful.frame.timeSeconds - current.timeSeconds : null;
    const outcome = timeToUsefulSpeed === null ? "unresolved"
      : timeToUsefulSpeed <= 0.8 ? "useful_reentry" : "slow_reentry";
    const possession = possessionState(input.events, current.timeSeconds, input.subjectTeam, input.teamByPlayer);
    const score = scoreState(input.events, current.timeSeconds, current, input.subjectTeam, input.teamByPlayer);
    const phase = phaseState(input.phases, current.timeSeconds);
    const contextKey = [input.mode, "recovery_reentry", phase.matchPhase, spatial.fieldZone ?? "unknown", spatial.accessOrder ?? "unknown", spatial.role ?? "unknown", spatial.defensiveRole ?? "unknown", possession, spatial.pressure ?? "unknown", spatial.coverage ?? "unknown", score.score, score.clock, score.riskAppetite].join(":");
    contexts.push({
      id: `decision:landing:${current.index}`,
      opportunityType: "recovery_reentry",
      sourceEventId: null,
      sourceEventType: "landing",
      timestampSeconds: current.timeSeconds,
      frame: current.index,
      eligible: spatial.eligible && after.length >= 6,
      abstainReasons: spatial.eligible && after.length >= 6 ? [] : [spatial.reason ?? "insufficient_post_landing_detail"],
      contextKey,
      context: {
        mode: input.mode,
        matchPhase: phase.matchPhase,
        livePlay: phase.livePlay,
        accessOrder: spatial.accessOrder ?? "unknown",
        accessBasis: spatial.accessBasis ?? "unknown",
        timeToBallProxySeconds: spatial.subjectTimeToBallProxySeconds ?? null,
        teammateTimeToBallProxySeconds: spatial.nextTeammateTimeToBallProxySeconds ?? null,
        teammateAccessMarginSeconds: spatial.teammateAccessMarginSeconds ?? null,
        opponentTimeToBallProxySeconds: spatial.nearestOpponentTimeToBallProxySeconds ?? null,
        opponentAccessMarginSeconds: spatial.subjectOpponentAccessMarginSeconds ?? null,
        role: spatial.role ?? "unknown",
        defensiveRole: spatial.defensiveRole ?? "unknown",
        defensiveLayerIndex: spatial.defensiveLayerIndex ?? null,
        subjectGoalSide: spatial.subjectGoalSide ?? null,
        subjectAheadOfBall: spatial.subjectAheadOfBall ?? null,
        sameLaneTeammates: spatial.sameLaneTeammates ?? null,
        nearestTeammateDistanceToSubject: spatial.nearestTeammateDistanceToSubject ?? null,
        nearestTeammateDistanceToBall: spatial.nearestTeammateDistanceToBall ?? null,
        nearestTeammateTowardBall: spatial.nearestTeammateTowardBall ?? null,
        subjectTowardBall: spatial.subjectTowardBall ?? null,
        fieldZone: spatial.fieldZone ?? "unknown",
        possession,
        pressure: spatial.pressure ?? "unknown",
        coverage: spatial.coverage ?? "unknown",
        score: score.score,
        scoreDifferential: score.scoreDifferential,
        clock: score.clock,
        riskAppetite: score.riskAppetite,
      },
      subject: spatial.subject ? {
        boostPercent: spatial.subject.boostPercent ?? boostRawToPercent(spatial.subject.boostRaw ?? spatial.subject.boost),
        boostRaw: spatial.subject.boostRaw ?? spatial.subject.boost ?? null,
        speed: speed3d(spatial.subject.linearVelocity),
        distanceToBall: spatial.subject.distanceToBall,
        position: spatial.subject.position,
      } : null,
      eventFacts: {},
      outcome: {
        classification: outcome,
        timeToUsefulSpeed,
        peakSpeed: speedSamples.length ? Math.max(...speedSamples.map((sample) => sample.speed)) : null,
        observationSeconds: after.at(-1)?.timeSeconds - current.timeSeconds,
      },
      sampling: {
        macroRateHz: input.frameState.sampleRateHz ?? 10,
        detailRateHz: input.adaptiveSampling?.detailSampleRateHz ?? null,
        detailFrameCount: after.length,
      },
    });
  }
  return contexts;
}

export function buildDecisionContexts({ normalized, frameState, episodeTimeline, adaptiveSampling }) {
  const subjectId = String(normalized?.subjectPlayerId ?? "").toLowerCase();
  const roster = frameState?.players ?? frameState?.frames?.[0]?.players ?? [];
  const subject = roster.find((player) => player.id.toLowerCase() === subjectId);
  const teamByPlayer = new Map(roster.map((player) => [player.id.toLowerCase(), player.team]));
  const subjectTeam = subject?.team ?? teamByPlayer.get(subjectId) ?? null;
  const events = episodeTimeline?.events ?? [];
  const mode = normalizeMode(normalized?.mode);
  const windowsByEvent = new Map((adaptiveSampling?.windows ?? []).map((window) => [window.eventId, window]));
  const detailFramesByIndex = new Map((adaptiveSampling?.detailFrames ?? []).map((frame) => [frame.index, frame]));
  const phases = episodeTimeline?.phases ?? [];
  const input = { normalized, frameState, episodeTimeline, adaptiveSampling, subjectId, subjectTeam, teamByPlayer, events, phases, mode, detailFramesByIndex };
  const eventOpportunities = events.filter((event) => Number.isFinite(event.startTimeSeconds))
    .flatMap((event) => opportunityTypes(event, input)
      .map((type) => eventContext(input, event, windowsByEvent.get(event.id), type)));
  const opportunities = [...eventOpportunities, ...landingContexts(input), ...continuousFrameContexts(input)]
    .sort((left, right) => left.timestampSeconds - right.timestampSeconds || left.id.localeCompare(right.id));

  return {
    schemaVersion: DECISION_CONTEXT_VERSION,
    subjectPlayerId: subjectId || null,
    subjectTeam,
    opportunities,
    summary: {
      opportunityCount: opportunities.length,
      eligibleCount: opportunities.filter((item) => item.eligible).length,
      abstainedCount: opportunities.filter((item) => !item.eligible).length,
      byType: opportunities.reduce((counts, item) => {
        counts[item.opportunityType] = (counts[item.opportunityType] ?? 0) + 1;
        return counts;
      }, {}),
    },
  };
}

export function decisionContextSummary(decisionContext) {
  return {
    schemaVersion: decisionContext?.schemaVersion ?? DECISION_CONTEXT_VERSION,
    ...(decisionContext?.summary ?? { opportunityCount: 0, eligibleCount: 0, abstainedCount: 0, byType: {} }),
  };
}
