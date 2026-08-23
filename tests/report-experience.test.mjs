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
  assert.match(client, /timeZone: "UTC"/);
  assert.match(client, /item\.timestamp != null \? `MATCH TIME/);
  assert.match(client, /item\.round != null \? `ROUND/);
  assert.match(client, /: item\.label/);
});

test("makes verification conservative and independent from payment", async () => {
  const client = await readFile(clientPath, "utf8");
  assert.match(client, /04 · VERIFY/);
  assert.match(client, /evidence is insufficient, Replay Method stays inconclusive/);
  assert.match(client, /checkoutOpen \? <aside>/);
  assert.match(client, /Payment changes cadence—not the quality gate\./);
  assert.match(client, /BETA FOLLOW-UP · NO PAYMENT/);
});

test("keeps confidence, limitations and feedback controls accessible", async () => {
  const client = await readFile(clientPath, "utf8");
  assert.match(client, /CONFIDENCE \+ LIMITATIONS/);
  assert.match(client, /KNOWN LIMITATIONS/);
  assert.match(client, /aria-pressed=\{feedbackScore === score\}/);
  assert.match(client, /role="alert"/);
  assert.doesNotMatch(client, /shadowRun|review_candidates|shadow-runtime|rl_review_candidates/);
});

test("separates Early Access facts, experimental coaching, abstention and product feedback", async () => {
  const [client, data] = await Promise.all([readFile(clientPath, "utf8"), readFile(dataPath, "utf8")]);
  assert.match(data, /badge: "EARLY ACCESS BETA"/);
  assert.match(data, /heading: "Built from your real replay\. Refined through expert validation\."/);
  assert.match(client, /data\.earlyAccess\.badge/);
  assert.match(client, /data\.earlyAccess\.heading/);
  assert.match(client, /VERIFIED MATCH FACTS/);
  assert.match(client, /EXPERIMENTAL COACHING INSIGHT/);
  assert.match(client, /LOCAL COACHING ABSTENTION/);
  assert.match(client, /not expert ground truth and does not validate a detector/);
  assert.match(data, /formalValidationStatus: "not_validated"/);
  assert.match(data, /earlyAccess\?\.coachingStatus !== "abstained"/);
  assert.match(data, /Experimental coaching display is temporarily paused by the Early Access kill switch/);
});
