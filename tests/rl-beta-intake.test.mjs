import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("collects consented replays without promising analysis", async () => {
  const [route, contribution, schema] = await Promise.all([
    read("../app/api/rl-beta-submissions/route.ts"),
    read("../app/rocket-league-beta/ReplayContribution.tsx"),
    read("../db/schema.ts"),
  ]);
  assert.match(route, /MAX_REPLAY_BYTES = 16 \* 1024 \* 1024/);
  assert.match(route, /isSameOriginRequest/);
  assert.match(route, /replay\.name\.toLowerCase\(\)\.endsWith\("\.replay"\)/);
  assert.match(route, /five-replay beta limit/);
  assert.match(route, /replayFingerprint/);
  assert.match(route, /updates opt-in failed/);
  assert.match(contribution, /Three details keep the replay attributable and useful/);
  assert.match(contribution, /this is not a generated analysis/i);
  assert.match(contribution, /calibrationConsent/);
  assert.match(contribution, /rightsConfirmed/);
  assert.match(schema, /rl_beta_submissions/);
  assert.match(schema, /rl_beta_submissions_replay_email_unique/);
});

test("quality gate counts only current qualified independent review history", async () => {
  const [quality, reviewPage, reviewRoute] = await Promise.all([
    read("../lib/rl-quality.ts"),
    read("../app/admin/rl-review/page.tsx"),
    read("../app/api/admin/rl-review/[id]/route.ts"),
  ]);
  assert.match(quality, /qualifiedReviewerContexts/);
  assert.match(quality, /reviewerAgreementMetrics\(qualifiedHistory\)/);
  assert.match(quality, /label\.labelSetVersion === RL_LABEL_SET_VERSION/);
  assert.match(quality, /labelProvenanceComplete/);
  assert.match(quality, /reviewerAgreement: agreement\.rawAgreement/);
  assert.match(quality, /replayCount: new Set\(detectorDecisions\.map/);
  assert.match(quality, /opportunityStatus === "non_firing" && item\.verdict === "confirmed"/);
  assert.match(quality, /abstentionReviewed/);
  assert.match(quality, /timestampVerified === true/);
  assert.match(reviewPage, /reviewerPlaylistScopes/);
  assert.match(reviewPage, /splitRlReviewPasses/);
  assert.match(reviewPage, /Pass 1 · calibration checkpoint/);
  assert.match(reviewPage, /Pass 2 · complete calibration/);
  assert.match(reviewPage, /qualifiedModes\.has\(candidate\.mode\)/);
  assert.match(reviewPage, /privateMomentKeys/);
  assert.match(reviewPage, /rlReviewLabels/);
  assert.match(reviewPage, /detector output and every other reviewer remain hidden/);
  assert.match(reviewPage, /eq\(rlReviewCandidates\.active, true\)/);
  assert.doesNotMatch(reviewPage, /RL_REVIEW_MOMENTS\.json/);
  assert.doesNotMatch(reviewPage, /ensureRlReviewQueueSeeded/);
  assert.match(reviewPage, /eq\(rlReviewLabels\.reviewerId, reviewer\.id\)/);
  assert.doesNotMatch(reviewPage, /detectorQualitySummary/);
  assert.match(reviewRoute, /requireRlReviewerMutation/);
  assert.match(reviewRoute, /access\.reviewer\.id/);
  assert.match(reviewRoute, /rl_review_labels/);
  assert.match(reviewRoute, /already locked/);
  assert.match(reviewRoute, /reviewerPlaylistScopes/);
  assert.match(reviewRoute, /gameplay_truth/);
});

test("offline calibration follows the consented player identity", async () => {
  const [calibrate, manifest] = await Promise.all([
    read("../scripts/calibrate-rl-engine.mjs"),
    read("../app/api/admin/rl-beta-submissions/manifest/route.ts"),
  ]);
  assert.match(calibrate, /declared\.playerName/);
  assert.match(calibrate, /subject_player_not_found/);
  assert.match(calibrate, /player\.name\.trim\(\)\.toLowerCase\(\) === declaredPlayerName/);
  assert.match(manifest, /replayFingerprint/);
  assert.match(manifest, /playerName/);
  assert.doesNotMatch(manifest, /email:/);
});

test("owner review-queue import keeps the holdout split out of tuning", async () => {
  const route = await read("../app/api/admin/rl-review-queue/route.ts");
  assert.match(route, /requireSiteAdminMutation/);
  assert.match(route, /queue\.sourceCorpusAssignment !== RL_PRIVATE_REVIEW_SET\.sourceCorpusAssignment/);
  assert.match(route, /queue\.holdoutIncluded !== false/);
  assert.match(route, /Only the exact locked calibration_dev opportunity set may enter the tuning review queue/);
  assert.match(route, /queue\.sourceReportFingerprint !== RL_PRIVATE_REVIEW_SET\.sourceReportFingerprint/);
  assert.match(route, /runtime\.BUCKET\.put/);
  assert.match(route, /moment_object_key/);
  assert.match(route, /RL_PRIVATE_REVIEW_SET\.queueSha256/);
  assert.match(route, /RL_PRIVATE_REVIEW_SET\.momentsSha256/);
  assert.match(route, /RL_PRIVATE_REVIEW_SET\.queueContentSha256/);
  assert.match(route, /DecompressionStream\("gzip"\)/);
  assert.match(route, /candidateKeys\.size !== RL_PRIVATE_REVIEW_SET\.candidateCount/);
  assert.match(route, /replayKeys\.size !== RL_PRIVATE_REVIEW_SET\.replayCount/);
  assert.match(route, /holdout_overlap_count/);
  assert.match(route, /UPDATE rl_review_candidates SET active = 0/);
});
