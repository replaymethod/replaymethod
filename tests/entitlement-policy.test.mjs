import assert from "node:assert/strict";
import test from "node:test";
import {
  ANALYSES_PER_WINDOW,
  entitlementWindow,
  FREE_ANALYSIS_LIMIT,
  paidEntitlementWindow,
} from "../lib/entitlement-policy.mjs";

const start = "2026-08-01T00:00:00.000Z";
const end = "2026-11-01T00:00:00.000Z";

function subscription(overrides = {}) {
  return {
    planKey: "quarterly",
    status: "active",
    currentPeriodStart: start,
    currentPeriodEnd: end,
    graceUntil: null,
    ...overrides,
  };
}

test("creates a four-analysis window anchored to the paid subscription period", () => {
  const window = paidEntitlementWindow(subscription(), new Date("2026-09-15T00:00:00.000Z"));
  assert.equal(window.limit, ANALYSES_PER_WINDOW);
  assert.equal(window.windowStart, "2026-08-31T00:00:00.000Z");
  assert.equal(window.windowEnd, "2026-09-30T00:00:00.000Z");
});

test("cancel-at-period-end does not remove already paid access", () => {
  const window = paidEntitlementWindow(subscription({ cancelAtPeriodEnd: true }), new Date("2026-08-15T00:00:00.000Z"));
  assert.equal(window?.accessKind, "paid");
});

test("past-due access is limited to the explicit recovery grace window", () => {
  const during = paidEntitlementWindow(subscription({ status: "past_due", graceUntil: "2026-08-18T00:00:00.000Z" }), new Date("2026-08-17T00:00:00.000Z"));
  const after = paidEntitlementWindow(subscription({ status: "past_due", graceUntil: "2026-08-18T00:00:00.000Z" }), new Date("2026-08-19T00:00:00.000Z"));
  assert.equal(during?.paymentGrace, true);
  assert.equal(after, null);
});

test("unknown prices and ended subscriptions cannot grant paid access", () => {
  assert.equal(paidEntitlementWindow(subscription({ planKey: "unknown" }), new Date("2026-08-10T00:00:00.000Z")), null);
  assert.equal(paidEntitlementWindow(subscription({ status: "canceled" }), new Date("2026-08-10T00:00:00.000Z")), null);
  assert.equal(paidEntitlementWindow(subscription(), new Date(end)), null);
});

test("falls back to exactly one lifetime beta diagnosis without paid entitlement", () => {
  const window = entitlementWindow(null, new Date("2026-08-10T00:00:00.000Z"));
  assert.equal(window.accessKind, "free");
  assert.equal(window.limit, FREE_ANALYSIS_LIMIT);
  assert.equal(window.planKey, null);
});
