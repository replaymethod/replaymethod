import assert from "node:assert/strict";
import test from "node:test";
import { desktopHandoffUrl } from "../lib/desktop-handoff.mjs";

test("desktop handoff preserves coarse acquisition while dropping secrets", () => {
  const result = new URL(desktopHandoffUrl("https://example.test/?utm_source=tiktok&utm_medium=social&utm_campaign=rl-launch&token=secret&email=player%40example.com#private"));
  assert.equal(result.pathname, "/");
  assert.equal(result.searchParams.get("utm_source"), "tiktok");
  assert.equal(result.searchParams.get("utm_medium"), "social");
  assert.equal(result.searchParams.get("utm_campaign"), "rl-launch");
  assert.equal(result.searchParams.get("handoff"), "mobile_to_pc");
  assert.equal(result.searchParams.has("token"), false);
  assert.equal(result.searchParams.has("email"), false);
  assert.equal(result.hash, "");
});

test("analysis handoff always returns to the supported PC replay lane", () => {
  const result = new URL(desktopHandoffUrl("https://example.test/analyze?game=rocket-league&platform=ps5&utm_source=community"));
  assert.equal(result.pathname, "/analyze");
  assert.equal(result.searchParams.get("game"), "rocket-league");
  assert.equal(result.searchParams.get("platform"), "pc");
  assert.equal(result.searchParams.get("utm_source"), "community");
});

test("unknown and private paths fall back to the public landing page", () => {
  const result = new URL(desktopHandoffUrl("https://example.test/report/private-id?accessToken=secret&utm_campaign=return"));
  assert.equal(result.pathname, "/");
  assert.equal(result.searchParams.get("utm_campaign"), "return");
  assert.equal(result.searchParams.has("accessToken"), false);
});
