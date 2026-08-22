const CONTEXT_PREFIX = "replaymethod:player-resolution:v2:";
const LEGACY_CONTEXT_PREFIX = "replaymethod:player-resolution:v1:";

function cleanCandidates(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values
    .filter((value) => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && value.length <= 160))].slice(0, 8);
}

function cleanReplayContext(value) {
  const row = value && typeof value === "object" ? value : {};
  const bounded = (item, maximum) => typeof item === "string" ? item.trim().slice(0, maximum) || null : null;
  return {
    mode: bounded(row.mode, 80),
    gameVersion: bounded(row.gameVersion, 120),
    occurredAt: bounded(row.occurredAt, 80),
  };
}

export function encodePlayerResolutionContext(internalMessage, candidatePlayers = [], replayContext = {}) {
  const candidates = cleanCandidates(candidatePlayers);
  const parsedContext = cleanReplayContext(replayContext);
  if (!candidates.length && !Object.values(parsedContext).some(Boolean)) return String(internalMessage || "").slice(0, 1800);
  const context = {
    internalMessage: String(internalMessage || "").slice(0, 1000),
    candidatePlayers: candidates,
    replayContext: parsedContext,
  };
  return `${CONTEXT_PREFIX}${JSON.stringify(context)}`.slice(0, 1800);
}

export function decodePlayerResolutionContext(value) {
  const prefix = value?.startsWith(CONTEXT_PREFIX)
    ? CONTEXT_PREFIX
    : value?.startsWith(LEGACY_CONTEXT_PREFIX)
      ? LEGACY_CONTEXT_PREFIX
      : null;
  if (!prefix) {
    return { internalMessage: value || "", candidatePlayers: [], replayContext: cleanReplayContext({}) };
  }
  try {
    const parsed = JSON.parse(value.slice(prefix.length));
    return {
      internalMessage: typeof parsed.internalMessage === "string" ? parsed.internalMessage : "",
      candidatePlayers: cleanCandidates(parsed.candidatePlayers),
      replayContext: cleanReplayContext(parsed.replayContext),
    };
  } catch {
    return { internalMessage: value, candidatePlayers: [], replayContext: cleanReplayContext({}) };
  }
}
