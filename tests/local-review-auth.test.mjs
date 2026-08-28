import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createLocalReviewSession,
  localReviewAvailable,
  readLocalReviewSession,
} from "../lib/local-review-auth.mjs";

const ownerToken = "owner-local-review-token-that-is-longer-than-thirty-two-characters";
const reviewerToken = "reviewer-local-review-token-that-is-also-long-enough";
const env = {
  RL_LOCAL_REVIEW_ENABLED: "true",
  RL_LOCAL_REVIEW_OWNER_TOKEN: ownerToken,
  RL_LOCAL_REVIEWER_TOKEN: reviewerToken,
};
const localHeaders = new Headers({ Host: "127.0.0.1:5176" });

test("local review auth is explicit, loopback-only and secret-backed", async () => {
  assert.equal(localReviewAvailable(env, localHeaders), true);
  assert.equal(localReviewAvailable({ ...env, RL_LOCAL_REVIEW_ENABLED: "false" }, localHeaders), false);
  assert.equal(localReviewAvailable(env, new Headers({ Host: "replaymethod.xyz" })), false);
  assert.equal(localReviewAvailable({ ...env, RL_LOCAL_REVIEWER_TOKEN: ownerToken }, localHeaders), false);
  assert.equal(localReviewAvailable({ ...env, RL_LOCAL_REVIEW_OWNER_TOKEN: "short" }, localHeaders), false);
});

test("owner and reviewer receive separate signed HttpOnly identities", async () => {
  const now = Date.UTC(2026, 7, 26, 12);
  const owner = await createLocalReviewSession(env, localHeaders, {
    accessCode: ownerToken,
    email: "owner@example.com",
    displayName: "Local Owner",
  }, now);
  const reviewer = await createLocalReviewSession(env, localHeaders, {
    accessCode: reviewerToken,
    email: "reviewer@example.com",
    displayName: "Independent Reviewer",
  }, now);
  assert.equal(owner?.role, "owner");
  assert.equal(reviewer?.role, "reviewer");
  assert.notEqual(owner?.user.id, reviewer?.user.id);
  assert.match(owner?.cookie ?? "", /HttpOnly; SameSite=Strict; Max-Age=28800/);

  const cookieHeaders = new Headers({ Host: "localhost:5176", Cookie: owner.cookie.split(";")[0] });
  const restored = await readLocalReviewSession(env, cookieHeaders, now + 1_000);
  assert.deepEqual(restored, owner.user);
  assert.equal(await readLocalReviewSession(env, cookieHeaders, now + 28_800_001), null);

  const tamperedHeaders = new Headers({ Host: "localhost:5176", Cookie: `${owner.cookie.split(";")[0]}tampered` });
  assert.equal(await readLocalReviewSession(env, tamperedHeaders, now + 1_000), null);
  assert.equal(await createLocalReviewSession(env, localHeaders, {
    accessCode: "wrong-token-with-enough-characters-to-look-plausible",
    email: "reviewer@example.com",
    displayName: "Reviewer",
  }, now), null);
});

test("local review routes preserve existing production authentication boundaries", async () => {
  const [auth, admin, loginRoute, vite, worker] = await Promise.all([
    readFile(new URL("../app/chatgpt-auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/admin.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/local-review-session/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../vite.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
  ]);
  assert.match(auth, /if \(!email\)/);
  assert.match(auth, /readLocalReviewSession/);
  assert.match(admin, /user\.localRole === "owner"/);
  assert.match(loginRoute, /isSameOriginRequest/);
  assert.doesNotMatch(loginRoute, /accessCode.*URLSearchParams/s);
  assert.match(vite, /RL_LOCAL_REVIEW_ENABLED/);
  assert.match(worker, /local-review-access/);
});
