import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = path => readFile(new URL(path, import.meta.url), "utf8");
const exactMessage = "Den här mejladressen har redan använt sin kostnadsfria analys.";

test("used free analysis is a distinct entitlement state with the binding Swedish message", async () => {
  const [entitlements, uploadRoute, analysisRoute] = await Promise.all([
    source("../lib/analysis-entitlements.ts"),
    source("../app/api/replay-uploads/route.ts"),
    source("../app/api/analyses/route.ts"),
  ]);
  assert.match(entitlements, new RegExp(exactMessage.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(entitlements, /"free_analysis_used"/);
  assert.match(entitlements, /"free_analysis_in_progress"/);
  assert.match(entitlements, /Resume the saved batch or open its private report link/);
  for (const route of [uploadRoute, analysisRoute]) {
    assert.match(route, /code: error\.code/);
    assert.match(route, /error instanceof EntitlementError/);
  }
});

test("used-free UI offers report history, verification, and future plans without an upload-error wrapper", async () => {
  const [state, analyze, analyzePage, quick] = await Promise.all([
    source("../app/components/FreeAnalysisUsed.tsx"),
    source("../app/analyze/AnalyzeFlow.tsx"),
    source("../app/analyze/page.tsx"),
    source("../app/components/QuickReplayStart.tsx"),
  ]);
  assert.match(state, new RegExp(exactMessage.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(state, /\/reports#report-history/);
  assert.match(state, /\/reports#verification/);
  assert.match(state, /\/#pricing/);
  assert.match(state, /Ingen fil laddades upp och ingen ny analys eller allowance skapades\./);
  for (const client of [analyze, quick]) {
    assert.match(client, /detail === FREE_ANALYSIS_USED_MESSAGE/);
    assert.match(client, /allowanceUsed \? ""/);
    assert.match(client, /<FreeAnalysisUsed \/>/);
  }
  assert.match(analyzePage, /process\.env\.REPLAYMETHOD_E2E_FIXTURES === "true"/);
  assert.match(analyzePage, /query\.freeAnalysisUsed === "1"/);
});
