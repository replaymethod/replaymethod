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
  assert.match(landing, /const intakeHref = replayClosed \? "#join-beta" : analysisHref/);
  assert.match(landing, /Try the free Climb Check/);
  assert.match(landing, /Console video analysis and official Riot match analysis are not live yet/);
  assert.doesNotMatch(landing, /QuickReplayStart/);
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
