import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const clientPath = new URL("../app/report/[publicId]/ReportClient.tsx", import.meta.url);
const dataPath = new URL("../lib/report-data.ts", import.meta.url);

test("keeps the private report centered on one evidence-backed finding", async () => {
  const [client, data] = await Promise.all([readFile(clientPath, "utf8"), readFile(dataPath, "utf8")]);
  assert.match(client, /YOUR PRIMARY LEAK/);
  assert.match(client, /WHY IT COSTS/);
  assert.match(client, /01 · EVIDENCE/);
  assert.match(data, /orderBy\(asc\(analysisFindings\.priority\)\)\.get\(\)/);
  assert.match(data, /\.slice\(0, 5\)/);
});

test("shows real time context only when structured evidence supplies it", async () => {
  const client = await readFile(clientPath, "utf8");
  assert.match(client, /item\.timestamp != null \? `MATCH TIME/);
  assert.match(client, /item\.round != null \? `ROUND/);
  assert.match(client, /: item\.label/);
});

test("makes verification conservative and independent from payment", async () => {
  const client = await readFile(clientPath, "utf8");
  assert.match(client, /04 · VERIFY/);
  assert.match(client, /evidence is insufficient, Replay Method stays inconclusive/);
  assert.match(client, /Cadence changes with payment\. Evidence standards do not\./);
});

test("keeps confidence, limitations and feedback controls accessible", async () => {
  const client = await readFile(clientPath, "utf8");
  assert.match(client, /CONFIDENCE \+ LIMITATIONS/);
  assert.match(client, /KNOWN LIMITATIONS/);
  assert.match(client, /aria-pressed=\{feedbackScore === score\}/);
  assert.match(client, /role="alert"/);
  assert.doesNotMatch(client, /shadowRun|review_candidates|shadow-runtime|rl_review_candidates/);
});
