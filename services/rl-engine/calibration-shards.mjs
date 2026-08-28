import { createHash } from "node:crypto";
import { calibrationFingerprint } from "./calibration.mjs";

export const CALIBRATION_SHARD_MANIFEST_VERSION = "rocket-league-calibration-shard-manifest.v1";

const VALID_OPPORTUNITY_STATUSES = new Set(["firing", "non_firing", "abstained"]);

function sha256(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function sumObject(target, source = {}) {
  for (const [key, value] of Object.entries(source)) {
    if (Number.isFinite(value)) target[key] = (target[key] ?? 0) + value;
  }
  return target;
}

function requireFingerprint(value, description) {
  if (!/^[a-f0-9]{64}$/.test(String(value ?? ""))) {
    throw new Error(`${description} must be a SHA-256 fingerprint.`);
  }
}

function opportunityCounts(report) {
  const byDetector = new Map();
  for (const replay of report.replays ?? []) {
    for (const contract of replay.opportunityContracts ?? []) {
      const aggregate = byDetector.get(contract.detectorId) ?? {
        counts: { firing: 0, non_firing: 0, abstained: 0, total: 0 },
        replayCount: 0,
        modes: {},
        rankCohorts: {},
        contexts: {},
      };
      const ids = new Set();
      if ((contract.evaluations ?? []).length) aggregate.replayCount += 1;
      for (const evaluation of contract.evaluations ?? []) {
        if (!VALID_OPPORTUNITY_STATUSES.has(evaluation.status)) {
          throw new Error(`Unsupported opportunity status for ${contract.detectorId}.`);
        }
        if (!evaluation.opportunityId || ids.has(evaluation.opportunityId)) {
          throw new Error(`Duplicate or missing opportunity ID for ${contract.detectorId}.`);
        }
        ids.add(evaluation.opportunityId);
        aggregate.counts[evaluation.status] += 1;
        aggregate.counts.total += 1;
        const mode = replay.mode ?? "unknown";
        const rankCohort = replay.rankCohort ?? "unranked-unknown";
        const context = evaluation.contextKey ?? "unknown";
        aggregate.modes[mode] = (aggregate.modes[mode] ?? 0) + 1;
        aggregate.rankCohorts[rankCohort] = (aggregate.rankCohorts[rankCohort] ?? 0) + 1;
        aggregate.contexts[context] = (aggregate.contexts[context] ?? 0) + 1;
      }
      byDetector.set(contract.detectorId, aggregate);
    }
  }
  return byDetector;
}

export function summarizeCalibrationShards(reports, {
  sourceFiles = [],
  expectedReplayCount = null,
  expectedDetectorCount = null,
  corpusRows = null,
  sourceManifestSchemaVersion = null,
  sourceManifestPlanVersion = null,
} = {}) {
  if (!Array.isArray(reports) || !reports.length) throw new Error("At least one calibration shard is required.");
  const orderedPairs = reports.map((report, index) => ({ report, sourceFile: sourceFiles[index] }))
    .sort((left, right) => left.report.shard?.index - right.report.shard?.index);
  const ordered = orderedPairs.map(({ report }) => report);
  const reference = ordered[0];
  const expectedCount = reference.shard?.count;
  const method = reference.shard?.method;
  const split = reference.shard?.split;
  if (!Number.isInteger(expectedCount) || expectedCount <= 0 || ordered.length !== expectedCount) {
    throw new Error("Calibration shard set must contain the declared number of shards.");
  }
  if (!method || !split) throw new Error("Calibration shards require an assignment method and explicit split.");

  const seenIndexes = new Set();
  const seenReplays = new Set();
  const detectorMap = new Map();
  const modes = {};
  const corpus = {
    replayCount: 0,
    calibrationEligibleReplayCount: 0,
    failureCount: 0,
    modeMismatchCount: 0,
    attributionVerifiedCount: 0,
    modes,
    totalSampledFrames: 0,
    totalParserEvents: 0,
    totalDecisionEvents: 0,
  };
  const operational = { measuredReplayCount: 0, totalRuntimeMs: 0, maximumObservedRssBytes: null };

  for (const report of ordered) {
    requireFingerprint(report.reproducibilityFingerprint, "Shard reproducibility fingerprint");
    if (calibrationFingerprint(report) !== report.reproducibilityFingerprint) {
      throw new Error(`Calibration shard ${report.shard?.index ?? "unknown"} fingerprint does not match its contents.`);
    }
    const shard = report.shard ?? {};
    if (report.schemaVersion !== reference.schemaVersion || shard.count !== expectedCount
      || shard.method !== method || shard.split !== split) {
      throw new Error("Calibration shards have incompatible provenance.");
    }
    if (!Number.isInteger(shard.index) || shard.index < 0 || shard.index >= expectedCount || seenIndexes.has(shard.index)) {
      throw new Error("Calibration shard indexes must be unique and complete.");
    }
    seenIndexes.add(shard.index);
    if (shard.replayCount !== report.corpus?.replayCount || shard.replayCount !== (report.replays ?? []).length) {
      throw new Error(`Calibration shard ${shard.index} has inconsistent replay counts.`);
    }
    for (const replay of report.replays ?? []) {
      if (!replay.replayFingerprint || seenReplays.has(replay.replayFingerprint)) {
        throw new Error("Replay fingerprints must be unique across calibration shards.");
      }
      seenReplays.add(replay.replayFingerprint);
    }
    for (const key of [
      "replayCount", "calibrationEligibleReplayCount", "failureCount", "modeMismatchCount",
      "attributionVerifiedCount", "totalSampledFrames", "totalParserEvents", "totalDecisionEvents",
    ]) corpus[key] += report.corpus?.[key] ?? 0;
    sumObject(modes, report.corpus?.modes);

    const statuses = opportunityCounts(report);
    for (const detector of report.detectors ?? []) {
      const current = detectorMap.get(detector.detectorId) ?? {
        detectorId: detector.detectorId,
        detectorVersion: detector.detectorVersion,
        replayRuns: 0,
        executionErrors: 0,
        replaysWithSignal: 0,
        candidateCount: 0,
        ineligibleReplayRuns: 0,
        notApplicableRuns: 0,
        opportunities: { firing: 0, non_firing: 0, abstained: 0, total: 0 },
        opportunityReplayCount: 0,
        opportunityModes: {},
        opportunityRankCohorts: {},
        opportunityContexts: {},
      };
      if (current.detectorVersion !== detector.detectorVersion) {
        throw new Error(`Detector version drift for ${detector.detectorId}.`);
      }
      for (const key of [
        "replayRuns", "executionErrors", "replaysWithSignal", "candidateCount",
        "ineligibleReplayRuns", "notApplicableRuns",
      ]) current[key] += detector[key] ?? 0;
      const opportunity = statuses.get(detector.detectorId);
      sumObject(current.opportunities, opportunity?.counts);
      current.opportunityReplayCount += opportunity?.replayCount ?? 0;
      sumObject(current.opportunityModes, opportunity?.modes);
      sumObject(current.opportunityRankCohorts, opportunity?.rankCohorts);
      sumObject(current.opportunityContexts, opportunity?.contexts);
      detectorMap.set(detector.detectorId, current);
    }
    operational.measuredReplayCount += report.operational?.measuredReplayCount ?? 0;
    operational.totalRuntimeMs += report.operational?.totalRuntimeMs ?? 0;
    const rss = report.operational?.maximumObservedRssBytes;
    if (Number.isFinite(rss)) operational.maximumObservedRssBytes = Math.max(operational.maximumObservedRssBytes ?? 0, rss);
  }

  if ([...seenIndexes].sort((a, b) => a - b).some((value, index) => value !== index)) {
    throw new Error("Calibration shard indexes must cover every index exactly once.");
  }
  let sourceManifestFingerprint = null;
  let composition = null;
  if (corpusRows) {
    if (!Array.isArray(corpusRows) || !corpusRows.length) throw new Error("Corpus lineage rows must be non-empty.");
    const normalizedRows = corpusRows.map((row) => ({
      sha256: String(row.sha256 ?? "").toLowerCase(),
      split: row.split ?? row.assignment,
      cellKey: row.cellKey ?? null,
      season: Number(row.season),
      mode: row.mode ?? null,
      rankGroup: row.rankGroup ?? row.rank ?? null,
      subjectFingerprint: row.subjectFingerprint ?? null,
      playerFingerprints: [...(row.playerFingerprints ?? [])].sort(),
    })).sort((left, right) => left.sha256.localeCompare(right.sha256));
    if (normalizedRows.some((row) => !/^[a-f0-9]{64}$/.test(row.sha256) || row.split !== split)) {
      throw new Error("Corpus lineage rows require full SHA-256 hashes and the exact calibration split.");
    }
    const expectedFingerprints = normalizedRows.map((row) => row.sha256.slice(0, 16));
    if (new Set(expectedFingerprints).size !== expectedFingerprints.length
      || expectedFingerprints.length !== seenReplays.size
      || expectedFingerprints.some((fingerprint) => !seenReplays.has(fingerprint))) {
      throw new Error("Calibration shards do not exactly cover the manifest-selected replay set.");
    }
    sourceManifestFingerprint = sha256({
      schemaVersion: sourceManifestSchemaVersion,
      planVersion: sourceManifestPlanVersion,
      rows: normalizedRows,
    });
    const countBy = (field) => normalizedRows.reduce((counts, row) => {
      const key = String(row[field] ?? "unknown");
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    }, {});
    composition = {
      seasons: countBy("season"),
      modes: countBy("mode"),
      ranks: countBy("rankGroup"),
      cells: countBy("cellKey"),
    };
  }
  const detectors = [...detectorMap.values()].sort((left, right) => left.detectorId.localeCompare(right.detectorId));
  if (Number.isInteger(expectedReplayCount) && corpus.replayCount !== expectedReplayCount) {
    throw new Error(`Calibration shard set has ${corpus.replayCount}/${expectedReplayCount} expected replays.`);
  }
  if (Number.isInteger(expectedDetectorCount) && detectors.length !== expectedDetectorCount) {
    throw new Error(`Calibration shard set has ${detectors.length}/${expectedDetectorCount} expected detectors.`);
  }
  const shardFingerprints = ordered.map((report) => ({
    index: report.shard.index,
    replayCount: report.shard.replayCount,
    reproducibilityFingerprint: report.reproducibilityFingerprint,
  }));
  const reproducibilityFingerprint = sha256({
    schemaVersion: CALIBRATION_SHARD_MANIFEST_VERSION,
    reportSchemaVersion: reference.schemaVersion,
    method,
    split,
    sourceManifestFingerprint,
    shardFingerprints,
  });
  return {
    schemaVersion: CALIBRATION_SHARD_MANIFEST_VERSION,
    generatedAt: new Date().toISOString(),
    reportSchemaVersion: reference.schemaVersion,
    shardSet: { method, split, count: expectedCount },
    sourceFiles: orderedPairs.map(({ report, sourceFile }) => sourceFile ?? `shard-${report.shard.index}.json`),
    shardFingerprints,
    corpus,
    corpusLineage: corpusRows ? {
      sourceManifestSchemaVersion,
      sourceManifestPlanVersion,
      sourceManifestFingerprint,
      exactReplaySetMatched: true,
      composition,
    } : null,
    detectors,
    operational: {
      ...operational,
      meanRuntimeMs: operational.measuredReplayCount ? operational.totalRuntimeMs / operational.measuredReplayCount : null,
      limitation: "Combined from per-shard post-replay process samples; not a per-request peak measurement.",
    },
    conclusions: {
      integrityPassed: corpus.replayCount > 0
        && corpus.failureCount === 0
        && corpus.modeMismatchCount === 0
        && corpus.attributionVerifiedCount === corpus.replayCount
        && detectors.every((detector) => detector.executionErrors === 0),
      publicDetectorsEnabled: 0,
      nextGate: "Independent timestamp review and adjudication remain owner-controlled.",
    },
    reproducibilityFingerprint,
  };
}

export function compareCalibrationShardManifests(left, right) {
  requireFingerprint(left?.reproducibilityFingerprint, "Left shard-manifest fingerprint");
  requireFingerprint(right?.reproducibilityFingerprint, "Right shard-manifest fingerprint");
  return {
    reproducible: left.reproducibilityFingerprint === right.reproducibilityFingerprint,
    leftFingerprint: left.reproducibilityFingerprint,
    rightFingerprint: right.reproducibilityFingerprint,
    sameCorpusCount: left.corpus?.replayCount === right.corpus?.replayCount,
    sameDetectorSummary: JSON.stringify(left.detectors ?? []) === JSON.stringify(right.detectors ?? []),
  };
}
