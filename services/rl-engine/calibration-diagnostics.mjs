export const CALIBRATION_DIAGNOSTICS_VERSION = "rocket-league-calibration-diagnostics.v1";

function round(value, precision = 6) {
  if (!Number.isFinite(value)) return null;
  const scale = 10 ** precision;
  return Math.round(value * scale) / scale;
}

export function diagnoseCalibrationShardManifest(manifest, {
  minimumOpportunities = 30,
  extremeRateMinimumDecisions = 100,
} = {}) {
  if (!manifest?.reproducibilityFingerprint || !Array.isArray(manifest.detectors)) {
    throw new Error("Calibration diagnostics require a valid shard manifest.");
  }
  const detectors = manifest.detectors.map((detector) => {
    const opportunities = detector.opportunities ?? {};
    const decided = (opportunities.firing ?? 0) + (opportunities.non_firing ?? 0);
    const firingRate = decided ? (opportunities.firing ?? 0) / decided : null;
    const abstentionRate = opportunities.total ? (opportunities.abstained ?? 0) / opportunities.total : null;
    const issues = [];
    if (detector.executionErrors) issues.push("execution_errors");
    if (!opportunities.total) issues.push("no_opportunity_denominator");
    else if (opportunities.total < minimumOpportunities) issues.push("sparse_opportunity_denominator");
    if (opportunities.total && !decided) issues.push("all_opportunities_abstained");
    if (decided && !opportunities.firing) issues.push("no_firing_examples");
    if (decided && !opportunities.non_firing) issues.push("no_non_firing_examples");
    if (decided >= extremeRateMinimumDecisions && (firingRate <= 0.001 || firingRate >= 0.999)) {
      issues.push("extreme_engine_decision_rate");
    }
    return {
      detectorId: detector.detectorId,
      detectorVersion: detector.detectorVersion,
      replayRuns: detector.replayRuns,
      opportunityReplayCount: detector.opportunityReplayCount,
      opportunities,
      firingRateAmongDecided: round(firingRate),
      abstentionRate: round(abstentionRate),
      modeCount: Object.keys(detector.opportunityModes ?? {}).length,
      rankCohortCount: Object.keys(detector.opportunityRankCohorts ?? {}).length,
      contextCount: Object.keys(detector.opportunityContexts ?? {}).length,
      issues,
    };
  });
  const issueCounts = detectors.flatMap((detector) => detector.issues).reduce((counts, issue) => {
    counts[issue] = (counts[issue] ?? 0) + 1;
    return counts;
  }, {});
  return {
    schemaVersion: CALIBRATION_DIAGNOSTICS_VERSION,
    generatedAt: new Date().toISOString(),
    sourceReportFingerprint: manifest.reproducibilityFingerprint,
    scope: "Engine-output distribution and opportunity coverage only; not expert accuracy, recall, precision or coaching validity.",
    thresholds: { minimumOpportunities, extremeRateMinimumDecisions },
    summary: {
      detectorCount: detectors.length,
      detectorsWithIssues: detectors.filter((detector) => detector.issues.length).length,
      issueCounts,
      executionErrorCount: detectors.reduce((sum, detector) => sum + (detector.issues.includes("execution_errors") ? 1 : 0), 0),
    },
    detectors,
  };
}
