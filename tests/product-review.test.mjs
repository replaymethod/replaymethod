import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = path => readFile(new URL(path, import.meta.url), "utf8");

test("commercial and UX reviews remain private and structurally separate from RL labels", async () => {
  const [schema, route, page, evidence, config, access] = await Promise.all([
    source("../db/schema.ts"),
    source("../app/api/product-review/route.ts"),
    source("../app/product-review/page.tsx"),
    source("../app/api/admin/product-reviews/[id]/evidence/[index]/route.ts"),
    source("../lib/product-review.ts"),
    source("../app/api/admin/product-reviewers/route.ts"),
  ]);
  assert.match(schema, /product_review_submissions/);
  assert.match(schema, /product_reviewers/);
  assert.doesNotMatch(route, /rlReviewLabels|rl_review_labels/);
  assert.match(route, /requireProductReviewerMutation\(request\)/);
  assert.match(route, /product-review-private\//);
  assert.match(route, /MAX_EVIDENCE_BYTES = 8 \* 1024 \* 1024/);
  assert.match(page, /ensureProductReviewerApplicant/);
  assert.match(page, /Never counted as an RL detector label/);
  assert.match(evidence, /requireSiteAdminApi\(\)/);
  assert.match(evidence, /private, no-store/);
  assert.match(evidence, /X-Content-Type-Options/);
  assert.match(access, /export async function DELETE/);
  assert.match(access, /payload\.confirmation !== "DELETE"/);
  assert.match(access, /bucket\.delete/);
  assert.match(access, /db\.delete\(productReviewSubmissions\)/);
  for (const field of ["purchase_intent", "free_to_paid", "retention", "ai_defensibility", "comprehension", "decisions_clicks", "feedback_speed", "high_octane_simplicity"]) {
    assert.match(config, new RegExp(field));
  }
});
