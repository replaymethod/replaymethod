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
    "../app/api/analyses/[publicId]/route.ts",
    "../app/api/events/route.ts",
    "../app/api/waitlist/route.ts",
  ]) assert.match(await source(path), /isSameOriginRequest\(request\)/, path);
});

test("a parsed replay roster can resolve player identity without another upload", async () => {
  const [engine, adapter, pipeline, report, route] = await Promise.all([
    source("../services/rl-engine/server.mjs"),
    source("../lib/adapters/index.ts"),
    source("../lib/core/pipeline.ts"),
    source("../app/report/[publicId]/ReportClient.tsx"),
    source("../app/api/analyses/[publicId]/route.ts"),
  ]);
  assert.match(engine, /candidatePlayers/);
  assert.match(adapter, /userResolvable/);
  assert.match(pipeline, /encodePlayerResolutionContext/);
  assert.match(report, /Which one is you\?/);
  assert.match(report, /Analyze this saved replay/);
  assert.match(route, /analysis\.fileKey/);
  assert.match(route, /playerContext: canonicalPlayer/);
  assert.match(route, /jobPublicId: job\.publicId/);
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
  const [worker, reportClient, reportPage] = await Promise.all([
    source("../worker/index.ts"),
    source("../app/report/[publicId]/ReportClient.tsx"),
    source("../app/report/[publicId]/page.tsx"),
  ]);
  assert.match(worker, /stale_running_lease/);
  assert.doesNotMatch(worker, /updated_at <= datetime\('now', '-10 minutes'\)/);
  assert.match(worker, /updated_at <= datetime\('now', '-3 minutes'\)/);
  assert.match(worker, /Restarting interrupted analysis/);
  assert.match(worker, /Analysis engine did not respond/);
  assert.match(worker, /attempts >= max_attempts/);
  assert.match(worker, /status = 'queued' AND updated_at <= datetime\('now', '-1 minute'\)/);
  assert.match(worker, /if \(body\.jobPublicId\) await processAnalysisJob\(body\.jobPublicId, env\)/);
  assert.doesNotMatch(worker, /ctx\.waitUntil\(processAnalysisJob/);
  assert.match(worker, /valid replay parse can exceed that window/);
  assert.match(worker, /headers\.set\("X-Report-Access", accessToken\)/);
  assert.match(reportPage, /requestHeaders\.get\("x-report-access"\)/);
  assert.match(reportClient, /void refresh\(\)/);
  assert.match(reportClient, /window\.setInterval\(refresh, 10000\)/);
  assert.match(reportClient, /AUTOMATIC RECOVERY STARTED/);
  assert.match(worker, /frame-ancestors 'none'/);
  assert.match(worker, /Referrer-Policy/);
  assert.match(worker, /private, no-store/);
  assert.match(worker, /X-Content-Type-Options/);
});

test("the real-replay engine budget covers the largest calibration files without becoming unbounded", async () => {
  const [engine, client] = await Promise.all([
    source("../services/rl-engine/server.mjs"),
    source("../lib/rl-engine-client.mjs"),
  ]);
  assert.match(engine, /DEFAULT_JOB_TIMEOUT_MS = 180_000/);
  assert.match(engine, /Math\.min\(235_000/);
  assert.match(client, /RL_ENGINE_TIMEOUT_MS \|\| 180_000/);
  assert.match(client, /Math\.min\(240_000/);
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

test("console intake keeps video evidence separate from frame-exact replay telemetry", async () => {
  const [intake, adapter, flow] = await Promise.all([
    source("../app/api/analyses/route.ts"),
    source("../lib/adapters/index.ts"),
    source("../app/analyze/AnalyzeFlow.tsx"),
  ]);
  assert.match(intake, /RL_PLATFORMS = new Set\(\["pc", "ps5", "xbox", "switch"\]\)/);
  assert.match(intake, /evidenceType = hasReplay \? "replay_file" : "gameplay_video"/);
  assert.match(intake, /evidenceType = "vod_link"/);
  assert.match(intake, /Console submissions use gameplay video or a VOD link/);
  assert.match(adapter, /\["gameplay_video", "vod_link"\]\.includes\(input\.evidenceType\)/);
  assert.match(adapter, /no hidden telemetry will be invented/i);
  assert.match(intake, /RL_VIDEO_ANALYSIS_ENABLED/);
  assert.match(flow, /We are not collecting console footage until the video analysis can return a useful result/);
});
