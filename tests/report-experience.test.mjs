import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const clientPath = new URL("../app/report/[publicId]/ReportClient.tsx", import.meta.url);
const dataPath = new URL("../lib/report-data.ts", import.meta.url);

test("keeps the private report centered on one evidence-backed finding", async () => {
  const [client, data] = await Promise.all([readFile(clientPath, "utf8"), readFile(dataPath, "utf8")]);
  assert.match(client, /BIGGEST SUPPORTED OPPORTUNITY/);
  assert.match(client, /DEEP DIVE · ONE AREA/);
  assert.match(client, /ONE-FOCUS PLAN/);
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
  assert.match(client, /No rank benchmark, stable-habit claim or calibrated precision/);
  assert.match(client, /No coaching plan was released from this replay/);
  assert.match(client, /COMING LATER · NOT FOR SALE/);
  assert.match(client, /there is no checkout or locked evidence here/);
  assert.doesNotMatch(client, /checkoutOpen \?/);
});

test("keeps confidence, limitations and feedback controls accessible", async () => {
  const client = await readFile(clientPath, "utf8");
  assert.match(client, /Evidence &amp; methodology/);
  assert.match(client, /KNOWN LIMITATIONS/);
  assert.match(client, /aria-pressed=\{feedbackSignals\[key\] === value\}/);
  assert.match(client, /product feedback only/);
  assert.match(client, /role="alert"/);
  assert.doesNotMatch(client, /\$\{confidence\}%/);
  assert.doesNotMatch(client, /shadowRun|review_candidates|shadow-runtime|rl_review_candidates/);
});

test("separates Early Access facts, experimental coaching, abstention and product feedback", async () => {
  const [client, data] = await Promise.all([readFile(clientPath, "utf8"), readFile(dataPath, "utf8")]);
  assert.match(data, /badge: "EARLY ACCESS BETA"/);
  assert.match(data, /heading: "Built from your real replay\. Refined through expert validation\."/);
  assert.match(client, /data\.earlyAccess\.badge/);
  assert.match(client, /REPORT STATUS &amp; VERIFIED FACTS/);
  assert.match(client, /EXPERIMENTAL COACHING/);
  assert.match(client, /LOCAL ABSTENTION/);
  assert.match(client, /never treated as replay ground truth, detector labels or expert validation/);
  assert.match(data, /formalValidationStatus: "not_validated"/);
  assert.match(data, /earlyAccess\?\.coachingStatus !== "abstained"/);
  assert.match(data, /Experimental coaching display is temporarily paused by the Early Access kill switch/);
});
