import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("Rocket League intake fails closed before upload storage", async () => {
  const route = await read("../app/api/analyses/route.ts");
  const gate = route.indexOf('game === "rocket-league"');
  const storage = route.indexOf("bucket.put");
  assert.ok(gate > -1);
  assert.ok(route.includes("RL_ENGINE_ENABLED"));
  assert.ok(route.includes("status: 503"));
  assert.ok(gate < storage, "engine gate must run before the replay is stored");
});

test("closed production landing sends players to a working free tool or waitlist", async () => {
  const landing = await read("../app/components/Landing.tsx");
  const home = await read("../app/page.tsx");
  assert.match(home, /RL_ENGINE_ENABLED/);
  assert.match(home, /RL_PUBLIC_DETECTORS_ENABLED/);
  assert.match(landing, /const replayReady = engineOpen/);
  assert.match(landing, /const calibrationReady = calibrationOpen && game === "rocket-league"/);
  assert.match(landing, /game === "general" \? "#choose-game" : "\/climb-check"/);
  assert.match(landing, /Try the free Climb Check/);
  assert.match(landing, /Console video and Riot match analysis are not live/);
  assert.match(landing, /replayReady \? <QuickReplayStart/);
});

test("calibration collection is independently gated before private storage", async () => {
  const [route, page, controls] = await Promise.all([
    read("../app/api/rl-beta-submissions/route.ts"),
    read("../app/rocket-league-beta/page.tsx"),
    read("../lib/subsystem-controls.mjs"),
  ]);
  const gate = route.indexOf("RL_CALIBRATION_INTAKE_ENABLED");
  const storage = route.indexOf("BUCKET.put");
  assert.ok(gate > -1 && storage > gate);
  assert.match(route, /calibrationConsent/);
  assert.match(route, /rightsConfirmed/);
  assert.match(route, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(route, /rl-calibration\/\$\{publicId\}/);
  assert.doesNotMatch(route, /rl-calibration\/\$\{email\}/);
  assert.match(page, /subsystemEnabled/);
  assert.match(controls, /rocketLeagueCalibrationIntake/);
});

test("paid checkout is coupled to the complete product-readiness gate", async () => {
  const home = await read("../app/page.tsx");
  const game = await read("../app/[game]/page.tsx");
  const checkout = await read("../app/api/billing/checkout/route.ts");
  for (const source of [home, game, checkout]) assert.match(source, /paidCheckoutReadiness/);
});

test("verified player data controls require auth, origin and explicit deletion confirmation", async () => {
  const route = await read("../app/api/player/data/route.ts");
  assert.match(route, /authenticatedPlayer\(request, database\)/);
  assert.match(route, /if \(!isSameOrigin\(request\)\)/);
  assert.match(route, /payload\.confirmation !== "DELETE MY DATA"/);
  assert.match(route, /activeSubscriptionStatuses\.has/);
  assert.match(route, /await bucket\.delete\(objectKeys\)/);
  assert.match(route, /DELETE FROM player_sessions/);
  assert.doesNotMatch(route, /stripe_customer_id AS/);
});
