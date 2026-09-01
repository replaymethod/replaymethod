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
  assert.match(batchFlow, /Drop 10 Rocket League \.replay files/);
  assert.match(landing, /See the full pattern in your free analysis/);
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
  assert.match(landing, /From endless grinding —<br \/>get a clear path toward your next target rank\./);
  assert.match(landing, /<BatchAnalyzeFlow engineOpen=\{engineOpen\} variant="hero" \/>/);
  assert.match(batchFlow, /Upload your 10 PC \.replay files/);
  assert.match(batchFlow, /Drop 10 Rocket League \.replay files/);
  assert.match(batchFlow, /Use the full upload page/);
  assert.match(landing, /By filtering out unnecessary hours of frustrating tilt, Replay Method delivers focused, easy-to-apply practice and a crystal clear breakdown of exactly what you need to change in your game\./);
  assert.match(landing, /Upload your latest ranked set\./);
  assert.match(landing, /Pinpoint exactly what to improve\./);
  assert.match(landing, /Memorize the changes\./);
  assert.match(landing, /How do I know it&apos;s not bs\?/);
  assert.match(landing, /Example report — your real report only includes patterns supported by your own \.replay files\./);
  assert.doesNotMatch(landing, /Free first analysis · No card required · Replays stay private|One free analysis · no card · private report|Replay Method · Experimental early access/);
  assert.ok(landing.indexOf("<ProductMoment") < landing.indexOf("<HowItWorks"));
  assert.ok(landing.indexOf("<HowItWorks") < landing.indexOf("<GoodToKnow"));
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
