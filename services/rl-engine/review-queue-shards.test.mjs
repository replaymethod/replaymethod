import assert from "node:assert/strict";
import test from "node:test";
import { mergeOpportunityReviewQueues } from "./calibration.mjs";

const fingerprint = (digit) => digit.repeat(64);

function queue(shard, candidates) {
  return {
    schemaVersion: "rocket-league-opportunity-review-queue.v1",
    sourceReportVersion: "rocket-league-calibration-report.v1",
    sourceReportFingerprint: fingerprint(String(shard + 1)),
    labelSetVersion: "labels-v1",
    sourceCorpusAssignment: "calibration_dev",
    holdoutIncluded: false,
    blindReview: true,
    selection: { detectorIds: ["challenge.quality"], availableCandidates: candidates.length },
    candidates,
  };
}

function candidate(id, status, cohortKey, context) {
  return {
    id, detectorId: "challenge.quality", detectorVersion: "0.9.0", opportunityStatus: status,
    opportunityContextKey: context, replayFingerprint: id.slice(0, 16), timestampSeconds: Number(id.at(-1)),
    cohortKey, mode: "2v2", rankCohort: "diamond", corpusAssignment: "calibration_dev",
  };
}

test("shard review queues are globally balanced and pinned to the combined report", () => {
  const queues = [
    queue(0, [candidate("aaaaaaaaaaaaaaaa1", "firing", "2v2:gold", "low"), candidate("bbbbbbbbbbbbbbbb2", "non_firing", "2v2:gold", "low")]),
    queue(1, [candidate("cccccccccccccccc3", "firing", "2v2:diamond", "high"), candidate("dddddddddddddddd4", "abstained", "2v2:diamond", "high")]),
  ];
  const merged = mergeOpportunityReviewQueues(queues, {
    sourceReportFingerprint: fingerprint("a"),
    sourceShardFingerprints: [fingerprint("1"), fingerprint("2")],
    perStatus: 2,
  });
  assert.equal(merged.candidates.length, 4);
  assert.equal(merged.sourceReportFingerprint, fingerprint("a"));
  assert.deepEqual(merged.selection.statusCounts, { firing: 2, non_firing: 1, abstained: 1 });
});

test("shard review queue merge rejects fingerprint drift and duplicate candidates", () => {
  const first = queue(0, [candidate("aaaaaaaaaaaaaaaa1", "firing", "2v2:gold", "low")]);
  const second = queue(1, [candidate("bbbbbbbbbbbbbbbb2", "firing", "2v2:gold", "low")]);
  assert.throws(() => mergeOpportunityReviewQueues([first, second], {
    sourceReportFingerprint: fingerprint("a"), sourceShardFingerprints: [fingerprint("1"), fingerprint("3")],
  }), /do not match/);
  second.candidates = first.candidates;
  assert.throws(() => mergeOpportunityReviewQueues([first, second], {
    sourceReportFingerprint: fingerprint("a"), sourceShardFingerprints: [fingerprint("1"), fingerprint("2")],
  }), /unique/);
});
