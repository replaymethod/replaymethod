import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("publishes stable canonical acquisition URLs without fake sitemap freshness", async () => {
  const [sitemap, privacy, terms, betaTerms] = await Promise.all([
    source("../app/sitemap.ts"),
    source("../app/privacy/page.tsx"),
    source("../app/terms/page.tsx"),
    source("../app/beta-terms/page.tsx"),
  ]);
  assert.doesNotMatch(sitemap, /new Date\(/);
  assert.match(sitemap, /\$\{base\}\/replay-upload/);
  assert.match(privacy, /canonical: "\/privacy"/);
  assert.match(terms, /canonical: "\/terms"/);
  assert.match(betaTerms, /canonical: "\/beta-terms"/);
});

test("routes free hypotheses into the honest beta intake", async () => {
  const [climb, guide] = await Promise.all([
    source("../app/components/ClimbCheck.tsx"),
    source("../app/guides/[slug]/page.tsx"),
  ]);
  assert.match(climb, /\/analyze\?game=\$\{game\}&hypothesis=/);
  assert.match(guide, /const analysisHref = `\/analyze\?game=/);
  assert.doesNotMatch(guide, /#join-beta/);
});

test("distinguishes future games from the ten-replay Rocket League product", async () => {
  const [landing, intake, batchFlow, metadata] = await Promise.all([
    source("../app/components/Landing.tsx"),
    source("../app/analyze/AnalyzeFlow.tsx"),
    source("../app/analyze/BatchAnalyzeFlow.tsx"),
    source("../app/analyze/page.tsx"),
  ]);
  assert.match(landing, /if \(game === "league" \|\| game === "valorant"\) return <FutureGame/);
  assert.match(landing, /authorized match evidence can support the same standard/);
  assert.match(landing, /href="\/analyze"/);
  assert.match(landing, /Choose my 10 replays/);
  assert.match(landing, /Analyze my 10 replays/);
  assert.match(intake, /SAVE MY RIOT BETA REQUEST/);
  assert.match(batchFlow, /VERIFY MY 10 REPLAYS/);
  assert.match(batchFlow, /\{validCount\}\/10/);
  assert.match(intake, /Automated League and VALORANT analysis is not live/);
  assert.match(batchFlow, /same player.*same ranked.*playlist/is);
  assert.doesNotMatch(batchFlow, /START CONSOLE VIDEO BETA/);
  assert.doesNotMatch(metadata, /get one focused Replay Method diagnosis/i);
});

test("puts the product action before explanatory browsing", async () => {
  const [landing, contribution] = await Promise.all([
    source("../app/components/Landing.tsx"),
    source("../app/rocket-league-beta/ReplayContribution.tsx"),
  ]);
  assert.doesNotMatch(landing, /CHOOSE YOUR GAME|Choose my game|Contribute one replay/);
  assert.match(landing, /Replay Method finds the mistake <em>you keep repeating\.<\/em>/);
  assert.match(landing, /className="reveal-report-card[^\"]*"[\s\S]*href="\/analyze"/);
  assert.match(landing, /Start your private analysis/);
  assert.match(landing, /Choose my 10 replays/);
  assert.doesNotMatch(landing, /Your private report is ready|10 matches compared/);
  assert.match(landing, /You both go\. No one covers\./);
  assert.doesNotMatch(landing, /Free first analysis · No card required · Replays stay private|One free analysis · no card · private report|Replay Method · Experimental early access/);
  assert.ok(landing.indexOf("reveal-report-card") < landing.indexOf("<ProductMoment"));
  assert.match(contribution, /replay && <section className="rl-intake-context"/);
  assert.match(contribution, /Choose the original PC file\. The next step appears instantly/);
});

test("puts match evidence before player context without changing the intake contract", async () => {
  const intake = await source("../app/analyze/AnalyzeFlow.tsx");
  assert.match(intake, /step === 1 && game && <section>.*MATCH EVIDENCE/s);
  assert.match(intake, /step === 2 && game && <section>.*PLAYER CONTEXT/s);
  assert.match(intake, /step === 1 && game === "rocket-league" && platform === "pc" && !engineOpen/);
  for (const field of ["currentRank", "targetRank", "playerContext", "goal", "notes", "evidenceUrl", "email", "dataConsent"]) {
    assert.match(intake, new RegExp(`data\\.set\\("${field}"`));
  }
});
