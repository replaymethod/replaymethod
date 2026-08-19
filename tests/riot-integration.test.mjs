import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolveAuthorizedRiotAccount, resolveRiotIntegration } from "../lib/riot-integration.mjs";

const leagueKey = "approved-league-key-placeholder";
const valorantKey = "approved-valorant-key-placeholder";
const rso = {
  RIOT_RSO_CLIENT_ID: "replay-method-client",
  RIOT_RSO_CLIENT_SECRET: "approved-rso-secret-placeholder",
  RIOT_RSO_REDIRECT_URI: "https://replaymethod.xyz/api/riot/callback",
};

test("requires separate game production credentials and complete RSO configuration", () => {
  assert.equal(resolveRiotIntegration("league", {}).code, "riot_production_access_required");
  assert.equal(resolveRiotIntegration("league", { RIOT_VALORANT_API_KEY: valorantKey, ...rso }).code, "riot_production_access_required");
  assert.equal(resolveRiotIntegration("league", { RIOT_LEAGUE_API_KEY: leagueKey }).code, "riot_rso_required");
  assert.equal(resolveRiotIntegration("valorant", { RIOT_VALORANT_API_KEY: valorantKey, ...rso }).ok, true);
});

test("bounds the official client timeout and allows loopback only for local redirects", () => {
  const local = resolveRiotIntegration("league", {
    RIOT_LEAGUE_API_KEY: leagueKey,
    ...rso,
    RIOT_RSO_REDIRECT_URI: "http://127.0.0.1:8787/api/riot/callback",
    RIOT_API_TIMEOUT_MS: "1",
  });
  assert.equal(local.ok, true);
  assert.equal(local.timeoutMs, 3_000);
  const invalid = resolveRiotIntegration("league", {
    RIOT_LEAGUE_API_KEY: leagueKey,
    ...rso,
    RIOT_RSO_REDIRECT_URI: "http://example.com/api/riot/callback",
  });
  assert.equal(invalid.code, "riot_rso_required");
  const bounded = resolveRiotIntegration("league", { RIOT_LEAGUE_API_KEY: leagueKey, ...rso, RIOT_API_TIMEOUT_MS: "999999" });
  assert.equal(bounded.timeoutMs, 30_000);
});

test("requires an RSO-connected opaque PUUID and routing region", () => {
  assert.equal(resolveAuthorizedRiotAccount({}).code, "riot_account_connection_required");
  assert.equal(resolveAuthorizedRiotAccount({
    providerConnectionStatus: "connected",
    providerAccountId: "too-short",
    providerRegion: "europe",
  }).code, "riot_account_connection_required");
  assert.deepEqual(resolveAuthorizedRiotAccount({
    providerConnectionStatus: "connected",
    providerAccountId: "p".repeat(64),
    providerRegion: "EUROPE",
  }), { ok: true, puuid: "p".repeat(64), region: "europe" });
});

test("does not promote typed Riot context into a connected provider account", async () => {
  const [submission, pipeline, adapter, contracts] = await Promise.all([
    readFile(new URL("../app/api/analyses/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/core/pipeline.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/adapters/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/riot-contracts.ts", import.meta.url), "utf8"),
  ]);
  assert.match(submission, /if \(game === "rocket-league" && playerContext\)/);
  assert.doesNotMatch(submission, /game === "rocket-league" \? "epic" : "riot"/);
  assert.match(pipeline, /ga\.external_id AS provider_account_id/);
  assert.match(pipeline, /ga\.connection_status AS provider_connection_status/);
  const riotAdapter = adapter.slice(adapter.indexOf("function riotAdapter"), adapter.indexOf("export async function runGameAdapter"));
  assert.doesNotMatch(riotAdapter, /fetch\(/);
  assert.match(riotAdapter, /riot_match_ingestion_not_activated/);
  assert.match(contracts, /matchPayloads: readonly unknown\[\]/);
  assert.match(contracts, /timelinePayloads: readonly unknown\[\]/);
});
