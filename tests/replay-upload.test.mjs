import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { readApiResponse } from "../lib/client-api-response.mjs";
import { releaseExistingAnalysisUsage, reserveExistingAnalysisUsage } from "../lib/analysis-usage-state.mjs";
import { expectedReplayPartSize, MAX_REPLAY_BYTES, MAX_REPLAY_PARTS, REPLAY_CHUNK_BYTES, safeReplayFileName, sha256Hex } from "../lib/replay-upload.mjs";
import { canAccessAnalysis } from "../lib/report-access.mjs";
import { createPlayerToken, hashPlayerToken, PLAYER_SESSION_COOKIE } from "../lib/player-identity.mjs";

const source = path => readFile(new URL(path, import.meta.url), "utf8");

class UsageDatabase {
  constructor(rows) { this.rows = rows; }
  prepare(sql) {
    return {
      bind: analysisRequestId => ({
        first: async () => {
          const row = this.rows.find(item => item.analysisRequestId === analysisRequestId);
          return row ? { status: row.status } : null;
        },
        run: async () => {
          const row = this.rows.find(item => item.analysisRequestId === analysisRequestId);
          if (!row) return { meta: { changes: 0 } };
          if (sql.includes("SET status = 'reserved'")) {
            if (row.status !== "released") return { meta: { changes: 0 } };
            const conflict = this.rows.some(item => item !== row && item.slot === row.slot && ["reserved", "consumed"].includes(item.status));
            if (conflict) throw new Error("analysis_usage_active_slot_unique");
            row.status = "reserved";
            return { meta: { changes: 1 } };
          }
          if (sql.includes("SET status = 'released'")) {
            if (row.status !== "reserved") return { meta: { changes: 0 } };
            row.status = "released";
            return { meta: { changes: 1 } };
          }
          throw new Error(`Unexpected SQL: ${sql}`);
        },
      }),
    };
  }
}

test("advertised 16 MiB replay boundary divides into ingress-safe exact parts", () => {
  assert.equal(MAX_REPLAY_BYTES, 16 * 1024 * 1024);
  assert.equal(REPLAY_CHUNK_BYTES, 512 * 1024);
  assert.equal(MAX_REPLAY_PARTS, 32);
  assert.equal(expectedReplayPartSize(MAX_REPLAY_BYTES, 0), REPLAY_CHUNK_BYTES);
  assert.equal(expectedReplayPartSize(MAX_REPLAY_BYTES, 31), REPLAY_CHUNK_BYTES);
  assert.equal(expectedReplayPartSize(MAX_REPLAY_BYTES - 7, 31), REPLAY_CHUNK_BYTES - 7);
  assert.equal(expectedReplayPartSize(MAX_REPLAY_BYTES, 32), 0);
});

test("staging primitives sanitize names and produce stable integrity fingerprints", async () => {
  assert.equal(safeReplayFileName("../../private match.replay"), "..-..-private-match.replay");
  assert.equal(await sha256Hex("same bytes"), await sha256Hex(new TextEncoder().encode("same bytes")));
  assert.notEqual(await sha256Hex("same bytes"), await sha256Hex("different bytes"));
});

test("customer response parsing handles JSON, plain text, HTML and gateway rejection safely", async () => {
  assert.deepEqual(await readApiResponse(Response.json({ error: "specific" }, { status: 400 })), { error: "specific" });
  const plain = await readApiResponse(new Response("Payload Too Large", { status: 413, headers: { "Content-Type": "text/plain" } }));
  assert.match(plain.error, /before Replay Method could save it/);
  assert.doesNotMatch(plain.error, /Unexpected token|Payload Too Large/);
  const html = await readApiResponse(new Response("<html>gateway</html>", { status: 502, headers: { "Content-Type": "text/html" } }));
  assert.match(html.error, /did not respond correctly/);
  assert.doesNotMatch(html.error, /<html>/);
});

test("retry, refresh and duplicate continuation reuse one entitlement row", async () => {
  const rows = [{ analysisRequestId: 1, slot: 1, status: "reserved" }];
  const database = new UsageDatabase(rows);
  assert.equal(await reserveExistingAnalysisUsage(database, 1), true, "refresh is idempotent");
  await releaseExistingAnalysisUsage(database, 1);
  assert.equal(rows[0].status, "released", "timeout or unsupported result releases the slot");
  assert.equal(await reserveExistingAnalysisUsage(database, 1), true, "retry reopens the same row");
  assert.equal(await reserveExistingAnalysisUsage(database, 1), true, "duplicate retry does not add a row");
  assert.equal(rows.length, 1);
});

test("concurrent new work wins a released slot and a late completion cannot consume it", async () => {
  const rows = [
    { analysisRequestId: 1, slot: 1, status: "released" },
    { analysisRequestId: 2, slot: 1, status: "reserved" },
  ];
  const database = new UsageDatabase(rows);
  assert.equal(await reserveExistingAnalysisUsage(database, 1), false);
  assert.equal(rows[0].status, "released");
  assert.equal(rows[1].status, "reserved");
});

test("report ownership rejects a cross-user token and honors access expiry or an owner session", async () => {
  const reportToken = createPlayerToken();
  const ownerSession = createPlayerToken();
  const database = {
    prepare: () => ({
      bind: (_publicId, reportHash, now, sessionHash) => ({
        first: async () => {
          const reportValid = reportHash === await hashPlayerToken(reportToken) && new Date("2099-01-01T00:00:00.000Z") > new Date(now);
          const sessionValid = sessionHash === await hashPlayerToken(ownerSession);
          return reportValid || sessionValid ? { id: 1 } : null;
        },
      }),
    }),
  };
  assert.equal(await canAccessAnalysis(database, "a".repeat(32), reportToken, ""), true);
  assert.equal(await canAccessAnalysis(database, "a".repeat(32), createPlayerToken(), ""), false);
  assert.equal(await canAccessAnalysis(database, "a".repeat(32), "", `${PLAYER_SESSION_COOKIE}=${ownerSession}`), true);

  const expired = { prepare: () => ({ bind: () => ({ first: async () => null }) }) };
  assert.equal(await canAccessAnalysis(expired, "a".repeat(32), reportToken, ""), false);
});

test("upload chain is private, bounded, ownership-linked, idempotent and deletable", async () => {
  const [start, part, complete, intake, client, pipeline, deletion, worker] = await Promise.all([
    source("../app/api/replay-uploads/route.ts"),
    source("../app/api/replay-uploads/[uploadId]/parts/[partNumber]/route.ts"),
    source("../app/api/replay-uploads/[uploadId]/complete/route.ts"),
    source("../app/api/analyses/route.ts"),
    source("../lib/client-replay-upload.ts"),
    source("../lib/core/pipeline.ts"),
    source("../app/api/player/data/route.ts"),
    source("../worker/index.ts"),
  ]);
  for (const route of [start, part, complete]) assert.match(route, /isSameOriginRequest\(request\)/);
  assert.match(start, /fileSize > MAX_REPLAY_BYTES/);
  assert.match(start, /token_hash/);
  assert.match(part, /body\.byteLength !== expectedSize/);
  assert.match(part, /INSERT OR IGNORE INTO replay_upload_parts/);
  assert.match(complete, /failed integrity check/);
  assert.match(complete, /status = 'complete'/);
  assert.doesNotMatch(start + part + complete, /R2_ACCESS|SECRET_ACCESS|presign/i);
  assert.match(intake, /status === "claimed"/);
  assert.match(intake, /idempotent: true/);
  assert.match(client, /uploadReplayInChunks/);
  assert.doesNotMatch(client, /response\.json\(\)/);
  assert.match(pipeline, /if \(!completion\[0\]\.meta\.changes\) return/);
  assert.match(deletion, /replay_upload_sessions/);
  assert.match(worker, /replay-uploads/);
});
