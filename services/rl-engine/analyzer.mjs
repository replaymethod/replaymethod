import { buildReplayEvidence, NORMALIZER_VERSION, PARSER_VERSION, ReplayInputError } from "./parser.mjs";
import { detectorCatalogSummary } from "./detector-catalog.mjs";
import { runShadowDetectors, SHADOW_RUNTIME_VERSION } from "./shadow-runtime.mjs";

export const ANALYZER_VERSION = "rocket-league-analyzer@0.1.0";
export const DETECTOR_VERSION = "rocket-league-detectors@0.1.0-shadow";
export const COACHING_VERSION = "coaching.v1";

export function analyzeReplay(bytes, requestedIdentity, rank, { publicOutputEnabled = false } = {}) {
  const evidence = buildReplayEvidence(bytes, requestedIdentity, rank);
  const normalized = evidence.normalized;
  const shadowRun = runShadowDetectors(evidence);
  const frameCount = evidence.frameState.summary.frameCount;
  const playerCount = evidence.frameState.summary.playerCount;
  const verifiedSummary = `Verified ${normalized.mode || "Rocket League match"}: ${frameCount.toLocaleString("en-US")} sampled frames and ${playerCount} players.`;

  // Deliberately no heuristic output here. The first public detectors require a
  // representative fixture corpus, timestamp verification and expert-labelled
  // precision. Parser success alone is not evidence that a coaching claim is true.
  throw new ReplayInputError(
    publicOutputEnabled ? "detectors_not_calibrated" : "public_output_disabled",
    publicOutputEnabled
      ? `${verifiedSummary} Coaching is paused until the evidence detectors pass the beta quality gate.`
      : `${verifiedSummary} The player was identified, but public coaching output remains paused by the detector safety gate.`,
    JSON.stringify({
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
    }),
  );
}
