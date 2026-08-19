import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dashboardPath = new URL("../app/admin/page.tsx", import.meta.url);
const detailPath = new URL("../app/admin/analyses/[id]/page.tsx", import.meta.url);
const adminApiPaths = [
  new URL("../app/api/admin/analyses/[id]/route.ts", import.meta.url),
  new URL("../app/api/admin/analyses/[id]/retry/route.ts", import.meta.url),
  new URL("../app/api/admin/analyses/[id]/evidence/route.ts", import.meta.url),
  new URL("../app/api/admin/rl-review/[id]/route.ts", import.meta.url),
];
const adminMutationPaths = [adminApiPaths[0], adminApiPaths[1], adminApiPaths[3]];

test("keeps mission control behind the configured owner identity", async () => {
  const [dashboard, detail] = await Promise.all([readFile(dashboardPath, "utf8"), readFile(detailPath, "utf8")]);
  for (const source of [dashboard, detail]) {
    assert.match(source, /requireChatGPTUser/);
    assert.match(source, /isConfiguredSiteAdmin/);
    assert.match(source, /Access denied/);
  }
  const admin = await readFile(new URL("../lib/admin.ts", import.meta.url), "utf8");
  assert.match(admin, /ADMIN_USER_ID/);
  assert.match(admin, /ADMIN_EMAIL/);
  assert.ok(admin.indexOf("if (adminUserId)") < admin.indexOf("const adminEmail"));
});

test("keeps every operational admin API authorization guard", async () => {
  for (const path of adminApiPaths) {
    const source = await readFile(path, "utf8");
    assert.match(source, /requireSiteAdmin(?:Api|Mutation)\(/);
    assert.match(source, /if \(unauthorized\) return unauthorized/);
  }
  for (const path of adminMutationPaths) {
    const source = await readFile(path, "utf8");
    assert.match(source, /requireSiteAdminMutation\(request\)/);
  }
});

test("summarizes only persisted operational systems", async () => {
  const source = await readFile(dashboardPath, "utf8");
  for (const table of ["billingSubscriptions", "analysisUsage", "emailDeliveries", "playerFocuses", "billingEvents", "rlReviewCandidates"]) {
    assert.match(source, new RegExp(`from\\(${table}\\)`));
  }
  assert.match(source, /Persisted records only/);
  assert.doesNotMatch(source, /projected revenue|synthetic conversion|fabricated health/i);
  assert.doesNotMatch(source, /stripeCustomerId|stripeSubscriptionId|providerMessageId/);
});

test("shows analysis-level pipeline, entitlement, email, focus and feedback state", async () => {
  const source = await readFile(detailPath, "utf8");
  assert.match(source, /ANALYZER \/ COACHING/);
  assert.match(source, /PIPELINE ATTENTION/);
  assert.match(source, /ENTITLEMENT/);
  assert.match(source, /TRANSACTIONAL EMAIL/);
  assert.match(source, /ACTIVE FOCUS/);
  assert.match(source, /REPORT FEEDBACK/);
  assert.doesNotMatch(source, /review_candidates|shadow-runtime|observationJson/);
});
