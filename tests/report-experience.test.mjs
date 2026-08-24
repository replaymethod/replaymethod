import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const clientPath = new URL("../app/report/[publicId]/ReportClient.tsx", import.meta.url);
const dataPath = new URL("../lib/report-data.ts", import.meta.url);

test("keeps the private report centered on one evidence-backed finding", async () => {
  const [client, data] = await Promise.all([readFile(clientPath, "utf8"), readFile(dataPath, "utf8")]);
  assert.match(client, /BIGGEST SUPPORTED OPPORTUNITY/);
  assert.match(client, /THE DECISION TO FIX FIRST/);
  assert.match(client, /YOUR NEXT 3 MATCHES/);
  assert.match(client, /FULL MATCH STATS/);
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
  assert.match(client, /Advanced details/);
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
  assert.match(client, /VERIFIED MATCH CONTEXT/);
  assert.match(client, /EXPERIMENTAL COACHING/);
  assert.match(client, /HONEST RESULT/);
  assert.match(client, /FULL MATCH STATS · UNAVAILABLE/);
  assert.match(client, /No missing match measures were estimated or presented as facts/);
  assert.match(client, /They never change what the replay itself proved/);
  assert.match(client, /Was it clear why coaching was withheld\?/);
  assert.match(client, /Free: find the pattern\. Premium: prove you fixed it\./);
  assert.match(client, /feedbackQuestions = data\.report/);
  assert.match(data, /formalValidationStatus: "not_validated"/);
  assert.match(data, /earlyAccess\?\.coachingStatus !== "abstained"/);
  assert.match(data, /Experimental coaching display is temporarily paused by the Early Access kill switch/);
});

test("facts-only abstention releases the free allowance while preserving the ready report", async () => {
  const pipeline = await readFile(new URL("../lib/core/pipeline.ts", import.meta.url), "utf8");
  const start = pipeline.indexOf('result.abstention && result.outputTier === "experimental_early_access"');
  const end = pipeline.indexOf("if (result.abstention)", start + 1);
  const branch = pipeline.slice(start, end);
  assert.match(branch, /analysis_usage SET status = 'released'/);
  assert.match(branch, /analysis_requests SET status = 'ready'/);
  assert.doesNotMatch(branch, /analysis_usage SET status = 'consumed'/);
});
