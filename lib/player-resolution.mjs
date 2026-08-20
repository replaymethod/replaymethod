const CONTEXT_PREFIX = "replaymethod:player-resolution:v1:";

function cleanCandidates(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values
    .filter((value) => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && value.length <= 160))].slice(0, 8);
}

export function encodePlayerResolutionContext(internalMessage, candidatePlayers = []) {
  const candidates = cleanCandidates(candidatePlayers);
  if (!candidates.length) return String(internalMessage || "").slice(0, 1800);
  const context = {
    internalMessage: String(internalMessage || "").slice(0, 1000),
    candidatePlayers: candidates,
  };
  return `${CONTEXT_PREFIX}${JSON.stringify(context)}`.slice(0, 1800);
}

export function decodePlayerResolutionContext(value) {
  if (!value?.startsWith(CONTEXT_PREFIX)) {
    return { internalMessage: value || "", candidatePlayers: [] };
  }
  try {
    const parsed = JSON.parse(value.slice(CONTEXT_PREFIX.length));
    return {
      internalMessage: typeof parsed.internalMessage === "string" ? parsed.internalMessage : "",
      candidatePlayers: cleanCandidates(parsed.candidatePlayers),
    };
  } catch {
    return { internalMessage: value, candidatePlayers: [] };
  }
}
