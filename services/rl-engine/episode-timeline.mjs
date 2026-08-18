const DECISION_EVENT_TYPES = new Set([
  "backboard",
  "ball_carry",
  "boost_pickup",
  "bump",
  "center",
  "controlled_play",
  "demolition",
  "dodge",
  "dodge_reset",
  "fifty_fifty",
  "first_man_change",
  "flick",
  "goal_context",
  "half_flip",
  "kickoff",
  "loose_possession",
  "one_timer",
  "pass",
  "player_possession",
  "possession",
  "respawn",
  "rush",
  "shadow_defense",
  "speed_flip",
  "territorial_pressure",
  "touch",
  "wall_aerial",
  "wavedash",
  "whiff",
]);

function identityValue(identity) {
  if (typeof identity === "string") return identity.toLowerCase();
  if (!identity || typeof identity !== "object") return "";
  const entry = Object.entries(identity).find(([, value]) =>
    (typeof value === "string" || typeof value === "number" || typeof value === "bigint")
    && String(value).trim()
  );
  return entry ? `${entry[0].toLowerCase()}:${String(entry[1]).trim().toLowerCase()}` : "";
}

function timing(event) {
  const payload = event?.payload?.payload ?? {};
  const source = event?.meta?.timing ?? {};
  return {
    startFrame: source.start_frame ?? payload.frame ?? null,
    endFrame: source.end_frame ?? payload.end_frame ?? source.start_frame ?? payload.frame ?? null,
    startTimeSeconds: source.start_time ?? payload.time ?? null,
    endTimeSeconds: source.end_time ?? payload.end_time ?? source.start_time ?? payload.time ?? null,
  };
}

function eventPlayer(event) {
  const payload = event?.payload?.payload ?? {};
  return identityValue(event?.meta?.primary_player ?? payload.player ?? payload.primary_player);
}

function participantPlayers(value, found = new Set()) {
  if (!value || typeof value !== "object") return found;
  const direct = identityValue(value);
  if (direct && Object.keys(value).length === 1) found.add(direct);
  for (const child of Object.values(value)) {
    if (child && typeof child === "object") participantPlayers(child, found);
  }
  return found;
}

function phaseSegments(frames = []) {
  const segments = [];
  for (const frame of frames) {
    const phase = frame?.gameplay_phase ?? "unknown";
    const last = segments.at(-1);
    if (last?.phase === phase && last?.livePlay === Boolean(frame?.is_live_play)) {
      last.endFrame = frame.frame_number;
      last.endTimeSeconds = frame.time;
      last.secondsRemainingEnd = frame.seconds_remaining;
      continue;
    }
    segments.push({
      id: `phase:${segments.length + 1}`,
      phase,
      livePlay: Boolean(frame?.is_live_play),
      startFrame: frame?.frame_number ?? null,
      endFrame: frame?.frame_number ?? null,
      startTimeSeconds: frame?.time ?? null,
      endTimeSeconds: frame?.time ?? null,
      secondsRemainingStart: frame?.seconds_remaining ?? null,
      secondsRemainingEnd: frame?.seconds_remaining ?? null,
    });
  }
  return segments;
}

/**
 * Preserve parser-backed match episodes and decision events without turning
 * them into mistakes. Detector thresholds and coaching remain a later layer.
 */
export function normalizeEpisodeTimeline(statsTimeline, subjectPlayerId) {
  const rawEvents = statsTimeline?.events?.events ?? statsTimeline?.events ?? [];
  const countsByType = {};
  const subjectId = String(subjectPlayerId ?? "").toLowerCase();
  const events = [];

  for (const event of rawEvents) {
    const type = event?.payload?.kind ?? event?.meta?.stream ?? "unknown";
    countsByType[type] = (countsByType[type] ?? 0) + 1;
    if (!DECISION_EVENT_TYPES.has(type)) continue;
    const playerId = eventPlayer(event);
    const participantPlayerIds = [...participantPlayers(event?.payload?.payload ?? {})];
    if (playerId && !participantPlayerIds.includes(playerId)) participantPlayerIds.unshift(playerId);
    events.push({
      id: String(event?.meta?.id ?? `${type}:${events.length + 1}`),
      type,
      playerId: playerId || null,
      participantPlayerIds,
      subjectInvolved: Boolean(subjectId && participantPlayerIds.includes(subjectId)),
      team: typeof event?.meta?.team_is_team_0 === "boolean"
        ? (event.meta.team_is_team_0 ? 0 : 1)
        : null,
      ...timing(event),
      facts: event?.payload?.payload ?? {},
    });
  }

  const phases = phaseSegments(statsTimeline?.frames ?? []);
  return {
    schemaVersion: "rocket-league-episode-timeline.v1",
    subjectPlayerId: subjectId || null,
    phases,
    events,
    summary: {
      rawEventCount: rawEvents.length,
      decisionEventCount: events.length,
      subjectDecisionEventCount: events.filter((event) => event.subjectInvolved).length,
      phaseCount: phases.length,
      countsByType,
    },
  };
}

export function episodeTimelineSummary(timeline) {
  return {
    schemaVersion: timeline.schemaVersion,
    ...timeline.summary,
  };
}
