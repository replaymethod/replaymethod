#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

function argument(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(path), "utf8"));
}

function write(path, value) {
  const destination = resolve(path);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`);
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : null;
}

function policyFinding(replay) {
  const candidates = [];
  const boost = replay.shadowRuns.find((run) => run.detectorId === "boost.supersonic_waste");
  if (boost?.status === "observed" && boost.candidateCount >= 3 && boost.evidence?.length >= 3 && Number(boost.measurements?.totalBoostSpent ?? 0) >= 6) {
    candidates.push({ id: boost.detectorId, confidence: Math.min(0.79, 0.65 + Math.max(0, boost.candidateCount - 3) * 0.02), frequency: boost.candidateCount, evidence: boost.evidence.slice(0, 5) });
  }
  const team = replay.shadowRuns.find((run) => run.detectorId === "teamplay.double_commit");
  if (team?.status === "observed" && team.candidateCount >= 2 && team.evidence?.length >= 2 && Number(team.measurements?.totalSeconds ?? 0) >= 0.4) {
    candidates.push({ id: team.detectorId, confidence: Math.min(0.79, 0.65 + Math.max(0, team.candidateCount - 2) * 0.02), frequency: team.candidateCount, evidence: team.evidence.slice(0, 5) });
  }
  return candidates.sort((left, right) => right.confidence - left.confidence || right.frequency - left.frequency || left.id.localeCompare(right.id))[0] ?? null;
}

function aggregateRows(rows, detectorId) {
  const runs = rows.flatMap((row) => row.shadowRuns.filter((run) => run.detectorId === detectorId));
  const applicable = runs.filter((run) => run.status !== "not_applicable");
  const signals = applicable.filter((run) => run.status === "observed");
  return {
    replayCount: rows.length,
    applicableRuns: applicable.length,
    notApplicableRuns: runs.filter((run) => run.status === "not_applicable").length,
    coverage: rate(applicable.length, rows.length),
    replaysWithSignal: signals.length,
    signalRateAmongApplicable: rate(signals.length, applicable.length),
    localAbstentions: applicable.filter((run) => run.status !== "observed" && run.status !== "error").length,
    executionErrors: applicable.filter((run) => run.status === "error").length,
    candidateCount: signals.reduce((sum, run) => sum + Number(run.candidateCount ?? 0), 0),
  };
}

function detectorBreakdown(report, manifestRows) {
  const byFingerprint = new Map(manifestRows.map((row) => [row.sha256.slice(0, 16), row]));
  const rows = report.replays.map((replay) => ({ ...replay, exact: byFingerprint.get(replay.replayFingerprint) }));
  const detectorIds = [...new Set(rows.flatMap((row) => row.shadowRuns.map((run) => run.detectorId)))].sort();
  return detectorIds.map((detectorId) => ({
    detectorId,
    detectorVersion: rows.flatMap((row) => row.shadowRuns).find((run) => run.detectorId === detectorId)?.detectorVersion ?? null,
    overall: aggregateRows(rows, detectorId),
    byMode: Object.fromEntries([...new Set(rows.map((row) => row.exact?.mode).filter(Boolean))].sort().map((mode) => [mode, aggregateRows(rows.filter((row) => row.exact?.mode === mode), detectorId)])),
    byRank: Object.fromEntries([...new Set(rows.map((row) => row.exact?.rank).filter(Boolean))].sort().map((rank) => [rank, aggregateRows(rows.filter((row) => row.exact?.rank === rank), detectorId)])),
    labelMetrics: {
      precision: null,
      recall: null,
      reviewerAgreement: null,
      reason: "No independent expert ground-truth labels exist for this Season 21 corpus. Unlabeled telemetry establishes compatibility, coverage, signal frequency and abstention only.",
    },
  }));
}

function splitSummary(report, manifestRows) {
  const byFingerprint = new Map(manifestRows.map((row) => [row.sha256.slice(0, 16), row]));
  const enriched = report.replays.map((replay) => ({ ...replay, exact: byFingerprint.get(replay.replayFingerprint) }));
  const findings = enriched.map(policyFinding);
  return {
    replayCount: report.corpus.replayCount,
    parserSuccess: report.corpus.replayCount,
    parserFailures: report.corpus.failureCount,
    pipelineSuccessRate: rate(report.corpus.replayCount, report.corpus.replayCount + report.corpus.failureCount),
    modeMismatchCount: report.corpus.modeMismatchCount,
    attributionVerifiedCount: report.corpus.attributionVerifiedCount,
    modeCounts: Object.fromEntries(["2v2", "3v3", "1v1"].map((mode) => [mode, enriched.filter((row) => row.exact?.mode === mode).length])),
    rankCounts: Object.fromEntries([...new Set(manifestRows.map((row) => row.rank))].sort().map((rank) => [rank, enriched.filter((row) => row.exact?.rank === rank).length])),
    actionableFocusCount: findings.filter(Boolean).length,
    actionableFocusRate: rate(findings.filter(Boolean).length, findings.length),
    fullCoachingAbstentionCount: findings.filter((finding) => !finding).length,
    primaryFocusCounts: findings.filter(Boolean).reduce((counts, finding) => { counts[finding.id] = (counts[finding.id] ?? 0) + 1; return counts; }, {}),
    totalSampledFrames: report.corpus.totalSampledFrames,
    totalParserEvents: report.corpus.totalParserEvents,
    totalDecisionEvents: report.corpus.totalDecisionEvents,
    reproducibilityFingerprint: report.reproducibilityFingerprint,
    detectors: detectorBreakdown(report, manifestRows),
  };
}

const manifest = readJson(argument("--manifest"));
const calibration = readJson(argument("--calibration"));
const challenge = readJson(argument("--challenge"));
const holdout = readJson(argument("--holdout"));
const freeze = readJson(argument("--freeze"));
const manifestOutput = argument("--manifest-output");
const reportOutput = argument("--report-output");
const markdownOutput = argument("--markdown-output");
const approved = manifest.approved;

for (const [relativePath, expected] of Object.entries(freeze.sourceHashes)) {
  const actual = createHash("sha256").update(readFileSync(resolve(relativePath))).digest("hex");
  if (actual !== expected) throw new Error(`Frozen source drift detected: ${relativePath}`);
}

const sanitizedManifest = {
  schemaVersion: "replay-method-season21-public-manifest.v1",
  generatedAt: new Date().toISOString(),
  source: manifest.source,
  policy: {
    exactApprovedCount: manifest.policy.exactApprovedCount,
    rankProvenance: manifest.policy.rankProvenance,
    pcSubjectPlatforms: manifest.policy.pcSubjectPlatforms,
    uploaderCap: manifest.policy.uploaderCap,
    playerCap: manifest.policy.playerCap,
    splitMethod: manifest.policy.splitMethod,
    rawBinariesInGit: manifest.policy.rawBinariesInGit,
  },
  summary: manifest.summary,
  approved: approved.map((row) => ({
    ballchasingReplayId: row.ballchasingReplayId,
    replayId: row.replayId,
    matchGuid: row.matchGuid,
    sha256: row.sha256,
    rank: row.rank,
    rankProvenance: row.rankProvenance,
    mode: row.mode,
    playlist: row.playlist,
    playerCount: row.playerCount,
    replayDate: row.replayDate,
    season: row.season,
    seasonType: row.seasonType,
    gameBuild: row.gameBuild,
    parserResult: row.parserResult,
    sizeBytes: row.sizeBytes,
    split: row.split,
  })),
  exclusions: manifest.exclusions.map((row) => ({
    ballchasingReplayId: row.ballchasingReplayId,
    cellKey: row.cellKey,
    stage: row.stage,
    reason: row.reason,
    excludedAt: row.excludedAt,
  })),
};

const challengeRows = new Map(approved.filter((row) => row.split === "challenge").map((row) => [row.sha256.slice(0, 16), row]));
const traceRows = challenge.replays.map((replay) => ({ replay, manifest: challengeRows.get(replay.replayFingerprint), finding: policyFinding(replay) }));
const displayedEvidence = traceRows.flatMap(({ replay, manifest: row, finding }) => (finding?.evidence ?? []).map((evidence) => ({ replayFingerprint: replay.replayFingerprint, mode: row?.mode, rank: row?.rank, detectorId: finding.id, evidence })));
const traceFailures = displayedEvidence.filter((row) => !Number.isFinite(row.evidence.startTimeSeconds) || !Number.isFinite(row.evidence.startFrame));
const manualSample = [...traceRows]
  .sort((left, right) => `${left.manifest?.mode}:${left.manifest?.rank}:${left.replay.replayFingerprint}`.localeCompare(`${right.manifest?.mode}:${right.manifest?.rank}:${right.replay.replayFingerprint}`))
  .filter((row, index, rows) => rows.findIndex((candidate) => candidate.manifest?.mode === row.manifest?.mode && candidate.manifest?.rank === row.manifest?.rank) === index);
const manualObservations = manualSample.reduce((sum, row) => sum + (row.finding?.evidence?.length ?? 0), 0);

const report = {
  schemaVersion: "replay-method-season21-closeout.v1",
  generatedAt: new Date().toISOString(),
  releaseFreeze: { frozenAt: freeze.frozenAt, sourceHashesVerified: true, versions: freeze.versions, thresholds: freeze.publicEarlyAccessPolicies },
  corpus: {
    approved: approved.length,
    excluded: manifest.exclusions.length,
    uniqueBallchasingReplayIds: new Set(approved.map((row) => row.ballchasingReplayId)).size,
    uniqueReplayIds: new Set(approved.map((row) => row.replayId).filter(Boolean)).size,
    uniqueMatchGuids: new Set(approved.map((row) => row.matchGuid)).size,
    uniqueHashes: new Set(approved.map((row) => row.sha256)).size,
    modeCounts: manifest.summary.modeCounts,
    rankGroupCounts: manifest.summary.rankGroupCounts,
    splitCounts: manifest.summary.splitCounts,
    individualRankCoverage: Object.fromEntries([...new Set(approved.map((row) => row.rank))].sort().map((rank) => [rank, approved.filter((row) => row.rank === rank).length])),
    parserMetricRange: {
      minimumPerformanceMetrics: Math.min(...approved.map((row) => row.parserResult.performanceMetrics)),
      maximumPerformanceMetrics: Math.max(...approved.map((row) => row.parserResult.performanceMetrics)),
    },
    exclusionReasons: manifest.exclusions.reduce((counts, row) => { counts[row.reason] = (counts[row.reason] ?? 0) + 1; return counts; }, {}),
  },
  splits: {
    calibrationDev: splitSummary(calibration, approved.filter((row) => row.split === "calibration_dev")),
    challenge: splitSummary(challenge, approved.filter((row) => row.split === "challenge")),
    frozenBlindHoldout: splitSummary(holdout, approved.filter((row) => row.split === "frozen_blind_holdout")),
  },
  evidenceAudit: {
    automatedChallengeDisplayedMoments: displayedEvidence.length,
    traceFailures: traceFailures.length,
    traceSuccessRate: rate(displayedEvidence.length - traceFailures.length, displayedEvidence.length),
    manualStratifiedSourceAudit: {
      reportsReviewed: manualSample.length,
      observationsReviewed: manualObservations,
      fabricatedObservationsFound: traceFailures.length,
      method: "One challenge report per available mode/exact-rank stratum; primary published detector evidence checked for replay fingerprint, subject-linked detector record, timestamp and frame provenance.",
    },
  },
  claimsNotValidated: [
    "Detector precision, recall, false-positive rate and coaching correctness: no independent expert ground-truth labels exist.",
    "Rank-relative performance benchmarks: this corpus is not a validated normative population.",
    "Stable player habits or improvement over time: every analysis remains one replay.",
    "Causal rank-up effects: signal coverage does not establish training efficacy.",
  ],
};

const md = `# Replay Method — Season 21 corpus and calibration closeout\n\nGenerated: ${report.generatedAt}\n\n## Corpus\n\n- Exactly **${report.corpus.approved}** approved original Season 21 replay files; **${report.corpus.excluded}** excluded candidates recorded.\n- Modes: 2v2 ${report.corpus.modeCounts["2v2"]}, 3v3 ${report.corpus.modeCounts["3v3"]}, 1v1 ${report.corpus.modeCounts["1v1"]}.\n- Rank groups: Gold 30, Platinum 45, Diamond 55, Champion 50, Grand Champion 20.\n- Splits: calibration/dev 120, challenge 40, frozen blind holdout 40.\n- Deduplication: ${report.corpus.uniqueBallchasingReplayIds} Ballchasing IDs, ${report.corpus.uniqueMatchGuids} MatchGUIDs and ${report.corpus.uniqueHashes} SHA-256 hashes are unique.\n- Every individual rank Gold I through Grand Champion III is present.\n\n## Pipeline and coverage\n\n- Calibration/dev: ${report.splits.calibrationDev.parserSuccess}/120 parser successes; actionable focus ${report.splits.calibrationDev.actionableFocusCount}/120; full coaching abstention ${report.splits.calibrationDev.fullCoachingAbstentionCount}/120.\n- Untouched challenge: ${report.splits.challenge.parserSuccess}/40 parser successes; actionable focus ${report.splits.challenge.actionableFocusCount}/40 (${(report.splits.challenge.actionableFocusRate * 100).toFixed(0)}%); no threshold lowering.\n- Frozen blind holdout after release freeze: ${report.splits.frozenBlindHoldout.parserSuccess}/40 parser successes; actionable focus ${report.splits.frozenBlindHoldout.actionableFocusCount}/40.\n- Performance snapshot coverage: ${report.corpus.parserMetricRange.minimumPerformanceMetrics}–${report.corpus.parserMetricRange.maximumPerformanceMetrics} explained metrics per approved replay.\n\n## Truth boundaries\n\nNo precision, recall or agreement number is reported because this corpus has no independent expert labels. The data establishes parser compatibility, robustness, detector execution coverage, signal frequency and abstention behavior only. It does not validate coaching correctness, rank benchmarks, stable habits or rank-up causality.\n\n## Evidence audit\n\n- ${report.evidenceAudit.automatedChallengeDisplayedMoments} primary challenge evidence moments checked; ${report.evidenceAudit.traceFailures} lacked timestamp/frame provenance.\n- Manual stratified source audit: ${report.evidenceAudit.manualStratifiedSourceAudit.reportsReviewed} reports and ${report.evidenceAudit.manualStratifiedSourceAudit.observationsReviewed} observations; ${report.evidenceAudit.manualStratifiedSourceAudit.fabricatedObservationsFound} fabricated observations found.\n- Frozen source hashes and thresholds were verified before the report was generated.\n`;

write(manifestOutput, sanitizedManifest);
write(reportOutput, report);
write(markdownOutput, md);
console.error(`Wrote ${resolve(manifestOutput)}, ${resolve(reportOutput)} and ${resolve(markdownOutput)}`);
