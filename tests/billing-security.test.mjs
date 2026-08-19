import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const checkoutPath = new URL("../app/api/billing/checkout/route.ts", import.meta.url);
const webhookPath = new URL("../app/api/billing/webhook/route.ts", import.meta.url);
const schemaPath = new URL("../db/schema.ts", import.meta.url);
const billingProjectionPath = new URL("../lib/stripe-billing.ts", import.meta.url);
const pricingPath = new URL("../app/components/PricingLadder.tsx", import.meta.url);
const stripePath = new URL("../lib/stripe.ts", import.meta.url);

test("checkout trusts server Price IDs and enforces authenticated same-origin writes", async () => {
  const source = await readFile(checkoutPath, "utf8");
  assert.match(source, /isSameOrigin\(request\)/);
  assert.match(source, /authenticatedPlayer\(request, db\)/);
  assert.match(source, /payload\.adultPurchaser !== true/);
  assert.match(source, /config\.prices\[payload\.plan\]/);
  assert.doesNotMatch(source, /payment_method_types/);
  assert.doesNotMatch(source, /automatic_tax/);
});

test("closed or Riot request-only pricing cannot enter paid Checkout", async () => {
  const source = await readFile(pricingPath, "utf8");
  assert.match(source, /disabled=\{requestOnly \|\| !checkoutOpen \|\| loading !== null\}/);
  assert.match(source, /Official access required first/);
  assert.match(source, /Paid beta opens after detector validation/);
});

test("all displayed paid durations map only to server-owned Stripe Price IDs", async () => {
  const source = await readFile(stripePath, "utf8");
  for (const plan of ["annual", "semiannual", "quarterly", "monthly"]) {
    assert.match(source, new RegExp(`value === "${plan}"`));
    assert.match(source, new RegExp(`prices\\.${plan}`));
  }
  assert.match(source, /Record<PaidPlan, string>/);
});

test("pricing preserves every duration while leading with proof and a low-risk paid start", async () => {
  const source = await readFile(pricingPath, "utf8");
  const orderedPlans = ["annual", "semiannual", "quarterly", "monthly"];
  const positions = orderedPlans.map(plan => source.indexOf(`key: "${plan}"`));
  assert.ok(positions.every(position => position >= 0));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  for (const price of ["$89", "$49", "$27", "$12", "$0"]) assert.match(source, new RegExp(`\\${price}`));
  assert.match(source, /useState<PlanKey>\("free"\)/);
  assert.match(source, /LOWEST-RISK PAID START/);
  assert.match(source, /LOWEST EFFECTIVE RATE/);
  assert.doesNotMatch(source, /MOST POPULAR/i);
});

test("webhooks require Stripe's signature over the raw body", async () => {
  const source = await readFile(webhookPath, "utf8");
  assert.match(source, /headers\.get\("stripe-signature"\)/);
  assert.match(source, /await request\.text\(\)/);
  assert.match(source, /TextEncoder\(\)\.encode\(payload\)\.byteLength/);
  assert.match(source, /constructEventAsync/);
  assert.match(source, /StripeSignatureVerificationError/);
});

test("billing recovery keeps durable customer identity and current Stripe state authoritative", async () => {
  const source = await readFile(billingProjectionPath, "utf8");
  assert.ok(source.indexOf("stripe_customer_id = ? LIMIT 1") < source.indexOf("subscription.metadata?.player_public_id"));
  assert.match(source, /subscriptions\.retrieve\(\(event\.data\.object as Stripe\.Subscription\)\.id\)/);
  assert.match(source, /status = 'processing' AND updated_at <= datetime\('now', '-10 minutes'\)/);
});

test("billing event persistence excludes raw webhook and payment payloads", async () => {
  const source = await readFile(schemaPath, "utf8");
  const eventTable = source.slice(source.indexOf('sqliteTable("billing_events"'), source.indexOf('sqliteTable("analysis_usage"'));
  assert.ok(eventTable.length > 0);
  assert.doesNotMatch(eventTable, /payload|card|payment_method|client_secret/i);
});
