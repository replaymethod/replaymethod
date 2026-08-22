import assert from "node:assert/strict";
import { once } from "node:events";
import { request as httpRequest } from "node:http";
import test from "node:test";
import { createServer, ENGINE_VERSION, MAX_REPLAY_BYTES, PARSER_VERSION } from "./server.mjs";
import { ReplayInputError } from "./parser.mjs";

const token = "test-token-that-is-long-enough";
const requestId = "11111111111111111111111111111111";

async function withServer(run, options = { token }) {
  const server = createServer(options);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if ((options.token ?? token).length >= 24 && !options.processReplay) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const response = await fetch(`http://127.0.0.1:${address.port}/healthz`);
      if (response.ok) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.close();
    await once(server, "close");
  }
}

test("health endpoint is public and cache-safe", async () => withServer(async (base) => {
  const response = await fetch(`${base}/healthz`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    ok: true,
    service: "replay-method-rl-engine",
    status: "ready",
    engineVersion: ENGINE_VERSION,
    parserVersion: PARSER_VERSION,
    activeRequests: 0,
    maxConcurrency: 1,
  });
}));

test("separates liveness from configuration readiness", async () => withServer(async (base) => {
  const live = await fetch(`${base}/livez`);
  assert.equal(live.status, 200);
  assert.equal((await live.json()).status, "live");
  const readiness = await fetch(`${base}/healthz`);
  assert.equal(readiness.status, 503);
  assert.equal((await readiness.json()).status, "not_ready");
}, { token: "short" }));

test("health remains responsive while replay processing is active", async () => {
  let releaseReplay;
  let markStarted;
  const replayStarted = new Promise((resolve) => { markStarted = resolve; });
  const replayReleased = new Promise((resolve) => { releaseReplay = resolve; });

  await withServer(async (base) => {
    const analysis = fetch(`${base}/v1/inspect/rocket-league`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
        "X-Replay-Method-Request": requestId,
        "X-Replay-Method-Player": "Player",
      },
      body: new Uint8Array([1]),
    });

    await replayStarted;
    try {
      const health = await fetch(`${base}/healthz`);
      assert.equal(health.status, 200);
      assert.equal((await health.json()).activeRequests, 1);
    } finally {
      releaseReplay();
    }

    const response = await analysis;
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { kind: "inspection", normalized: { ok: true } });
  }, {
    token,
    processReplay: async () => {
      markStarted();
      await replayReleased;
      return { kind: "inspection", normalized: { ok: true } };
    },
  });
});

test("analysis rejects missing bearer token", async () => withServer(async (base) => {
  const response = await fetch(`${base}/v1/analyze/rocket-league`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: new Uint8Array([1]),
  });
  assert.equal(response.status, 401);
}));

test("analysis rejects the wrong content type", async () => withServer(async (base) => {
  const response = await fetch(`${base}/v1/analyze/rocket-league`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "text/plain" },
    body: "not a replay",
  });
  assert.equal(response.status, 415);
}));

test("analysis rejects empty replay safely", async () => withServer(async (base) => {
  const response = await fetch(`${base}/v1/analyze/rocket-league`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "X-Replay-Method-Request": requestId,
      "X-Replay-Method-Player": "Player",
    },
    body: new Uint8Array(),
  });
  assert.equal(response.status, 422);
  assert.equal((await response.json()).code, "empty_replay");
}));

test("analysis rejects invalid replay safely", async () => withServer(async (base) => {
  const accepted = await fetch(`${base}/v1/analyze/rocket-league`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "X-Replay-Method-Request": requestId,
      "X-Replay-Method-Player": "Player",
    },
    body: new Uint8Array([1, 2, 3, 4]),
  });
  assert.equal(accepted.status, 202);
  let response;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    response = await fetch(`${base}/v1/jobs/${requestId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (response.status !== 202) break;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(response.status, 422);
  const body = await response.json();
  assert.equal(body.code, "invalid_replay");
  assert.equal(body.kind, "blocked");
}));

test("long analysis is accepted once and polled idempotently", async () => {
  let finish;
  let calls = 0;
  const result = new Promise((resolve) => { finish = resolve; });
  await withServer(async (base) => {
    const accepted = await fetch(`${base}/v1/analyze/rocket-league`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
        "X-Replay-Method-Request": requestId,
        "X-Replay-Method-Player": "Player",
      },
      body: new Uint8Array([1]),
    });
    assert.equal(accepted.status, 202);
    assert.equal((await accepted.json()).kind, "processing");
    assert.equal((await fetch(`${base}/v1/jobs/${requestId}`, { headers: { Authorization: `Bearer ${token}` } })).status, 202);
    finish({ kind: "success", normalized: { game: "rocket-league" }, findings: [], versions: {}, estimatedCostMicros: 0 });
    let completed;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      completed = await fetch(`${base}/v1/jobs/${requestId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (completed.status === 200) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(completed.status, 200);
    assert.equal((await completed.json()).kind, "success");
    assert.equal(calls, 1);
  }, {
    token,
    processReplay: async () => {
      calls += 1;
      return result;
    },
  });
});

test("player identity errors return the parsed roster as structured recovery data", async () => withServer(async (base) => {
  const response = await fetch(`${base}/v1/inspect/rocket-league`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "X-Replay-Method-Request": requestId,
      "X-Replay-Method-Player": "WrongPlayer",
    },
    body: new Uint8Array([1]),
  });
  assert.equal(response.status, 422);
  const body = await response.json();
  assert.equal(body.code, "subject_player_not_found");
  assert.deepEqual(body.candidatePlayers, ["GarrettG", "Turtle", "Moses"]);
}, {
  token,
  processReplay: async () => {
    throw new ReplayInputError(
      "subject_player_not_found",
      "Choose the exact player from this replay.",
      "Requested WrongPlayer.",
      ["GarrettG", "Turtle", "Moses"],
    );
  },
}));

test("replay-first requests may omit player metadata and receive roster plus mode", async () => withServer(async (base) => {
  const response = await fetch(`${base}/v1/analyze/rocket-league`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "X-Replay-Method-Request": requestId,
    },
    body: new Uint8Array([1]),
  });
  assert.equal(response.status, 422);
  const body = await response.json();
  assert.equal(body.code, "subject_player_required");
  assert.deepEqual(body.candidatePlayers, ["Player One", "Player Two"]);
  assert.equal(body.replayContext.mode, "Ranked Duel");
}, {
  token,
  processReplay: async ({ player }) => {
    assert.equal(player, "");
    throw new ReplayInputError(
      "subject_player_required",
      "Choose yourself.",
      "Two replay players found.",
      ["Player One", "Player Two"],
      { mode: "Ranked Duel", gameVersion: "test-build" },
    );
  },
}));

test("declared oversized input is rejected before reading", async () => withServer(async (base) => {
  const result = await new Promise((resolve, reject) => {
    const request = httpRequest(`${base}/v1/analyze/rocket-league`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
        "Content-Length": String(MAX_REPLAY_BYTES + 1),
        "X-Replay-Method-Request": requestId,
        "X-Replay-Method-Player": "Player",
      },
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({ status: response.statusCode, body: JSON.parse(Buffer.concat(chunks)) }));
    });
    request.on("error", reject);
    request.end();
  });
  assert.equal(result.status, 422);
  assert.equal(result.body.code, "file_too_large");
}));

test("requires the versioned request identifier before reading a replay", async () => withServer(async (base) => {
  const response = await fetch(`${base}/v1/analyze/rocket-league`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "X-Replay-Method-Player": "Player",
    },
    body: new Uint8Array([1]),
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "request_id_required");
}));

test("rejects oversized player metadata before parsing", async () => withServer(async (base) => {
  const response = await fetch(`${base}/v1/analyze/rocket-league`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "X-Replay-Method-Request": requestId,
      "X-Replay-Method-Player": "x".repeat(161),
    },
    body: new Uint8Array([1]),
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "subject_player_required");
}));
