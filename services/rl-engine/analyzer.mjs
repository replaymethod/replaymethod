import { inspectReplay, NORMALIZER_VERSION, PARSER_VERSION, ReplayInputError } from "./parser.mjs";
import { detectorCatalogSummary } from "./detector-catalog.mjs";

export const ANALYZER_VERSION = "rocket-league-analyzer@0.1.0";
export const DETECTOR_VERSION = "rocket-league-detectors@0.0.0-disabled";
export const COACHING_VERSION = "coaching.v1";

export function analyzeReplay(bytes, requestedIdentity, rank) {
  const normalized = inspectReplay(bytes, requestedIdentity, rank);

  // Deliberately no heuristic output here. The first public detectors require a
  // representative fixture corpus, timestamp verification and expert-labelled
  // precision. Parser success alone is not evidence that a coaching claim is true.
  throw new ReplayInputError(
    "detectors_not_calibrated",
    "Your replay parsed successfully and the player was identified. Coaching is paused until the evidence detectors pass the beta quality gate.",
    JSON.stringify({
      subject: normalized.subjectDisplayName,
      mode: normalized.mode ?? null,
      versions: {
        parser: PARSER_VERSION,
        normalizer: NORMALIZER_VERSION,
        analyzer: ANALYZER_VERSION,
        detector: DETECTOR_VERSION,
        coaching: COACHING_VERSION,
        schema: "coaching.v1",
      },
      detectorCatalog: detectorCatalogSummary(),
    }),
  );
}
