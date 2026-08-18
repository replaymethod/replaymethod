import { assessPublicDetectorGate } from "./quality-gates.mjs";

export const SHADOW_RUNTIME_VERSION = "rocket-league-shadow-runtime@0.1.0";

function identityValue(identity) {
  if (typeof identity === "string") return identity.toLowerCase();
  if (!identity || typeof identity !== "object") return "";
  const entry = Object.entries(identity).find(([, value]) => String(value ?? "").trim());
  return entry ? `${entry[0].toLowerCase()}:${String(entry[1]).trim().toLowerCase()}` : "";
}

function liveAt(timeSeconds, timeline) {
  return timeline.phases.some((phase) => phase.livePlay
    && timeSeconds >= phase.startTimeSeconds
    && timeSeconds <= phase.endTimeSeconds);
}

function subjectFrames(evidence) {
  const subjectId = String(evidence.normalized.subjectPlayerId ?? "").toLowerCase();
  return evidence.frameState.frames.map((frame) => ({
    frame,
    player: frame.players.find((player) => player.id.toLowerCase() === subjectId),
  })).filter(({ frame, player }) => player && liveAt(frame.timeSeconds, evidence.episodeTimeline));
}

function zeroBoostExposure(evidence) {
  const samples = subjectFrames(evidence);
  const episodes = [];
  let active = null;
  for (const sample of samples) {
    const atZero = sample.player.boost !== null && sample.player.boost <= 0.5;
    const previousTime = active?.lastTime;
    const continuous = previousTime === undefined || sample.frame.timeSeconds - previousTime <= 0.25;
    if (atZero && (!active || continuous)) {
      active ??= { startTimeSeconds: sample.frame.timeSeconds, startFrame: sample.frame.index };
      active.lastTime = sample.frame.timeSeconds;
      active.endFrame = sample.frame.index;
      continue;
    }
    if (active) {
      const durationSeconds = active.lastTime - active.startTimeSeconds;
      if (durationSeconds >= 0.5) episodes.push({ ...active, endTimeSeconds: active.lastTime, durationSeconds });
      active = null;
    }
  }
  if (active) {
    const durationSeconds = active.lastTime - active.startTimeSeconds;
    if (durationSeconds >= 0.5) episodes.push({ ...active, endTimeSeconds: active.lastTime, durationSeconds });
  }
  return {
    candidateCount: episodes.length,
    measurements: {
      totalSeconds: episodes.reduce((sum, episode) => sum + episode.durationSeconds, 0),
      longestSeconds: Math.max(0, ...episodes.map((episode) => episode.durationSeconds)),
    },
    evidence: episodes.slice(0, 20),
  };
}

function subjectKickoffs(evidence) {
  const subjectId = String(evidence.normalized.subjectPlayerId ?? "").toLowerCase();
  const observations = [];
  for (const event of evidence.episodeTimeline.events.filter((item) => item.type === "kickoff" && item.subjectInvolved)) {
    const takers = [event.facts?.team_zero_taker, event.facts?.team_one_taker].filter(Boolean);
    const taker = takers.find((item) => identityValue(item?.player) === subjectId);
    if (!taker || !Number.isFinite(taker.time_to_ball)) continue;
    observations.push({
      startTimeSeconds: event.startTimeSeconds,
      timeToBallSeconds: taker.time_to_ball,
      spawnPosition: taker.spawn_position ?? null,
      approach: taker.approach ?? null,
      contactGap: Number.isFinite(taker.contact_gap) ? taker.contact_gap : null,
      outcome: event.facts?.outcome ?? null,
    });
  }
  const times = observations.map((item) => item.timeToBallSeconds);
  return {
    candidateCount: observations.length,
    measurements: {
      meanTimeToBallSeconds: times.length ? times.reduce((sum, value) => sum + value, 0) / times.length : null,
      fastestTimeToBallSeconds: times.length ? Math.min(...times) : null,
      slowestTimeToBallSeconds: times.length ? Math.max(...times) : null,
    },
    evidence: observations.slice(0, 20),
  };
}

function subjectFirstTouches(evidence) {
  const touches = evidence.episodeTimeline.events.filter((event) => {
    if (event.type !== "touch" || !event.subjectInvolved) return false;
    return event.facts?.tags?.some((tag) => tag.group === "reception" && tag.value === "first_touch");
  });
  return {
    candidateCount: touches.length,
    measurements: {
      actionCounts: touches.reduce((counts, event) => {
        const action = event.facts?.tags?.find((tag) => tag.group === "action")?.value ?? "unclassified";
        counts[action] = (counts[action] ?? 0) + 1;
        return counts;
      }, {}),
    },
    evidence: touches.slice(0, 20).map((event) => ({
      timeSeconds: event.startTimeSeconds,
      frame: event.startFrame,
      role: event.facts?.role ?? null,
      tags: event.facts?.tags ?? [],
      ballSpeedChange: event.facts?.ball_speed_change ?? null,
    })),
  };
}

function subjectDiveCandidates(evidence) {
  const whiffs = evidence.episodeTimeline.events.filter((event) => event.type === "whiff" && event.subjectInvolved);
  return {
    candidateCount: whiffs.length,
    measurements: {
      beatenToBall: whiffs.filter((event) => event.facts?.kind === "beaten_to_ball").length,
      aerial: whiffs.filter((event) => event.facts?.aerial === true).length,
    },
    evidence: whiffs.slice(0, 20).map((event) => ({
      timeSeconds: event.startTimeSeconds,
      frame: event.startFrame,
      kind: event.facts?.kind ?? null,
      closestApproachDistance: event.facts?.closest_approach_distance ?? null,
      approachSpeed: event.facts?.approach_speed ?? null,
      aerial: event.facts?.aerial ?? null,
    })),
  };
}

export const SHADOW_DETECTORS = Object.freeze([
  Object.freeze({ id: "boost.zero_duration", version: "0.1.0", evaluate: zeroBoostExposure }),
  Object.freeze({ id: "kickoff.speed", version: "0.1.0", evaluate: subjectKickoffs }),
  Object.freeze({ id: "possession.first_touch", version: "0.1.0", evaluate: subjectFirstTouches }),
  Object.freeze({ id: "challenge.dive", version: "0.1.0", evaluate: subjectDiveCandidates }),
]);

export function runShadowDetectors(evidence, detectors = SHADOW_DETECTORS) {
  const runs = detectors.map((detector) => {
    try {
      const observation = detector.evaluate(evidence);
      return {
        detectorId: detector.id,
        detectorVersion: detector.version,
        lifecycle: "shadow",
        public: false,
        status: observation.candidateCount ? "observed" : "no_signal",
        ...observation,
        qualityGate: assessPublicDetectorGate(),
      };
    } catch (error) {
      return {
        detectorId: detector.id,
        detectorVersion: detector.version,
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
      executed: runs.filter((run) => run.status !== "error").length,
      errors: runs.filter((run) => run.status === "error").length,
      observed: runs.filter((run) => run.status === "observed").length,
      candidateCount: runs.reduce((sum, run) => sum + run.candidateCount, 0),
      publicEligible: runs.filter((run) => run.qualityGate.eligible).length,
    },
  };
}
