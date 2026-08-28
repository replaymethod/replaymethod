import { createHash } from "node:crypto";
import { MECHANICS_MODEL_VERSION } from "./mechanics-model.mjs";

export const MECHANICS_SIGNATURE_VERSION = "rocket-league-mechanics-signature@0.1.0";
export const MECHANICS_SIGNATURE_COMPARISON_VERSION = "rocket-league-mechanics-signature-comparison@0.1.0";

const TOUCH_METRICS = Object.freeze([
  "approachSpeed",
  "relativeCarBallSpeed",
  "approachToBallDegrees",
  "approachAngularSpeed",
  "ballSpeedDelta",
  "ballDirectionChangeDegrees",
  "postTouchCloseControlFraction",
  "postTouchMedianDistanceToBall",
]);

const RECOVERY_METRICS = Object.freeze([
  "touchdownSpeed",
  "touchdownPlanarSpeed",
  "verticalImpactSpeed",
  "uprightDeviationDegrees",
  "forwardToVelocityDegrees",
  "forwardToBallDegrees",
  "timeToUsefulSpeed",
  "timeToStableHeading",
  "postLandingPeakSpeed",
  "wallToGroundSeconds",
]);

function percentile(values, fraction) {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!sorted.length) return null;
  return sorted[Math.round((sorted.length - 1) * fraction)];
}

function distribution(values, minimumSamples) {
  const finite = values.filter(Number.isFinite);
  const p25 = percentile(finite, 0.25);
  const median = percentile(finite, 0.5);
  const p75 = percentile(finite, 0.75);
  const iqr = Number.isFinite(p25) && Number.isFinite(p75) ? p75 - p25 : null;
  return {
    status: finite.length >= minimumSamples ? "measured" : "sparse",
    sampleCount: finite.length,
    median,
    p25,
    p75,
    iqr,
    dispersionRatio: Number.isFinite(iqr) && Number.isFinite(median)
      ? iqr / Math.max(1, Math.abs(median))
      : null,
  };
}

function groupedEpisodes(entries, key) {
  const groups = new Map();
  for (const entry of entries) {
    const group = String(entry[key] ?? "unknown");
    const current = groups.get(group) ?? [];
    current.push(entry);
    groups.set(group, current);
  }
  return groups;
}

function metricGroups(entries, groupKey, metricKeys, minimumSamples) {
  return Object.fromEntries([...groupedEpisodes(entries, groupKey).entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([group, episodes]) => [group, {
      episodeCount: episodes.length,
      metrics: Object.fromEntries(metricKeys.map((metric) => [
        metric,
        distribution(episodes.map((episode) => episode.metrics?.[metric]), minimumSamples),
      ])),
    }]));
}

function signatureId(replayIds, modelVersion, minimumSamples) {
  return `ms_${createHash("sha256").update(JSON.stringify({
    schemaVersion: MECHANICS_SIGNATURE_VERSION,
    modelVersion,
    minimumSamples,
    replayIds: [...replayIds].sort(),
    touchMetrics: TOUCH_METRICS,
    recoveryMetrics: RECOVERY_METRICS,
  })).digest("hex").slice(0, 24)}`;
}

function comparisonKey(modelVersion, minimumSamples) {
  return `msc_${createHash("sha256").update(JSON.stringify({
    schemaVersion: MECHANICS_SIGNATURE_COMPARISON_VERSION,
    signatureVersion: MECHANICS_SIGNATURE_VERSION,
    modelVersion,
    minimumSamples,
    touchMetrics: TOUCH_METRICS,
    recoveryMetrics: RECOVERY_METRICS,
  })).digest("hex").slice(0, 24)}`;
}

/**
 * Aggregate like-for-like mechanics observations across replays. Dispersion is
 * descriptive repeatability evidence, never a skill grade or rank comparison.
 */
export function buildMechanicsSignature(inputs = [], options = {}) {
  const minimumReplays = Number.isInteger(options.minimumReplays) ? Math.max(2, options.minimumReplays) : 5;
  const minimumSamples = Number.isInteger(options.minimumSamples) ? Math.max(3, options.minimumSamples) : 20;
  const unique = new Map();
  for (const input of inputs) {
    const replayId = String(input?.replayId ?? "").trim();
    const model = input?.mechanicsModel;
    if (!replayId || !model || unique.has(replayId)) continue;
    if (model.schemaVersion !== MECHANICS_MODEL_VERSION) {
      throw new Error("Mechanics signature cannot mix mechanics-model versions.");
    }
    unique.set(replayId, model);
  }
  const models = [...unique.values()];
  const touches = models.flatMap((model) => model.touches ?? []).filter((episode) => episode.eligible === true);
  const recoveries = models.flatMap((model) => model.recoveries ?? []).filter((episode) => episode.eligible === true);
  const replayCount = models.length;
  const enoughReplays = replayCount >= minimumReplays;
  const enoughEpisodes = touches.length + recoveries.length >= minimumSamples;
  return {
    schemaVersion: MECHANICS_SIGNATURE_VERSION,
    signatureId: signatureId(unique.keys(), MECHANICS_MODEL_VERSION, minimumSamples),
    comparisonKey: comparisonKey(MECHANICS_MODEL_VERSION, minimumSamples),
    mechanicsModelVersion: MECHANICS_MODEL_VERSION,
    publicationStatus: "private_shadow",
    status: enoughReplays && enoughEpisodes ? "measured" : "insufficient_exposure",
    replayCount,
    episodeCounts: { touches: touches.length, recoveries: recoveries.length },
    gates: { enoughReplays, enoughEpisodes },
    thresholds: { minimumReplays, minimumSamples },
    touchBySurface: metricGroups(touches, "contactSurface", TOUCH_METRICS, minimumSamples),
    recoveryBySourceSurface: metricGroups(recoveries, "sourceSurface", RECOVERY_METRICS, minimumSamples),
    executionEventCounts: models.reduce((counts, model) => {
      for (const [event, count] of Object.entries(model.summary?.executionEventCounts ?? {})) {
        counts[event] = (counts[event] ?? 0) + count;
      }
      return counts;
    }, {}),
    limitation: "This signature measures within-player kinematic distributions across supplied replays. It is not a mechanics grade, diagnosis, rank benchmark or proof of improvement.",
  };
}

function comparisonId(baseline, followup) {
  return `msc_run_${createHash("sha256").update(JSON.stringify({
    schemaVersion: MECHANICS_SIGNATURE_COMPARISON_VERSION,
    comparisonKey: baseline.comparisonKey,
    baselineSignatureId: baseline.signatureId,
    followupSignatureId: followup.signatureId,
  })).digest("hex").slice(0, 24)}`;
}

function compareDistribution(baseline, followup) {
  const comparable = baseline?.status === "measured"
    && followup?.status === "measured"
    && Number.isFinite(baseline?.median)
    && Number.isFinite(followup?.median);
  if (!comparable) {
    return {
      status: "insufficient_exposure",
      baselineSampleCount: baseline?.sampleCount ?? 0,
      followupSampleCount: followup?.sampleCount ?? 0,
      baselineMedian: baseline?.median ?? null,
      followupMedian: followup?.median ?? null,
      medianDelta: null,
      relativeMedianDelta: null,
      interpretation: "withheld",
    };
  }
  const medianDelta = followup.median - baseline.median;
  return {
    status: "descriptive_delta",
    baselineSampleCount: baseline.sampleCount,
    followupSampleCount: followup.sampleCount,
    baselineMedian: baseline.median,
    followupMedian: followup.median,
    medianDelta,
    relativeMedianDelta: Math.abs(baseline.median) > 1e-9 ? medianDelta / Math.abs(baseline.median) : null,
    baselineIqr: baseline.iqr ?? null,
    followupIqr: followup.iqr ?? null,
    iqrDelta: Number.isFinite(baseline.iqr) && Number.isFinite(followup.iqr)
      ? followup.iqr - baseline.iqr
      : null,
    interpretation: "direction_only_not_improvement",
  };
}

function compareGroups(baselineGroups = {}, followupGroups = {}) {
  const groupNames = [...new Set([...Object.keys(baselineGroups), ...Object.keys(followupGroups)])].sort();
  return Object.fromEntries(groupNames.map((group) => {
    const baseline = baselineGroups[group];
    const followup = followupGroups[group];
    const metricNames = [...new Set([
      ...Object.keys(baseline?.metrics ?? {}),
      ...Object.keys(followup?.metrics ?? {}),
    ])].sort();
    return [group, {
      baselineEpisodeCount: baseline?.episodeCount ?? 0,
      followupEpisodeCount: followup?.episodeCount ?? 0,
      metrics: Object.fromEntries(metricNames.map((metric) => [
        metric,
        compareDistribution(baseline?.metrics?.[metric], followup?.metrics?.[metric]),
      ])),
    }];
  }));
}

function comparisonCounts(groups) {
  const rows = Object.values(groups).flatMap((group) => Object.values(group.metrics ?? {}));
  return {
    metricCount: rows.length,
    comparableMetricCount: rows.filter((row) => row.status === "descriptive_delta").length,
    withheldMetricCount: rows.filter((row) => row.status !== "descriptive_delta").length,
  };
}

/**
 * Compare two version-compatible mechanics signatures. Numeric movement is
 * descriptive only: metric direction is not universally equivalent to skill
 * improvement and no causal or statistical-significance claim is emitted.
 */
export function compareMechanicsSignatures(baseline, followup) {
  for (const [name, signature] of [["baseline", baseline], ["followup", followup]]) {
    if (signature?.schemaVersion !== MECHANICS_SIGNATURE_VERSION) {
      throw new Error(`${name} mechanics signature has an unsupported schema version.`);
    }
    if (!signature.signatureId || !signature.comparisonKey) {
      throw new Error(`${name} mechanics signature is missing comparison provenance.`);
    }
  }
  if (baseline.mechanicsModelVersion !== followup.mechanicsModelVersion
    || baseline.comparisonKey !== followup.comparisonKey) {
    throw new Error("Mechanics signatures are not version- and threshold-compatible.");
  }
  if (baseline.signatureId === followup.signatureId) {
    throw new Error("Mechanics comparison requires distinct baseline and follow-up signatures.");
  }
  const exposurePassed = baseline.status === "measured" && followup.status === "measured";
  const touchBySurface = compareGroups(baseline.touchBySurface, followup.touchBySurface);
  const recoveryBySourceSurface = compareGroups(
    baseline.recoveryBySourceSurface,
    followup.recoveryBySourceSurface,
  );
  const touchCounts = comparisonCounts(touchBySurface);
  const recoveryCounts = comparisonCounts(recoveryBySourceSurface);
  return {
    schemaVersion: MECHANICS_SIGNATURE_COMPARISON_VERSION,
    comparisonId: comparisonId(baseline, followup),
    comparisonKey: baseline.comparisonKey,
    mechanicsModelVersion: baseline.mechanicsModelVersion,
    publicationStatus: "private_shadow",
    status: exposurePassed && touchCounts.comparableMetricCount + recoveryCounts.comparableMetricCount > 0
      ? "descriptive_change_measured"
      : "insufficient_exposure",
    baseline: {
      signatureId: baseline.signatureId,
      replayCount: baseline.replayCount,
      episodeCounts: baseline.episodeCounts,
    },
    followup: {
      signatureId: followup.signatureId,
      replayCount: followup.replayCount,
      episodeCounts: followup.episodeCounts,
    },
    gates: {
      exposurePassed,
      versionCompatible: true,
      distinctSignatures: true,
      improvementClaimEligible: false,
    },
    summary: {
      metricCount: touchCounts.metricCount + recoveryCounts.metricCount,
      comparableMetricCount: touchCounts.comparableMetricCount + recoveryCounts.comparableMetricCount,
      withheldMetricCount: touchCounts.withheldMetricCount + recoveryCounts.withheldMetricCount,
    },
    touchBySurface,
    recoveryBySourceSurface,
    limitation: "Median and dispersion deltas are descriptive replay-visible change only. They do not establish improvement, causation, statistical significance or a better controller technique.",
  };
}
