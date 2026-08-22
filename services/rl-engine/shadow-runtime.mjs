import { assessPublicDetectorGate } from "./quality-gates.mjs";
import { normalizeMode } from "./context.mjs";

export const SHADOW_RUNTIME_VERSION = "rocket-league-shadow-runtime@0.2.0";

const distance3d = (a, b) => {
  if (![a?.x, a?.y, a?.z, b?.x, b?.y, b?.z].every(Number.isFinite)) return null;
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
};

const speed3d = (velocity) => {
  if (![velocity?.x, velocity?.y, velocity?.z].every(Number.isFinite)) return null;
  return Math.hypot(velocity.x, velocity.y, velocity.z);
};

function movingToward(player, target) {
  const position = player?.position;
  const velocity = player?.linearVelocity;
  if (![position?.x, position?.y, position?.z, velocity?.x, velocity?.y, velocity?.z, target?.x, target?.y, target?.z].every(Number.isFinite)) return null;
  const dx = target.x - position.x;
  const dy = target.y - position.y;
  const dz = target.z - position.z;
  const distance = Math.hypot(dx, dy, dz);
  if (!distance) return 0;
  return (velocity.x * dx + velocity.y * dy + velocity.z * dz) / distance;
}

function episodeize(samples, qualifies, minimumSeconds, summarize) {
  const episodes = [];
  let active = null;
  for (const sample of samples) {
    const qualifying = qualifies(sample);
    const continuous = !active || sample.frame.timeSeconds - active.last.frame.timeSeconds <= 0.25;
    if (qualifying && continuous) {
      active ??= { first: sample, samples: [] };
      active.samples.push(sample);
      active.last = sample;
      continue;
    }
    if (active) {
      const durationSeconds = active.last.frame.timeSeconds - active.first.frame.timeSeconds;
      if (durationSeconds >= minimumSeconds) episodes.push(summarize(active, durationSeconds));
      active = qualifying ? { first: sample, last: sample, samples: [sample] } : null;
    }
  }
  if (active) {
    const durationSeconds = active.last.frame.timeSeconds - active.first.frame.timeSeconds;
    if (durationSeconds >= minimumSeconds) episodes.push(summarize(active, durationSeconds));
  }
  return episodes;
}

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

function supersonicBoostWaste(evidence) {
  const samples = subjectFrames(evidence);
  const wasteSamples = [];
  for (let index = 1; index < samples.length; index += 1) {
    const current = samples[index];
    const previous = samples[index - 1];
    const speed = speed3d(current.player.linearVelocity);
    const boostSpent = Number.isFinite(previous.player.boost) && Number.isFinite(current.player.boost)
      ? previous.player.boost - current.player.boost
      : 0;
    if (speed !== null && speed >= 2180 && boostSpent >= 0.4) {
      wasteSamples.push({
        frame: current.frame,
        speed,
        boostSpent,
        boostRemaining: current.player.boost,
      });
    }
  }

  // One continuous boost press is one reviewable decision. The previous
  // implementation exported every 10 Hz frame as a separate candidate, which
  // inflated review counts and could make adjacent samples look like
  // independent evidence.
  const episodes = episodeize(
    wasteSamples,
    () => true,
    0,
    (active, durationSeconds) => ({
      startTimeSeconds: active.first.frame.timeSeconds,
      startFrame: active.first.frame.index,
      endTimeSeconds: active.last.frame.timeSeconds,
      endFrame: active.last.frame.index,
      durationSeconds,
      sampledFrames: active.samples.length,
      boostSpent: active.samples.reduce((sum, item) => sum + item.boostSpent, 0),
      boostRemaining: active.last.boostRemaining,
      peakSpeed: Math.max(...active.samples.map((item) => item.speed)),
    }),
  );
  return {
    candidateCount: episodes.length,
    measurements: {
      totalBoostSpent: episodes.reduce((sum, item) => sum + item.boostSpent, 0),
      peakSpeed: Math.max(0, ...episodes.map((item) => item.peakSpeed)),
      sampledFrames: wasteSamples.length,
    },
    evidence: episodes.slice(0, 20),
  };
}

function tightTeammateSpacing(evidence) {
  const subjectId = String(evidence.normalized.subjectPlayerId ?? "").toLowerCase();
  const samples = subjectFrames(evidence).map(({ frame, player }) => {
    const teammateDistances = frame.players
      .filter((other) => other.id.toLowerCase() !== subjectId && other.team === player.team)
      .map((other) => distance3d(player.position, other.position))
      .filter(Number.isFinite);
    return { frame, player, nearestTeammateDistance: teammateDistances.length ? Math.min(...teammateDistances) : null };
  });
  const episodes = episodeize(
    samples,
    (sample) => Number.isFinite(sample.nearestTeammateDistance) && sample.nearestTeammateDistance <= 950,
    0.5,
    (active, durationSeconds) => ({
      startTimeSeconds: active.first.frame.timeSeconds,
      startFrame: active.first.frame.index,
      endTimeSeconds: active.last.frame.timeSeconds,
      endFrame: active.last.frame.index,
      durationSeconds,
      minimumDistance: Math.min(...active.samples.map((sample) => sample.nearestTeammateDistance)),
    }),
  );
  return {
    candidateCount: episodes.length,
    measurements: {
      totalSeconds: episodes.reduce((sum, item) => sum + item.durationSeconds, 0),
      closestDistance: Math.min(Infinity, ...episodes.map((item) => item.minimumDistance)),
    },
    evidence: episodes.slice(0, 20),
  };
}

function doubleCommitCandidates(evidence) {
  const subjectId = String(evidence.normalized.subjectPlayerId ?? "").toLowerCase();
  const samples = subjectFrames(evidence).map(({ frame, player }) => {
    const subjectDistance = distance3d(player.position, frame.ball?.position);
    const teammate = frame.players
      .filter((other) => other.id.toLowerCase() !== subjectId && other.team === player.team)
      .map((other) => ({
        player: other,
        distance: distance3d(other.position, frame.ball?.position),
        toward: movingToward(other, frame.ball?.position),
      }))
      .filter((item) => Number.isFinite(item.distance))
      .sort((a, b) => a.distance - b.distance)[0];
    return {
      frame,
      player,
      subjectDistance,
      subjectToward: movingToward(player, frame.ball?.position),
      teammateDistance: teammate?.distance ?? null,
      teammateToward: teammate?.toward ?? null,
    };
  });
  const episodes = episodeize(
    samples,
    (sample) => sample.subjectDistance <= 900 && sample.teammateDistance <= 900 && sample.subjectToward >= 250 && sample.teammateToward >= 250,
    0.2,
    (active, durationSeconds) => ({
      startTimeSeconds: active.first.frame.timeSeconds,
      startFrame: active.first.frame.index,
      endTimeSeconds: active.last.frame.timeSeconds,
      endFrame: active.last.frame.index,
      durationSeconds,
      closestCombinedDistance: Math.min(...active.samples.map((sample) => sample.subjectDistance + sample.teammateDistance)),
    }),
  );
  return {
    candidateCount: episodes.length,
    measurements: { totalSeconds: episodes.reduce((sum, item) => sum + item.durationSeconds, 0) },
    evidence: episodes.slice(0, 20),
  };
}

function momentumLossCandidates(evidence) {
  const samples = subjectFrames(evidence).map(({ frame, player }) => ({
    frame,
    player,
    speed: speed3d(player.linearVelocity),
  }));
  const episodes = episodeize(
    samples,
    (sample) => sample.speed !== null && sample.speed <= 400 && sample.player.distanceToBall >= 2200,
    0.8,
    (active, durationSeconds) => ({
      startTimeSeconds: active.first.frame.timeSeconds,
      startFrame: active.first.frame.index,
      endTimeSeconds: active.last.frame.timeSeconds,
      endFrame: active.last.frame.index,
      durationSeconds,
      minimumSpeed: Math.min(...active.samples.map((sample) => sample.speed)),
      meanDistanceToBall: active.samples.reduce((sum, sample) => sum + sample.player.distanceToBall, 0) / active.samples.length,
    }),
  );
  return {
    candidateCount: episodes.length,
    measurements: { totalSeconds: episodes.reduce((sum, item) => sum + item.durationSeconds, 0) },
    evidence: episodes.slice(0, 20),
  };
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
  Object.freeze({ id: "boost.zero_duration", version: "0.1.0", modes: ["1v1", "2v2", "3v3"], evaluate: zeroBoostExposure }),
  Object.freeze({ id: "boost.supersonic_waste", version: "0.2.0", modes: ["1v1", "2v2", "3v3"], evaluate: supersonicBoostWaste }),
  Object.freeze({ id: "kickoff.speed", version: "0.1.0", modes: ["1v1", "2v2", "3v3"], evaluate: subjectKickoffs }),
  Object.freeze({ id: "possession.first_touch", version: "0.1.0", modes: ["1v1", "2v2", "3v3"], evaluate: subjectFirstTouches }),
  Object.freeze({ id: "challenge.dive", version: "0.1.0", modes: ["1v1", "2v2", "3v3"], evaluate: subjectDiveCandidates }),
  Object.freeze({ id: "rotation.spacing_too_close", version: "0.1.0", modes: ["2v2", "3v3"], evaluate: tightTeammateSpacing }),
  Object.freeze({ id: "teamplay.double_commit", version: "0.1.0", modes: ["2v2", "3v3"], evaluate: doubleCommitCandidates }),
  Object.freeze({ id: "recovery.momentum_loss", version: "0.1.0", modes: ["1v1", "2v2", "3v3"], evaluate: momentumLossCandidates }),
]);

export function runShadowDetectors(evidence, detectors = SHADOW_DETECTORS) {
  const mode = normalizeMode(evidence.normalized.mode);
  const runs = detectors.map((detector) => {
    if (mode !== "unknown" && Array.isArray(detector.modes) && !detector.modes.includes(mode)) {
      return {
        detectorId: detector.id,
        detectorVersion: detector.version,
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
      executed: runs.filter((run) => !["error", "not_applicable"].includes(run.status)).length,
      notApplicable: runs.filter((run) => run.status === "not_applicable").length,
      errors: runs.filter((run) => run.status === "error").length,
      observed: runs.filter((run) => run.status === "observed").length,
      candidateCount: runs.reduce((sum, run) => sum + run.candidateCount, 0),
      publicEligible: runs.filter((run) => run.qualityGate.eligible).length,
    },
  };
}
