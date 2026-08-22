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
  assert.match(quality, /replayCount: new Set\(decided\.map/);
  assert.match(quality, /timestampVerified === true/);
  assert.match(reviewPage, /reviewerPlaylistScopes/);
  assert.match(reviewPage, /qualifiedModes\.has\(candidate\.mode\)/);
  assert.match(reviewPage, /privateMomentKeys/);
  assert.match(reviewPage, /rlReviewLabels/);
  assert.match(reviewPage, /Other reviewers’ decisions and aggregate verdicts remain hidden/);
  assert.match(reviewPage, /eq\(rlReviewLabels\.reviewerId, reviewer\.id\)/);
  assert.doesNotMatch(reviewPage, /detectorQualitySummary/);
  assert.match(reviewRoute, /requireRlReviewerMutation/);
  assert.match(reviewRoute, /access\.reviewer\.id/);
  assert.match(reviewRoute, /rl_review_labels/);
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
  assert.match(route, /queue\.sourceCorpusAssignment !== "calibration"/);
  assert.match(route, /queue\.holdoutIncluded !== false/);
  assert.match(route, /Only the locked calibration split may enter the tuning review queue/);
  assert.match(route, /runtime\.BUCKET\.put/);
  assert.match(route, /moment_object_key/);
});
