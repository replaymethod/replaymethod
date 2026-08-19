import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const checkoutPath = new URL("../app/api/billing/checkout/route.ts", import.meta.url);
const webhookPath = new URL("../app/api/billing/webhook/route.ts", import.meta.url);
const schemaPath = new URL("../db/schema.ts", import.meta.url);
const billingProjectionPath = new URL("../lib/stripe-billing.ts", import.meta.url);
const pricingPath = new URL("../app/components/PricingLadder.tsx", import.meta.url);

test("checkout trusts server Price IDs and enforces authenticated same-origin writes", async () => {
  const source = await readFile(checkoutPath, "utf8");
  assert.match(source, /isSameOrigin\(request\)/);
  assert.match(source, /authenticatedPlayer\(request, db\)/);
  assert.match(source, /payload\.adultPurchaser !== true/);
  assert.match(source, /config\.prices\[payload\.plan\]/);
  assert.doesNotMatch(source, /payment_method_types/);
  assert.doesNotMatch(source, /automatic_tax/);
});

test("Riot request-only pricing cannot enter paid Checkout", async () => {
  const source = await readFile(pricingPath, "utf8");
  assert.match(source, /disabled=\{requestOnly \|\| loading !== null\}/);
  assert.match(source, /Official access required first/);
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
