import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { aggregateReplayBatch, canonicalPlaylist, validateBatchCandidate } from "../lib/replay-batch.mjs";

function result(index, finding = index < 4) {
  const metrics = [
    ["goals", "offense_defense"], ["shots", "offense_defense"], ["boost", "boost_economy"],
    ["speed", "movement_recovery"], ["touches", "possession_touches"],
  ].map(([id, category], metricIndex) => ({
    id, category, label: id, displayValue: String(index + metricIndex), value: index + metricIndex,
    unit: "count", status: "neutral", kind: "verified_telemetry", whatHappened: "Measured.",
    whyItMatters: "It describes this match.", limitation: "One match only.", source: "parser", version: "v1", sampleCount: 1,
  }));
  return {
    kind: "success",
    normalized: {
      game: "rocket-league", externalMatchId: `match-${index}`, subjectPlayerId: "player-1",
      subjectDisplayName: "Player One", mode: "Ranked Doubles 2v2", occurredAt: `2026-08-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`,
      metadata: {
        performanceSnapshot: { version: "v1", metrics, moments: [{ id: `m-${index}`, title: "Moment", context: "Ranked", observation: "Observed", consequence: "Consequence", limitation: "Bounded", timestampSeconds: 30, evidenceKind: "verified_telemetry", source: "parser", version: "v1" }] },
        decisionEngine: { detectors: [{
          detectorId: "possession.first_touch_retention", detectorVersion: "0.1.0", opportunityType: "first_touch_retention",
          evaluations: [
            { opportunityId: `o-${index}-1`, status: [0, 2, 6, 8].includes(index) ? "firing" : "non_firing", classification: [0, 2, 6, 8].includes(index) ? "opponent_gain" : "team_retained", contextKey: "2v2:first_touch_retention:first:loose:low:normal" },
            { opportunityId: `o-${index}-2`, status: "non_firing", classification: "team_retained", contextKey: "2v2:first_touch_retention:first:loose:low:normal" },
          ],
        }] },
      },
    },
    findings: finding ? [{
      id: "spacing.overlap", category: "positioning", title: "Protect the second layer", summary: "Both cars entered the same channel.",
      severity: "high", confidence: 0.8, confidenceLabel: "high", estimatedImpact: "possession",
      evidence: [{ id: `e-${index}`, description: "Both teammates crossed into one lane.", timestampSeconds: 30 }],
      metrics: [], recommendation: { queueRule: "If your teammate crosses, hold one layer deeper.", practiceSteps: ["Shadow the play", "Review three matches"] },
      limitations: ["Comparable team states only."], detectorVersion: "spacing@1", schemaVersion: "finding.v1",
    }] : [],
    versions: { parser: "parser@1", analyzer: "analyzer@1", detector: "detectors@1", coaching: "coaching@1", schema: "coaching.v1" },
  };
}

test("locks a ten-replay batch to one player, playlist, file hash and match guid", () => {
  assert.equal(canonicalPlaylist("Ranked Doubles 2v2"), "2v2");
  const normalized = result(0).normalized;
  assert.deepEqual(validateBatchCandidate({ subjectPlayerId: null, playlist: null }, normalized), { ok: true, playlist: "2v2" });
  assert.equal(validateBatchCandidate({ subjectPlayerId: "other", subjectDisplayName: "Other", playlist: "2v2" }, normalized).code, "wrong_player");
  assert.equal(validateBatchCandidate({ subjectPlayerId: "player-1", playlist: "3v3" }, normalized).code, "wrong_playlist");
  assert.equal(validateBatchCandidate({}, normalized, { fileHash: true }).code, "duplicate_file");
  assert.equal(validateBatchCandidate({}, normalized, { matchGuid: true }).code, "duplicate_match");
});

test("aggregates exactly ten matches and keeps one-off signals out of the plan", () => {
  const aggregate = aggregateReplayBatch(Array.from({ length: 10 }, (_, index) => result(index)), 2);
  assert.equal(aggregate.primary.recurrence, 4);
  assert.equal(aggregate.confidence, "medium");
  assert.equal(aggregate.metadata.batch.validMatches, 10);
  assert.equal(aggregate.metadata.batch.excludedFiles, 2);
  assert.equal(aggregate.report.evidence.length, 4);
  assert.match(aggregate.report.whyItCosts, /4 of 10 matches/);
  assert.ok(aggregate.metadata.performanceSnapshot.metrics.length >= 5);
  assert.ok(new Set(aggregate.metadata.performanceSnapshot.metrics.map(metric => metric.category)).size >= 3);
  assert.equal(aggregate.metadata.batch.opportunityPatterns.length, 1);
  assert.equal(aggregate.metadata.batch.opportunityPatterns[0].eligibleOpportunities, 20);
  assert.equal(aggregate.metadata.batch.opportunityPatterns[0].firingOpportunities, 4);
  assert.equal(aggregate.metadata.batch.opportunityPatterns[0].nonFiringOpportunities, 16);
  assert.equal(aggregate.metadata.batch.opportunityPatterns[0].comparableContexts[0].matches, 10);
  assert.equal(aggregate.metadata.batch.patternMemory.contractCount, 1);
  assert.equal(aggregate.metadata.batch.patternMemory.patternLockCandidateCount, 1);
  assert.equal(aggregate.metadata.batch.patternMemory.contracts[0].state, "pattern_lock_candidate");
  assert.equal(aggregate.metadata.batch.patternMemory.contracts[0].publicEligible, false);
  assert.match(aggregate.metadata.batch.patternMemory.contracts[0].contractId, /^pm_[a-f0-9]{24}$/);
  assert.throws(() => aggregateReplayBatch(Array.from({ length: 9 }, (_, index) => result(index))), /Exactly ten/);
});

test("batch product reserves one allowance and never counts excluded files as valid", async () => {
  const [create, upload, process, flow, report, parser] = await Promise.all([
    readFile(new URL("../app/api/replay-batches/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/replay-batches/[batchId]/uploads/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/replay-batches/[batchId]/process/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/analyze/BatchAnalyzeFlow.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/report-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../services/rl-engine/parser.mjs", import.meta.url), "utf8"),
  ]);
  assert.equal((create.match(/reserveAnalysisAccess\(/g) || []).length, 1);
  assert.doesNotMatch(upload, /reserveAnalysisAccess/);
  assert.match(process, /valid_count = valid_count \+ 1/);
  assert.match(process, /excluded_count = excluded_count \+ \?/);
  assert.match(process, /nextSlot === 10/);
  assert.match(process, /report\s*\?\s*database\.prepare\(`UPDATE analysis_usage SET status = 'consumed'/);
  assert.match(process, /database\.prepare\(`UPDATE analysis_usage SET status = 'released'/);
  assert.match(process, /job_public_id = \?/);
  assert.match(process, /crypto\.randomUUID\(\)\.replaceAll\("-", ""\)/);
  assert.match(flow, /Choose exactly \$\{required\}/);
  assert.match(flow, /onDrop=\{dropFiles\}/);
  assert.match(flow, /We keep every valid file and explain every exclusion/);
  assert.match(flow, /replaymethod-ten-replay-upload/);
  assert.match(report, /row\.evidenceType !== "replay_batch" \|\| Boolean\(finding\)/);
  assert.match(parser, /externalMatchId: matchGuid \|\| undefined/);
});
