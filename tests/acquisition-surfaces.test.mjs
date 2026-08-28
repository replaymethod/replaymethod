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

test("keeps the public product Rocket League-only", async () => {
  const [landing, batchFlow, metadata, gameRoute, sitemap] = await Promise.all([
    source("../app/components/Landing.tsx"),
    source("../app/analyze/BatchAnalyzeFlow.tsx"),
    source("../app/analyze/page.tsx"),
    source("../app/[game]/page.tsx"),
    source("../app/sitemap.ts"),
  ]);
  assert.match(batchFlow, /href="\/analyze"/);
  assert.match(batchFlow, /Drop 10 original \.replay files/);
  assert.match(landing, /Analyze my replays/);
  assert.match(batchFlow, /START MY PRIVATE ANALYSIS/);
  assert.match(batchFlow, /\{validCount\}\/10/);
  assert.match(batchFlow, /same player.*same ranked.*playlist/is);
  assert.doesNotMatch(batchFlow, /START CONSOLE VIDEO BETA/);
  assert.doesNotMatch(metadata, /get one focused Replay Method diagnosis/i);
  assert.match(gameRoute, /permanentRedirect\("\/"\)/);
  assert.doesNotMatch(sitemap, /\/league|\/valorant|\/climb-check|\/guides"/);
});

test("puts the product action before explanatory browsing", async () => {
  const [landing, batchFlow, contribution] = await Promise.all([
    source("../app/components/Landing.tsx"),
    source("../app/analyze/BatchAnalyzeFlow.tsx"),
    source("../app/rocket-league-beta/ReplayContribution.tsx"),
  ]);
  assert.doesNotMatch(landing, /CHOOSE YOUR GAME|Choose my game|Contribute one replay/);
  assert.match(landing, /Stop losing for<br \/>the same reason\./);
  assert.match(landing, /<BatchAnalyzeFlow engineOpen=\{engineOpen\} variant="hero" \/>/);
  assert.match(batchFlow, /Analyze your replays/);
  assert.match(batchFlow, /Drop 10 original \.replay files/);
  assert.match(batchFlow, /Open full upload page/);
  assert.match(landing, /See the pattern\.<br \/>Open the proof\./);
  assert.match(landing, /No clear pattern means no invented answer\./);
  assert.doesNotMatch(landing, /Free first analysis · No card required · Replays stay private|One free analysis · no card · private report|Replay Method · Experimental early access/);
  assert.ok(landing.indexOf("<HowItWorks") < landing.indexOf("<ProductMoment"));
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
