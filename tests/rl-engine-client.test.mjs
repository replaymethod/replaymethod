import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { requestRocketLeagueAnalysis, resolveRocketLeagueEngine } from "../lib/rl-engine-client.mjs";
import { blockedRetryDisposition } from "../lib/retry-policy.mjs";

const token = "test-token-that-is-long-enough";

test("requires a bounded private engine configuration", () => {
  assert.equal(resolveRocketLeagueEngine({}).code, "rl_engine_not_configured");
  assert.equal(resolveRocketLeagueEngine({ RL_ENGINE_URL: "https://engine.example", RL_ENGINE_TOKEN: "short" }).code, "rl_engine_token_invalid");
  assert.equal(resolveRocketLeagueEngine({ RL_ENGINE_URL: "http://engine.example", RL_ENGINE_TOKEN: token }).code, "rl_engine_url_invalid");
  assert.equal(resolveRocketLeagueEngine({ RL_ENGINE_URL: "https://user:pass@engine.example", RL_ENGINE_TOKEN: token }).code, "rl_engine_url_invalid");

  const local = resolveRocketLeagueEngine({ RL_ENGINE_URL: "http://127.0.0.1:8788", RL_ENGINE_TOKEN: token, RL_ENGINE_TIMEOUT_MS: "1" });
  assert.equal(local.ok, true);
  assert.equal(local.timeoutMs, 5_000);
  const production = resolveRocketLeagueEngine({ RL_ENGINE_URL: "https://engine.example/base", RL_ENGINE_TOKEN: token, RL_ENGINE_TIMEOUT_MS: "999999" });
  assert.equal(production.endpoint.toString(), "https://engine.example/v1/analyze/rocket-league");
  assert.equal(production.timeoutMs, 120_000);
});

test("sends an HTTP-safe exact player identity through the versioned authenticated contract", async () => {
  const config = resolveRocketLeagueEngine({ RL_ENGINE_URL: "https://engine.example", RL_ENGINE_TOKEN: token });
  let captured;
  const response = await requestRocketLeagueAnalysis(config, {
    publicId: "f".repeat(32),
    jobPublicId: "a".repeat(32),
    playerContext: "Player Name 🚀 · Ranked Doubles",
    currentRank: "Diamond II",
  }, new Uint8Array([1, 2, 3]), async (url, init) => {
    captured = { url: url.toString(), init };
    return new Response("{}", { status: 200 });
  });
  assert.equal(response.status, 200);
  assert.equal(captured.url, "https://engine.example/v1/analyze/rocket-league");
  assert.equal(captured.init.headers.Authorization, `Bearer ${token}`);
  assert.equal(captured.init.headers["X-Replay-Method-Request"], "a".repeat(32));
  assert.equal(decodeURIComponent(captured.init.headers["X-Replay-Method-Player"]), "Player Name 🚀 · Ranked Doubles");
  assert.equal(decodeURIComponent(captured.init.headers["X-Replay-Method-Rank"]), "Diamond II");
  assert.equal(captured.init.signal instanceof AbortSignal, true);
});

test("keeps retryable blocks pollable and releases terminal reservations", () => {
  const retry = blockedRetryDisposition({ retryable: true, attempts: 1, maxAttempts: 3, now: 0 });
  assert.deepEqual(retry, {
    jobStatus: "retry",
    jobStage: "blocked",
    requestStatus: "analyzing",
    nextRetryAt: "1970-01-01T00:01:00.000Z",
    releaseUsage: false,
  });
  assert.equal(blockedRetryDisposition({ retryable: true, attempts: 3, maxAttempts: 3 }).jobStatus, "failed");
  assert.equal(blockedRetryDisposition({ retryable: false, attempts: 1, maxAttempts: 3 }).jobStatus, "blocked");
});

test("maps worker timeout, auth and transient HTTP failures without exposing the token", async () => {
  const source = await readFile(new URL("../lib/adapters/index.ts", import.meta.url), "utf8");
  assert.match(source, /rl_engine_timeout/);
  assert.match(source, /rl_engine_auth_failed/);
  assert.match(source, /response\.status === 408 \|\| response\.status === 429 \|\| response\.status >= 500/);
  assert.doesNotMatch(source, /console\.(log|error).*RL_ENGINE_TOKEN/);
});

test("keeps the container non-root, health-checked and clear of replay calibration inputs", async () => {
  const [dockerfile, dockerignore, server] = await Promise.all([
    readFile(new URL("../services/rl-engine/Dockerfile", import.meta.url), "utf8"),
    readFile(new URL("../.dockerignore", import.meta.url), "utf8"),
    readFile(new URL("../services/rl-engine/server.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(dockerfile, /USER node/);
  assert.match(dockerfile, /HEALTHCHECK/);
  assert.match(dockerfile, /STOPSIGNAL SIGTERM/);
  assert.match(dockerignore, /\*\.replay/);
  assert.match(dockerignore, /docs\/\*\.json/);
  assert.match(dockerignore, /\.env\.\*/);
  assert.match(server, /server\.close\(/);
  assert.doesNotMatch(server, /console\.error\("rocket league request failed", error/);
});
