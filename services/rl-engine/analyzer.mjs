import { buildReplayEvidence, NORMALIZER_VERSION, PARSER_VERSION } from "./parser.mjs";
import { detectorCatalogSummary } from "./detector-catalog.mjs";
import { decisionEngineMetadata, runShadowDetectors, SHADOW_RUNTIME_VERSION } from "./shadow-runtime.mjs";
import { composeEarlyAccessOutput, EARLY_ACCESS_POLICY_VERSION } from "./early-access.mjs";

export const ANALYZER_VERSION = "rocket-league-analyzer@0.7.0";
export const DETECTOR_VERSION = "rocket-league-detectors@0.7.0-shadow";
export const COACHING_VERSION = "coaching.v1";

export function analyzeReplay(bytes, requestedIdentity, rank, { publicOutputEnabled = false, earlyAccessOutputEnabled = false } = {}) {
  const evidence = buildReplayEvidence(bytes, requestedIdentity, rank);
  const normalized = evidence.normalized;
  const shadowRun = runShadowDetectors(evidence);
  const decisionEngine = decisionEngineMetadata(evidence, shadowRun);
  const frameCount = evidence.frameState.summary.frameCount;
  const playerCount = evidence.frameState.summary.playerCount;
  const verifiedSummary = `Verified ${normalized.mode || "Rocket League match"}: ${frameCount.toLocaleString("en-US")} sampled frames and ${playerCount} players.`;

  if (!publicOutputEnabled && earlyAccessOutputEnabled) {
    const earlyAccess = composeEarlyAccessOutput(shadowRun, normalized);
    const metadata = {
      ...normalized.metadata,
      earlyAccess: {
        policyVersion: earlyAccess.policyVersion,
        formalValidationStatus: earlyAccess.formalValidationStatus,
        coachingStatus: earlyAccess.findings.length ? "experimental_insight" : "abstained",
        assessments: earlyAccess.assessments,
        analysisCoverage: earlyAccess.analysisCoverage,
        verifiedFacts: earlyAccess.verifiedFacts,
      },
      shadowEvaluation: shadowRun.summary,
      decisionEngine,
    };
    const common = {
      kind: "success",
      outputTier: "experimental_early_access",
      normalized: { ...normalized, metadata },
      findings: earlyAccess.findings.slice(0, 1),
      versions: {
        parser: PARSER_VERSION,
        normalizer: NORMALIZER_VERSION,
        analyzer: ANALYZER_VERSION,
        detector: DETECTOR_VERSION,
        coaching: `${COACHING_VERSION}+${EARLY_ACCESS_POLICY_VERSION}`,
        schema: "coaching.v1",
      },
      estimatedCostMicros: 0,
    };
    if (common.findings.length) return common;
    return {
      ...common,
      abstention: {
        code: "early_access_no_supported_finding",
        publicMessage: `${verifiedSummary} No experimental coaching finding cleared the evidence threshold for this replay.`,
        internalMessage: JSON.stringify({ policyVersion: earlyAccess.policyVersion, assessments: earlyAccess.assessments }),
      },
    };
  }

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
      decisionEngine: {
        schemaVersion: decisionEngine.schemaVersion,
        context: decisionEngine.context,
        adaptiveSampling: decisionEngine.adaptiveSampling,
        detectors: decisionEngine.detectors.map((detector) => ({
          detectorId: detector.detectorId,
          eligibleOpportunities: detector.eligibleOpportunities,
          firingOpportunities: detector.firingOpportunities,
          nonFiringOpportunities: detector.nonFiringOpportunities,
          abstainedOpportunities: detector.abstainedOpportunities,
        })),
      },
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
        decisionEngine,
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
