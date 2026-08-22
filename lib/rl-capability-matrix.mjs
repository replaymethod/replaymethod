import { DETECTOR_REGISTRY, DETECTOR_REGISTRY_VERSION } from "../services/rl-engine/detector-registry.mjs";

export const RL_CAPABILITY_MATRIX_VERSION = "rocket-league-capability-matrix.v2.1";

export const RL_EVIDENCE_LANES = Object.freeze([
  Object.freeze({ platform: "pc", evidenceType: "replay_file", pipeline: "binary_replay" }),
  Object.freeze({ platform: "pc", evidenceType: "gameplay_video", pipeline: "video" }),
  Object.freeze({ platform: "pc", evidenceType: "vod_link", pipeline: "video" }),
  Object.freeze({ platform: "ps5", evidenceType: "gameplay_video", pipeline: "video" }),
  Object.freeze({ platform: "ps5", evidenceType: "vod_link", pipeline: "video" }),
  Object.freeze({ platform: "xbox", evidenceType: "gameplay_video", pipeline: "video" }),
  Object.freeze({ platform: "xbox", evidenceType: "vod_link", pipeline: "video" }),
  Object.freeze({ platform: "switch", evidenceType: "gameplay_video", pipeline: "video" }),
  Object.freeze({ platform: "switch", evidenceType: "vod_link", pipeline: "video" }),
]);

export const RL_RANK_AUDIT = Object.freeze({
  "gold-platinum": Object.freeze({
    requestedRange: "Gold I–Platinum III",
    acquiredRankFilters: Object.freeze([
      "gold-1", "gold-2", "gold-3", "platinum-1", "platinum-2", "platinum-3",
    ]),
    rankProvenance: "exact_min_and_max_filter",
    limitation: null,
  }),
  "diamond-champion": Object.freeze({
    requestedRange: "Diamond I–Champion III",
    acquiredRankFilters: Object.freeze([
      "diamond-1", "diamond-2", "diamond-3", "champion-1", "champion-2", "champion-3",
    ]),
    rankProvenance: "exact_min_and_max_filter",
    limitation: null,
  }),
  "grand-champion-ssl": Object.freeze({
    requestedRange: "Grand Champion I–III",
    acquiredRankFilters: Object.freeze(["grand-champion"]),
    rankProvenance: "rank_filter_division_unknown",
    limitation: "The private corpus proves generic Grand Champion coverage only; it cannot distinguish GC I, GC II or GC III and contains no SSL claim.",
  }),
});

const holdoutCoverage = Object.freeze({
  "1v1:gold-platinum": 3,
  "1v1:diamond-champion": 6,
  "1v1:grand-champion-ssl": 1,
  "2v2:gold-platinum": 8,
  "2v2:diamond-champion": 7,
  "2v2:grand-champion-ssl": 2,
  "3v3:gold-platinum": 8,
  "3v3:diamond-champion": 5,
  "3v3:grand-champion-ssl": 0,
});

const calibrationCoverage = Object.freeze({
  "1v1:gold-platinum": 27,
  "1v1:diamond-champion": 20,
  "1v1:grand-champion-ssl": 3,
  "2v2:gold-platinum": 30,
  "2v2:diamond-champion": 29,
  "2v2:grand-champion-ssl": 4,
  "3v3:gold-platinum": 22,
  "3v3:diamond-champion": 21,
  "3v3:grand-champion-ssl": 4,
});

function validationState({ detector, mode, lane, base }) {
  if (!detector.supportedModes.includes(mode)) return "unsupported_mode";
  if (lane.pipeline !== "binary_replay") return "evidence_pipeline_not_validated";
  if (base?.parse !== "verified" && base?.parse !== "calibration-verified") return "parser_not_validated";
  return "shadow_only";
}

/**
 * Expand parser truth into exact detector/version × mode × rank cohort ×
 * evidence type × platform cells. No cell can infer public coaching support
 * from parser support.
 */
export function buildRocketLeagueCapabilityMatrix(baseRows, options = {}) {
  const registry = options.registry ?? DETECTOR_REGISTRY;
  const lanes = options.lanes ?? RL_EVIDENCE_LANES;
  const cells = [];
  for (const base of baseRows) {
    for (const detector of registry.filter((entry) => entry.version !== "unimplemented")) {
      for (const lane of lanes) {
        const state = validationState({ detector, mode: base.mode, lane, base });
        const binaryReplay = lane.pipeline === "binary_replay";
        cells.push({
          detectorId: detector.id,
          detectorVersion: detector.version,
          registryVersion: detector.registryVersion ?? DETECTOR_REGISTRY_VERSION,
          mode: base.mode,
          rankCohort: base.rankCohort,
          evidenceType: lane.evidenceType,
          platform: lane.platform,
          validationState: state,
          upload: binaryReplay ? base.upload : "gated",
          parse: binaryReplay ? base.parse : "not_implemented",
          process: binaryReplay ? base.process : "not_implemented",
          detector: state === "shadow_only" ? "shadow-only" : "not_publicly_evaluated",
          coaching: "abstention-only",
          publicFinding: false,
          reasonCode: state === "shadow_only" ? "human_and_statistical_gate_pending" : state,
        });
      }
    }
  }
  return {
    schemaVersion: RL_CAPABILITY_MATRIX_VERSION,
    dimensions: ["detectorId", "detectorVersion", "mode", "rankCohort", "evidenceType", "platform", "validationState"],
    cells,
    rankAudit: RL_RANK_AUDIT,
    corpusCoverage: baseRows.map((base) => {
      const key = `${base.mode}:${base.rankCohort}`;
      return {
        mode: base.mode,
        rankCohort: base.rankCohort,
        calibrationReplays: calibrationCoverage[key] ?? 0,
        holdoutReplays: holdoutCoverage[key] ?? 0,
        holdoutUsedForTuning: false,
      };
    }),
    reasons: {
      human_and_statistical_gate_pending: "Replay parsing is supported, but this exact detector scope has not passed the complete two-reviewer public quality gate.",
      unsupported_mode: "This detector is not registered for this playlist mode.",
      evidence_pipeline_not_validated: "The video evidence pipeline is not validated for detector output.",
      parser_not_validated: "The parser scope is not validated.",
    },
    summary: {
      cells: cells.length,
      publicFindingCells: cells.filter((cell) => cell.publicFinding).length,
      shadowOnlyCells: cells.filter((cell) => cell.validationState === "shadow_only").length,
      abstentionCells: cells.filter((cell) => cell.coaching === "abstention-only").length,
    },
  };
}
