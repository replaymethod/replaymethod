import assert from "node:assert/strict";
import test from "node:test";

import {
  clearReplayUploadRecovery,
  loadReplayUploadRecovery,
  replayRecoveryStorageAvailable,
  saveReplayUploadRecovery,
} from "../lib/client-replay-recovery.mjs";
import { uploadReplayInChunks } from "../lib/client-replay-upload.ts";

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

function replayFile() {
  return new File([new Uint8Array([1, 2, 3, 4, 5])], "ranked.replay", {
    type: "application/octet-stream",
    lastModified: 1_787_456_800_000,
  });
}

function recovery(file = replayFile()) {
  return {
    version: 1,
    uploadId: "a".repeat(32),
    uploadToken: "t".repeat(48),
    chunkSize: 2,
    expectedParts: 3,
    expiresAt: "2099-01-01T00:00:00.000Z",
    fileName: file.name,
    fileSize: file.size,
    fileLastModified: file.lastModified,
    email: "owner@example.com",
  };
}

test("upload recovery is durable, exact-file scoped, expiring and explicitly clearable", () => {
  const storage = new MemoryStorage();
  const file = replayFile();
  const saved = recovery(file);
  assert.equal(replayRecoveryStorageAvailable(storage), true);
  assert.equal(saveReplayUploadRecovery(storage, saved), true);
  assert.deepEqual(loadReplayUploadRecovery(storage, file, " OWNER@example.com "), saved);
  assert.equal(loadReplayUploadRecovery(storage, new File([new Uint8Array(5)], "other.replay", { lastModified: file.lastModified }), saved.email), null);
  assert.deepEqual(loadReplayUploadRecovery(storage, file, saved.email), saved, "a non-matching file must not discard a recoverable session");
  clearReplayUploadRecovery(storage, "b".repeat(32));
  assert.deepEqual(loadReplayUploadRecovery(storage, file, saved.email), saved);
  clearReplayUploadRecovery(storage, saved.uploadId);
  assert.equal(loadReplayUploadRecovery(storage, file, saved.email), null);

  assert.equal(saveReplayUploadRecovery(storage, { ...saved, expiresAt: "2020-01-01T00:00:00.000Z" }), true);
  assert.equal(loadReplayUploadRecovery(storage, file, saved.email), null);
});

test("failed final assembly preserves one session and reload retry performs no second upload", async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const file = replayFile();
  let phase = "fail-finalize";
  let starts = 0;
  let parts = 0;
  let completes = 0;
  const events = [];
  let persisted = null;

  globalThis.fetch = async (url, init = {}) => {
    if (url === "/api/replay-uploads") {
      starts += 1;
      events.push("start");
      return Response.json({
        uploadId: "a".repeat(32),
        uploadToken: "t".repeat(48),
        chunkSize: 2,
        expectedParts: 3,
        expiresAt: "2099-01-01T00:00:00.000Z",
      }, { status: 201 });
    }
    if (init.method === "PUT") {
      parts += 1;
      events.push("part");
      return Response.json({ saved: true });
    }
    completes += 1;
    if (phase === "fail-finalize") {
      return Response.json({ error: "assembly interrupted", recovery: "assembly_failed", retryable: true }, { status: 500 });
    }
    return Response.json({ completed: true, fileSaved: true, sha256: "f".repeat(64) });
  };

  await assert.rejects(
    uploadReplayInChunks(file, "owner@example.com", true, undefined, {
      wait: async () => {},
      onRecovery: value => { events.push("persist"); persisted = value; },
    }),
    /assembly interrupted/,
  );
  assert.ok(persisted);
  assert.deepEqual(events.slice(0, 3), ["start", "persist", "part"], "the token must be persisted before any chunk or final assembly");
  assert.equal(starts, 1);
  assert.equal(parts, 3);
  assert.equal(completes, 8, "final assembly retries are bounded");

  phase = "resume-success";
  const staged = await uploadReplayInChunks(file, "owner@example.com", true, undefined, {
    recovery: persisted,
    wait: async () => {},
  });
  assert.equal(staged.uploadId, persisted.uploadId);
  assert.equal(starts, 1, "reload recovery must not initiate another upload session");
  assert.equal(parts, 3, "reload recovery must not resend chunks after committed assembly");
  assert.equal(completes, 9);
});

test("an interrupted finalize response retries the same idempotent completion request", async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const file = replayFile();
  const saved = recovery(file);
  let completes = 0;
  globalThis.fetch = async url => {
    assert.match(String(url), new RegExp(saved.uploadId));
    completes += 1;
    if (completes === 1) throw new TypeError("connection closed after commit");
    return Response.json({ completed: true, fileSaved: true, sha256: "f".repeat(64) });
  };
  const result = await uploadReplayInChunks(file, saved.email, true, undefined, { recovery: saved, wait: async () => {} });
  assert.equal(result.uploadId, saved.uploadId);
  assert.equal(completes, 2);
});
