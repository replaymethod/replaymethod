import { boostRawToPercent } from "./boost-units.mjs";

export const PERFORMANCE_SNAPSHOT_VERSION = "rocket-league-performance-snapshot@0.2.0";

const SUPERSONIC_SPEED = 2200;
const LOW_SPEED = 400;
const FAR_FROM_BALL = 2200;

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, places = 0) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function headerValue(meta, name) {
  const entry = (Array.isArray(meta?.all_headers) ? meta.all_headers : [])
    .find((item) => Array.isArray(item) && item[0] === name);
  return entry?.[1];
}

function identityValue(identity) {
  if (typeof identity === "string") return identity.toLowerCase();
  if (!identity || typeof identity !== "object") return "";
  const entry = Object.entries(identity).find(([, value]) => String(value ?? "").trim());
  return entry ? `${entry[0].toLowerCase()}:${String(entry[1]).trim().toLowerCase()}` : "";
}

function speed3d(velocity) {
  if (![velocity?.x, velocity?.y, velocity?.z].every(Number.isFinite)) return null;
  return Math.hypot(velocity.x, velocity.y, velocity.z);
}

function distance3d(a, b) {
  if (![a?.x, a?.y, a?.z, b?.x, b?.y, b?.z].every(Number.isFinite)) return null;
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function liveAt(timeSeconds, timeline) {
  return timeline.phases.some((phase) => phase.livePlay
    && timeSeconds >= phase.startTimeSeconds
    && timeSeconds <= phase.endTimeSeconds);
}

function metric(input) {
  return {
    status: "neutral",
    applicable: true,
    version: PERFORMANCE_SNAPSHOT_VERSION,
    ...input,
  };
}

function gameClock(frame) {
  return Number.isFinite(frame?.secondsRemaining) ? Math.max(0, frame.secondsRemaining) : null;
}

function closestFrame(frames, timeSeconds) {
  if (!Number.isFinite(timeSeconds) || !frames.length) return null;
  return frames.reduce((best, frame) => (
    Math.abs(frame.timeSeconds - timeSeconds) < Math.abs(best.timeSeconds - timeSeconds) ? frame : best
  ));
}

function verifiedMoment(event, frames, input) {
  const frame = closestFrame(frames, event.startTimeSeconds);
  return {
    id: event.id,
    timestampSeconds: event.startTimeSeconds,
    gameClockSeconds: gameClock(frame),
    frameStart: event.startFrame,
    frameEnd: event.endFrame,
    evidenceKind: "verified_telemetry",
    source: `episode_timeline.${event.type}`,
    version: PERFORMANCE_SNAPSHOT_VERSION,
    ...input,
  };
}

function subjectEvents(timeline, type) {
  return timeline.events.filter((event) => event.type === type && event.subjectInvolved);
}

function buildMoments({ frames, episodeTimeline, subjectId, subjectTeam }) {
  const moments = [];
  for (const event of subjectEvents(episodeTimeline, "goal_context")) {
    const scorer = identityValue(event.facts?.scorer);
    const scoringTeam = event.facts?.scoring_team_is_team_0 === true ? 0
      : event.facts?.scoring_team_is_team_0 === false ? 1 : null;
    if (scorer === subjectId) {
      moments.push(verifiedMoment(event, frames, {
        priority: 100,
        title: "Your goal changed the scoreline",
        context: "Goal event",
        observation: `The replay recorded your final touch as the scorer at ${round(event.startTimeSeconds, 1)} seconds elapsed.`,
        consequence: "Verified result: your team added one goal.",
        betterAlternative: null,
        limitation: "A goal event proves the outcome of this play, not that every earlier decision in the possession was optimal.",
      }));
    } else if (scoringTeam !== null && scoringTeam !== subjectTeam
      && identityValue(event.facts?.defending_team_most_back_player) === subjectId) {
      moments.push(verifiedMoment(event, frames, {
        priority: 80,
        title: "Conceded-goal context",
        context: "Defensive goal event",
        observation: "The parser marked you as the most-back defender when the opponent scored.",
        consequence: "Verified result: the opponent added one goal.",
        betterAlternative: null,
        limitation: "Most-back position does not prove responsibility; the preceding team sequence still needs contextual review.",
      }));
    }
  }

  for (const event of subjectEvents(episodeTimeline, "controlled_play")) {
    moments.push(verifiedMoment(event, frames, {
      priority: 65 + Math.min(20, finite(event.facts?.duration) ?? 0),
      title: "Controlled possession",
      context: String(event.facts?.start_field_third || "Live play").replaceAll("_", " "),
      observation: `The parser recorded ${finite(event.facts?.touch_count) ?? 0} touches across ${round(finite(event.facts?.duration) ?? 0, 1)} seconds of controlled play.`,
      consequence: "This sequence preserved multiple on-ball actions instead of ending at the first touch.",
      betterAlternative: null,
      limitation: "Control duration alone does not prove that the chosen route created the best available threat.",
    }));
  }

  for (const event of subjectEvents(episodeTimeline, "pass")) {
    if (identityValue(event.facts?.passer) !== subjectId) continue;
    moments.push(verifiedMoment(event, frames, {
      priority: 60,
      title: "Completed pass sequence",
      context: String(event.facts?.pass_kind || "Team possession").replaceAll("_", " "),
      observation: `The replay linked your touch to a teammate reception after ${round(finite(event.facts?.duration) ?? 0, 1)} seconds.`,
      consequence: "Verified sequence: possession moved from your touch to a teammate.",
      betterAlternative: null,
      limitation: "A completed pass does not by itself prove that it was safer or more threatening than every alternative.",
    }));
  }

  for (const event of subjectEvents(episodeTimeline, "kickoff")) {
    const takers = [event.facts?.team_zero_taker, event.facts?.team_one_taker].filter(Boolean);
    const taker = takers.find((candidate) => identityValue(candidate?.player) === subjectId);
    if (!taker || !Number.isFinite(taker.time_to_ball)) continue;
    moments.push(verifiedMoment(event, frames, {
      priority: 55,
      title: "Kickoff contact",
      context: String(taker.spawn_position || "Kickoff spawn").replaceAll("_", " "),
      observation: `You reached the ball in ${round(taker.time_to_ball, 2)} seconds using a ${String(taker.approach || "recorded").replaceAll("_", " ")} approach.`,
      consequence: `The parser labelled the immediate kickoff outcome “${String(event.facts?.outcome || "recorded").replaceAll("_", " ")}”.`,
      betterAlternative: null,
      limitation: "One kickoff outcome cannot establish repeatable kickoff quality or isolate teammate follow-up.",
    }));
  }

  return moments
    .sort((left, right) => right.priority - left.priority || left.timestampSeconds - right.timestampSeconds)
    .slice(0, 5)
    .map((moment) => ({
      id: moment.id,
      timestampSeconds: moment.timestampSeconds,
      gameClockSeconds: moment.gameClockSeconds,
      frameStart: moment.frameStart,
      frameEnd: moment.frameEnd,
      evidenceKind: moment.evidenceKind,
      source: moment.source,
      version: moment.version,
      title: moment.title,
      context: moment.context,
      observation: moment.observation,
      consequence: moment.consequence,
      betterAlternative: moment.betterAlternative,
      limitation: moment.limitation,
    }));
}

function buildStrength(stats, timeline, subjectId) {
  const candidates = [
    [finite(stats?.Saves), "Defensive contribution", (value) => `The scoreboard recorded ${value} save${value === 1 ? "" : "s"} for you in this match.`],
    [finite(stats?.Goals), "Scoring contribution", (value) => `The scoreboard recorded ${value} goal${value === 1 ? "" : "s"} for you in this match.`],
    [finite(stats?.Assists), "Playmaking contribution", (value) => `The scoreboard recorded ${value} assist${value === 1 ? "" : "s"} for you in this match.`],
  ].filter(([value]) => Number(value) > 0);
  if (candidates.length) {
    const [value, title, copy] = candidates.sort((left, right) => Number(right[0]) - Number(left[0]))[0];
    return { title, detail: copy(Number(value)), kind: "verified_fact", limitation: "Scoreboard contribution does not measure every decision that created or prevented pressure." };
  }
  const controlled = timeline.events.filter((event) => event.type === "controlled_play" && event.subjectInvolved
    && identityValue(event.facts?.player_id) === subjectId);
  if (controlled.length) return {
    title: "Controlled-play sequence",
    detail: `The parser recorded ${controlled.length} controlled-play sequence${controlled.length === 1 ? "" : "s"} for you in this match.`,
    kind: "verified_telemetry",
    limitation: "The sequence count does not prove that every touch selected the best option.",
  };
  return null;
}

export function buildPerformanceSnapshot({ meta, subject, frameState, episodeTimeline, mode }) {
  const subjectId = String(subject.id || subject.name).toLowerCase();
  const subjectTeam = Number(subject.team);
  const stats = subject.raw?.stats ?? {};
  const teamZeroScore = finite(headerValue(meta, "Team0Score"));
  const teamOneScore = finite(headerValue(meta, "Team1Score"));
  const teamScore = subjectTeam === 0 ? teamZeroScore : teamOneScore;
  const opponentScore = subjectTeam === 0 ? teamOneScore : teamZeroScore;
  const totalSeconds = finite(headerValue(meta, "TotalSecondsPlayed")) ?? frameState.summary.durationSeconds;
  const liveFrames = frameState.frames.filter((frame) => liveAt(frame.timeSeconds, episodeTimeline));
  const subjectFrames = liveFrames.flatMap((frame) => {
    const player = frame.players.find((candidate) => candidate.id.toLowerCase() === subjectId);
    return player ? [{ frame, player }] : [];
  });
  const sampleSeconds = subjectFrames.length / Math.max(1, frameState.sampleRateHz);
  const speeds = subjectFrames.map(({ player }) => speed3d(player.linearVelocity)).filter(Number.isFinite);
  const boosts = subjectFrames.map(({ player }) => (
    Number.isFinite(player.boostPercent)
      ? player.boostPercent
      : boostRawToPercent(player.boostRaw ?? player.boost)
  )).filter(Number.isFinite);
  const distances = subjectFrames.map(({ player, frame }) => distance3d(player.position, frame.ball.position)).filter(Number.isFinite);
  const requiredScoreboardFields = ["Score", "Goals", "Assists", "Saves", "Shots"];
  if (!subjectFrames.length || !speeds.length || !boosts.length || !distances.length
    || !requiredScoreboardFields.every((field) => finite(stats?.[field]) !== null)) {
    const error = new Error("A performance snapshot requires player-linked live telemetry and the replay scoreboard.");
    error.code = "performance_snapshot_insufficient_telemetry";
    throw error;
  }
  const zeroBoostFrames = subjectFrames.filter(({ player }) => Number.isFinite(player.boost) && player.boost <= 0.5).length;
  const supersonicFrames = subjectFrames.filter(({ player }) => (speed3d(player.linearVelocity) ?? 0) >= SUPERSONIC_SPEED).length;
  const lowSpeedFarFrames = subjectFrames.filter(({ player }) => (speed3d(player.linearVelocity) ?? Infinity) <= LOW_SPEED && player.distanceToBall >= FAR_FROM_BALL).length;
  const touches = subjectEvents(episodeTimeline, "touch").filter((event) => event.playerId === subjectId);
  const controlled = subjectEvents(episodeTimeline, "controlled_play").filter((event) => event.playerId === subjectId);
  const possessions = subjectEvents(episodeTimeline, "player_possession").filter((event) => event.playerId === subjectId);
  const possessionSeconds = possessions.reduce((sum, event) => sum + (finite(event.facts?.duration) ?? 0), 0);
  const scoreboard = {
    score: finite(stats?.Score) ?? 0,
    goals: finite(stats?.Goals) ?? 0,
    assists: finite(stats?.Assists) ?? 0,
    saves: finite(stats?.Saves) ?? 0,
    shots: finite(stats?.Shots) ?? 0,
  };
  const metrics = [
    metric({ id: "scoreboard_contribution", category: "offense_defense", label: "Scoreboard contribution", displayValue: `${scoreboard.goals} G · ${scoreboard.assists} A · ${scoreboard.saves} S · ${scoreboard.shots} shot${scoreboard.shots === 1 ? "" : "s"}`, value: scoreboard.score, unit: "score", kind: "verified_fact", status: scoreboard.goals + scoreboard.assists + scoreboard.saves > 0 ? "strong" : "neutral", whatHappened: `The official replay scoreboard recorded ${scoreboard.score} score, ${scoreboard.goals} goals, ${scoreboard.assists} assists, ${scoreboard.saves} saves and ${scoreboard.shots} shot${scoreboard.shots === 1 ? "" : "s"}.`, whyItMatters: "This confirms direct recorded contributions and attempts in this match.", limitation: "Scoreboard stats do not explain positioning, decision quality or uncredited defensive work.", source: "replay_metadata.player_stats" }),
    metric({ id: "average_boost", category: "boost_economy", label: "Average boost reserve", displayValue: `${round(boosts.reduce((sum, value) => sum + value, 0) / Math.max(1, boosts.length))}%`, value: round(boosts.reduce((sum, value) => sum + value, 0) / Math.max(1, boosts.length), 1), unit: "percent", kind: "derived_metric", whatHappened: "Average sampled boost during live-play frames.", whyItMatters: "Reserve affects which challenges, recoveries and follow-up touches remain available.", limitation: "An average cannot judge whether boost was spent correctly in each situation.", source: "frame_state.player_boost", sampleCount: boosts.length }),
    metric({ id: "zero_boost_time", category: "boost_economy", label: "Time at zero boost", displayValue: `${round(zeroBoostFrames / Math.max(1, frameState.sampleRateHz), 1)}s`, value: round(zeroBoostFrames / Math.max(1, frameState.sampleRateHz), 1), unit: "seconds", kind: "derived_metric", whatHappened: "Live-play samples where recorded boost was effectively zero.", whyItMatters: "Zero reserve can reduce available recovery and challenge options.", limitation: "Zero boost is not automatically a mistake when the current job needs no additional boost.", source: "frame_state.player_boost", sampleCount: subjectFrames.length }),
    metric({ id: "average_speed", category: "movement_recovery", label: "Average live-play speed", displayValue: `${Math.round(speeds.reduce((sum, value) => sum + value, 0) / Math.max(1, speeds.length)).toLocaleString("en-US")} uu/s`, value: round(speeds.reduce((sum, value) => sum + value, 0) / Math.max(1, speeds.length), 1), unit: "uu/s", kind: "derived_metric", whatHappened: "Mean three-dimensional car speed across live-play samples.", whyItMatters: "Movement speed helps describe tempo and re-entry, but only in context.", limitation: "Higher speed is not always better; controlled defensive resets can be correct.", source: "frame_state.linear_velocity", sampleCount: speeds.length }),
    metric({ id: "supersonic_share", category: "movement_recovery", label: "Live play at supersonic", displayValue: `${round((supersonicFrames / Math.max(1, subjectFrames.length)) * 100)}%`, value: round((supersonicFrames / Math.max(1, subjectFrames.length)) * 100, 1), unit: "percent", kind: "derived_metric", whatHappened: "Share of sampled live play at or above the documented supersonic speed threshold.", whyItMatters: "It describes how often maximum ground-speed state was preserved.", limitation: "It does not prove route efficiency or whether supersonic speed was useful at that moment.", source: "frame_state.linear_velocity", sampleCount: subjectFrames.length }),
    metric({ id: "touches", category: "possession_touches", label: "Recorded touches", displayValue: touches.length.toLocaleString("en-US"), value: touches.length, unit: "touches", kind: "verified_telemetry", whatHappened: `The event timeline attributed ${touches.length} ball touches to the selected player.`, whyItMatters: "Touches locate the player's direct involvement in possessions.", limitation: "Touch count alone cannot separate useful control, clears, passes or giveaways.", source: "episode_timeline.touch", sampleCount: touches.length }),
    metric({ id: "controlled_possession", category: "possession_touches", label: "Controlled possession", displayValue: `${controlled.length} sequences · ${round(possessionSeconds, 1)}s`, value: round(possessionSeconds, 1), unit: "seconds", kind: "verified_telemetry", status: controlled.length ? "strong" : "neutral", whatHappened: `The parser identified ${controlled.length} controlled-play sequences and ${round(possessionSeconds, 1)} seconds of player-possession episodes.`, whyItMatters: "Sustained sequences show where the replay preserved more than an immediate single touch.", limitation: "Duration does not establish threat, safety or the best available alternative.", source: "episode_timeline.controlled_play+player_possession", sampleCount: controlled.length + possessions.length }),
    metric({ id: "average_ball_distance", category: "positioning", label: "Average distance to ball", displayValue: `${Math.round(distances.reduce((sum, value) => sum + value, 0) / Math.max(1, distances.length)).toLocaleString("en-US")} uu`, value: round(distances.reduce((sum, value) => sum + value, 0) / Math.max(1, distances.length), 1), unit: "uu", kind: "derived_metric", whatHappened: "Mean player-to-ball distance across sampled live play.", whyItMatters: "It describes the player's depth relative to the active play.", limitation: "Distance alone cannot determine first-, second- or last-man responsibility.", source: "frame_state.player_ball_distance", sampleCount: distances.length }),
    metric({ id: "low_speed_far_time", category: "movement_recovery", label: "Low-speed time away from play", displayValue: `${round(lowSpeedFarFrames / Math.max(1, frameState.sampleRateHz), 1)}s`, value: round(lowSpeedFarFrames / Math.max(1, frameState.sampleRateHz), 1), unit: "seconds", kind: "derived_metric", whatHappened: `Live-play samples at or below ${LOW_SPEED} uu/s while at least ${FAR_FROM_BALL} uu from the ball.`, whyItMatters: "These windows can be useful review points for recovery or deliberate reset context.", limitation: "The measurement is not a mistake label; stopping or slowing can be tactically correct.", source: "frame_state.linear_velocity+player_ball_distance", sampleCount: subjectFrames.length }),
  ];

  const teamMode = /doubles|standard|2v2|3v3/i.test(String(mode || ""));
  if (teamMode) {
    const teammateDistances = subjectFrames.flatMap(({ player, frame }) => {
      const nearest = frame.players
        .filter((candidate) => candidate.team === subjectTeam && candidate.id.toLowerCase() !== subjectId)
        .map((candidate) => distance3d(player.position, candidate.position)).filter(Number.isFinite)
        .sort((left, right) => left - right)[0];
      return Number.isFinite(nearest) ? [nearest] : [];
    });
    metrics.push(metric({ id: "nearest_teammate_distance", category: "positioning_teamplay", label: "Nearest teammate distance", displayValue: `${Math.round(teammateDistances.reduce((sum, value) => sum + value, 0) / Math.max(1, teammateDistances.length)).toLocaleString("en-US")} uu`, value: round(teammateDistances.reduce((sum, value) => sum + value, 0) / Math.max(1, teammateDistances.length), 1), unit: "uu", kind: "derived_metric", whatHappened: "Mean distance to the nearest teammate during sampled live play.", whyItMatters: "It provides context for spacing and layered coverage review.", limitation: "Distance alone cannot classify a double commit, pass option or correct support angle.", source: "frame_state.player_positions", sampleCount: teammateDistances.length }));
  }

  const overtime = frameState.frames.some((frame) => Number.isFinite(frame.secondsRemaining) && frame.secondsRemaining < 0);
  return {
    version: PERFORMANCE_SNAPSHOT_VERSION,
    match: {
      teamScore,
      opponentScore,
      result: teamScore === null || opponentScore === null ? "unknown" : teamScore > opponentScore ? "win" : teamScore < opponentScore ? "loss" : "draw",
      overtime,
      durationSeconds: round(totalSeconds, 1),
      subjectTeam,
    },
    sample: {
      liveFrameCount: subjectFrames.length,
      liveSeconds: round(sampleSeconds, 1),
      frameCoverage: frameState.summary.coverage,
    },
    strength: buildStrength(stats, episodeTimeline, subjectId),
    metrics,
    moments: buildMoments({ frames: frameState.frames, episodeTimeline, subjectId, subjectTeam }),
  };
}
