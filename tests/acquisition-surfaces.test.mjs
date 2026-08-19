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

test("distinguishes Riot access requests from evidence-gated replay outcomes", async () => {
  const [landing, intake, quickReplay, metadata] = await Promise.all([
    source("../app/components/Landing.tsx"),
    source("../app/analyze/AnalyzeFlow.tsx"),
    source("../app/components/QuickReplayStart.tsx"),
    source("../app/analyze/page.tsx"),
  ]);
  assert.match(landing, /const riotRequest = game === "league" \|\| game === "valorant"/);
  assert.match(landing, /Official ingestion is pending/);
  assert.match(intake, /SAVE MY RIOT BETA REQUEST/);
  assert.match(intake, /START REPLAY EVIDENCE CHECK/);
  assert.doesNotMatch(quickReplay, /Get one priority|START FREE ANALYSIS/);
  assert.doesNotMatch(metadata, /get one focused Replay Method diagnosis/i);
});
