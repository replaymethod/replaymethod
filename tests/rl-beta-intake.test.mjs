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
  assert.match(contribution, /No questionnaire/);
  assert.match(contribution, /This contribution does not promise a player report/);
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
  assert.match(reviewPage, /RL_REVIEW_CANDIDATE_KEYS/);
  assert.match(reviewPage, /rlReviewLabels/);
  assert.match(reviewPage, /2 qualified reviewers/);
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
