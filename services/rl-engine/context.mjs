export const CONTEXT_SCHEMA_VERSION = "rocket-league-context.v1";

export const SUPPORTED_MODES = Object.freeze(["1v1", "2v2", "3v3"]);
export const RANK_COHORTS = Object.freeze([
  "bronze-silver",
  "gold-platinum",
  "diamond-champion",
  "grand-champion-ssl",
  "unranked-unknown",
]);
export const MATCH_PHASES = Object.freeze([
  "kickoff",
  "neutral",
  "attack",
  "defense",
  "transition",
  "dead-ball",
  "unknown",
]);
export const PLAYER_ROLES = Object.freeze([
  "first",
  "second",
  "last",
  "solo",
  "unknown",
]);
export const PRESSURE_STATES = Object.freeze(["low", "medium", "high", "unknown"]);
export const POSSESSION_STATES = Object.freeze(["team", "opponent", "contested", "loose", "unknown"]);

const clean = (value) => String(value ?? "").trim().toLowerCase();

export function normalizeMode(value) {
  const mode = clean(value);
  if (/\b(1v1|duel|ones?)\b/.test(mode)) return "1v1";
  if (/\b(2v2|doubles?|twos?)\b/.test(mode)) return "2v2";
  if (/\b(3v3|standard|threes?)\b/.test(mode)) return "3v3";
  return "unknown";
}

export function normalizeRankCohort(value) {
  const rank = clean(value);
  if (/\b(bronze|silver)\b/.test(rank)) return "bronze-silver";
  if (/\b(gold|platinum|plat)\b/.test(rank)) return "gold-platinum";
  if (/\b(grand champion|grand-champion|gc\b|supersonic legend|ssl\b)/.test(rank)) return "grand-champion-ssl";
  if (/\b(diamond|champion|champ)\b/.test(rank)) return "diamond-champion";
  return "unranked-unknown";
}

function member(value, allowed, fallback = "unknown") {
  return allowed.includes(value) ? value : fallback;
}

export function canonicalContext(input = {}) {
  const mode = normalizeMode(input.mode);
  const rankCohort = normalizeRankCohort(input.rank ?? input.rankCohort);
  return Object.freeze({
    schemaVersion: CONTEXT_SCHEMA_VERSION,
    mode,
    rankCohort,
    playerRole: member(clean(input.playerRole), PLAYER_ROLES),
    matchPhase: member(clean(input.matchPhase), MATCH_PHASES),
    pressure: member(clean(input.pressure), PRESSURE_STATES),
    possession: member(clean(input.possession), POSSESSION_STATES),
    teammateCount: Number.isInteger(input.teammateCount) && input.teammateCount >= 0 ? input.teammateCount : null,
    opponentCount: Number.isInteger(input.opponentCount) && input.opponentCount >= 0 ? input.opponentCount : null,
    scoreDifferential: Number.isInteger(input.scoreDifferential) ? input.scoreDifferential : null,
    secondsRemaining: Number.isFinite(input.secondsRemaining) ? input.secondsRemaining : null,
    gameVersion: clean(input.gameVersion) || null,
  });
}

export function cohortKey(input = {}) {
  const context = input.schemaVersion === CONTEXT_SCHEMA_VERSION ? input : canonicalContext(input);
  return `${context.mode}:${context.rankCohort}`;
}

export const ABSTENTION_CODES = Object.freeze([
  "insufficient_evidence",
  "insufficient_sample",
  "unsupported_mode",
  "unsupported_context",
  "identity_unresolved",
  "parser_coverage_low",
  "detector_not_enabled",
  "detector_dependency_missing",
  "detector_conflict",
  "version_drift",
  "quality_regression",
  "public_output_disabled",
]);

export function abstention(code, detail, context = {}) {
  if (!ABSTENTION_CODES.includes(code)) throw new Error(`Unknown abstention code: ${code}`);
  return {
    status: "insufficient_evidence",
    public: false,
    code,
    detail: String(detail || "Evidence is insufficient for a reliable finding.").slice(0, 500),
    context: canonicalContext(context),
  };
}
