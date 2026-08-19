import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { declaredBodyTooLarge, isSameOriginRequest, operationalErrorCode } from "../lib/request-security.mjs";

const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("request guards reject foreign writes and malformed declared sizes without logging messages", () => {
  assert.equal(isSameOriginRequest(new Request("https://replaymethod.xyz/api/events", { method: "POST", headers: { Origin: "https://replaymethod.xyz" } })), true);
  assert.equal(isSameOriginRequest(new Request("https://replaymethod.xyz/api/events", { method: "POST", headers: { Origin: "https://attacker.example" } })), false);
  assert.equal(declaredBodyTooLarge(new Request("https://replaymethod.xyz", { headers: { "Content-Length": "513" } }), 512), true);
  assert.equal(declaredBodyTooLarge(new Request("https://replaymethod.xyz"), 512), false);
  const sensitive = Object.assign(new Error("player@example.com and a private token"), { code: "provider/rejected secret" });
  assert.equal(operationalErrorCode(sensitive), "provider_rejected_secret");
});

test("public mutations consistently enforce same-origin product boundaries", async () => {
  for (const path of [
    "../app/api/analyses/route.ts",
    "../app/api/analyses/history/route.ts",
    "../app/api/analyses/[publicId]/feedback/route.ts",
    "../app/api/events/route.ts",
    "../app/api/waitlist/route.ts",
  ]) assert.match(await source(path), /isSameOriginRequest\(request\)/, path);
});

test("private bearer identifiers stay out of object keys and engine logs", async () => {
  const [intake, pipeline, engineClient] = await Promise.all([
    source("../app/api/analyses/route.ts"),
    source("../lib/core/pipeline.ts"),
    source("../lib/rl-engine-client.mjs"),
  ]);
  assert.match(intake, /analyses\/\$\{storageId\}/);
  assert.doesNotMatch(intake, /analyses\/\$\{publicId\}/);
  assert.match(pipeline, /normalized\/\$\{job\.game\}\/\$\{job\.jobPublicId\}/);
  assert.doesNotMatch(pipeline, /console\.(?:error|warn)\([^\n]*job\.publicId/);
  assert.match(engineClient, /X-Replay-Method-Request": cleanHeader\(input\.jobPublicId/);
});

test("runtime recovery and response headers fail closed without blocking healthy work", async () => {
  const worker = await source("../worker/index.ts");
  assert.match(worker, /stale_running_lease/);
  assert.match(worker, /updated_at <= datetime\('now', '-10 minutes'\)/);
  assert.match(worker, /status = 'queued' AND updated_at <= datetime\('now', '-1 minute'\)/);
  assert.match(worker, /frame-ancestors 'none'/);
  assert.match(worker, /Referrer-Policy/);
  assert.match(worker, /private, no-store/);
  assert.match(worker, /X-Content-Type-Options/);
});

test("admin exports and replay downloads neutralize active content", async () => {
  const [waitlist, evidence, override] = await Promise.all([
    source("../app/api/admin/waitlist/route.ts"),
    source("../app/api/admin/analyses/[id]/evidence/route.ts"),
    source("../app/api/admin/analyses/[id]/route.ts"),
  ]);
  assert.match(waitlist, /\^\[=\+\\-@\\t\\r\]/);
  assert.match(waitlist, /requireSiteAdminMutation\(request\)/);
  assert.match(evidence, /application\/octet-stream/);
  assert.match(evidence, /X-Content-Type-Options/);
  assert.match(override, /analysisUsage/);
  assert.match(override, /status: "consumed"/);
});
