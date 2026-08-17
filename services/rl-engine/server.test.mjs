import assert from "node:assert/strict";
import { once } from "node:events";
import { request as httpRequest } from "node:http";
import test from "node:test";
import { createServer, ENGINE_VERSION, MAX_REPLAY_BYTES, PARSER_VERSION } from "./server.mjs";

const token = "test-token-that-is-long-enough";

async function withServer(run) {
  const server = createServer({ token });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
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
  });
}));

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
      "X-Replay-Method-Player": "Player",
    },
    body: new Uint8Array(),
  });
  assert.equal(response.status, 422);
  assert.equal((await response.json()).code, "empty_replay");
}));

test("analysis rejects invalid replay safely", async () => withServer(async (base) => {
  const response = await fetch(`${base}/v1/analyze/rocket-league`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "X-Replay-Method-Player": "Player",
    },
    body: new Uint8Array([1, 2, 3, 4]),
  });
  assert.equal(response.status, 422);
  const body = await response.json();
  assert.equal(body.code, "invalid_replay");
  assert.equal(body.kind, "blocked");
}));

test("declared oversized input is rejected before reading", async () => withServer(async (base) => {
  const result = await new Promise((resolve, reject) => {
    const request = httpRequest(`${base}/v1/analyze/rocket-league`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
        "Content-Length": String(MAX_REPLAY_BYTES + 1),
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
