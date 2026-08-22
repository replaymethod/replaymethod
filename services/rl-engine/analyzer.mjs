import { buildReplayEvidence, NORMALIZER_VERSION, PARSER_VERSION } from "./parser.mjs";
import { detectorCatalogSummary } from "./detector-catalog.mjs";
import { runShadowDetectors, SHADOW_RUNTIME_VERSION } from "./shadow-runtime.mjs";

export const ANALYZER_VERSION = "rocket-league-analyzer@0.1.0";
export const DETECTOR_VERSION = "rocket-league-detectors@0.2.0-shadow";
export const COACHING_VERSION = "coaching.v1";

export function analyzeReplay(bytes, requestedIdentity, rank, { publicOutputEnabled = false } = {}) {
  const evidence = buildReplayEvidence(bytes, requestedIdentity, rank);
  const normalized = evidence.normalized;
  const shadowRun = runShadowDetectors(evidence);
  const frameCount = evidence.frameState.summary.frameCount;
  const playerCount = evidence.frameState.summary.playerCount;
  const verifiedSummary = `Verified ${normalized.mode || "Rocket League match"}: ${frameCount.toLocaleString("en-US")} sampled frames and ${playerCount} players.`;

  const code = publicOutputEnabled ? "detectors_not_calibrated" : "public_output_disabled";
  const publicMessage = publicOutputEnabled
    ? `${verifiedSummary} Coaching is paused until the evidence detectors pass the beta quality gate.`
    : `${verifiedSummary} The player was identified, but public coaching output remains paused by the detector safety gate.`;
  const internalMessage = JSON.stringify({
      mode: normalized.mode ?? null,
      versions: {
        parser: PARSER_VERSION,
        normalizer: NORMALIZER_VERSION,
        analyzer: ANALYZER_VERSION,
        detector: DETECTOR_VERSION,
        shadowRuntime: SHADOW_RUNTIME_VERSION,
        coaching: COACHING_VERSION,
        schema: "coaching.v1",
      },
      detectorCatalog: detectorCatalogSummary(),
      evidence: {
        frameState: evidence.frameState.summary,
        episodeTimeline: evidence.episodeTimeline.summary,
      },
      shadowRun: shadowRun.summary,
    });

  // Parsing and normalization are still a successful product operation when
  // no detector has earned a public claim. Return the verified match together
  // with an explicit abstention so the application can persist real processing
  // evidence and release the customer's free entitlement fairly.
  return {
    kind: "success",
    normalized: {
      ...normalized,
      metadata: {
        ...normalized.metadata,
        shadowEvaluation: shadowRun.summary,
      },
    },
    findings: [],
    abstention: { code, publicMessage, internalMessage },
    versions: {
      parser: PARSER_VERSION,
      normalizer: NORMALIZER_VERSION,
      analyzer: ANALYZER_VERSION,
      detector: DETECTOR_VERSION,
      coaching: COACHING_VERSION,
      schema: "coaching.v1",
    },
    estimatedCostMicros: 0,
  };
}
