import type Stripe from "stripe";
import { PAYMENT_GRACE_MS } from "./entitlement-policy.mjs";
import { planForPrice, stripeObjectId, type PriceMap } from "./stripe";

function iso(seconds: number | null | undefined) {
  return seconds == null ? null : new Date(seconds * 1000).toISOString();
}

function invoiceSubscriptionId(invoice: Stripe.Invoice) {
  return stripeObjectId(invoice.parent?.subscription_details?.subscription);
}

async function playerForSubscription(db: D1Database, subscription: Stripe.Subscription, customerId: string) {
  // Once a Stripe Customer is mapped, that durable mapping is authoritative.
  // Subscription metadata is only a bootstrap hint for the first signed event.
  const customer = await db.prepare("SELECT player_id AS playerId FROM billing_customers WHERE stripe_customer_id = ? LIMIT 1")
    .bind(customerId).first<{ playerId: number }>();
  if (customer) return Number(customer.playerId);
  const publicId = subscription.metadata?.player_public_id;
  if (publicId) {
    const player = await db.prepare("SELECT id FROM players WHERE public_id = ? LIMIT 1").bind(publicId).first<{ id: number }>();
    if (player) return Number(player.id);
  }
  return null;
}

export async function syncSubscription(
  db: D1Database,
  subscription: Stripe.Subscription,
  prices: PriceMap,
  options: { checkoutSessionId?: string | null; graceUntil?: string | null } = {},
) {
  const item = subscription.items.data[0];
  const customerId = stripeObjectId(subscription.customer);
  const priceId = stripeObjectId(item?.price);
  if (!item || !customerId || !priceId) throw new Error("Stripe subscription is missing its customer, item, or price.");
  const playerId = await playerForSubscription(db, subscription, customerId);
  if (!playerId) throw new Error("Stripe subscription could not be linked to a Replay Method player.");
  const periodStart = iso(item.current_period_start);
  const periodEnd = iso(item.current_period_end);
  if (!periodStart || !periodEnd) throw new Error("Stripe subscription is missing its entitlement period.");

  await db.prepare(`INSERT INTO billing_customers (player_id, stripe_customer_id)
    VALUES (?, ?) ON CONFLICT(player_id) DO UPDATE SET stripe_customer_id = excluded.stripe_customer_id,
    updated_at = CURRENT_TIMESTAMP`).bind(playerId, customerId).run();

  await db.prepare(`INSERT INTO billing_subscriptions (
      player_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, plan_key, status,
      current_period_start, current_period_end, cancel_at_period_end, canceled_at, ended_at,
      grace_until, latest_invoice_id, checkout_session_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(stripe_subscription_id) DO UPDATE SET
      player_id = excluded.player_id, stripe_customer_id = excluded.stripe_customer_id,
      stripe_price_id = excluded.stripe_price_id, plan_key = excluded.plan_key, status = excluded.status,
      current_period_start = excluded.current_period_start, current_period_end = excluded.current_period_end,
      cancel_at_period_end = excluded.cancel_at_period_end, canceled_at = excluded.canceled_at,
      ended_at = excluded.ended_at,
      grace_until = CASE WHEN excluded.status = 'past_due'
        THEN COALESCE(excluded.grace_until, billing_subscriptions.grace_until) ELSE NULL END,
      latest_invoice_id = excluded.latest_invoice_id,
      checkout_session_id = COALESCE(excluded.checkout_session_id, billing_subscriptions.checkout_session_id),
      updated_at = CURRENT_TIMESTAMP`)
    .bind(
      playerId, customerId, subscription.id, priceId, planForPrice(priceId, prices), subscription.status,
      periodStart, periodEnd, subscription.cancel_at_period_end ? 1 : 0, iso(subscription.canceled_at),
      iso(subscription.ended_at), options.graceUntil ?? null, stripeObjectId(subscription.latest_invoice),
      options.checkoutSessionId ?? null,
    ).run();
}

async function beginEvent(db: D1Database, event: Stripe.Event) {
  const inserted = await db.prepare(`INSERT OR IGNORE INTO billing_events (stripe_event_id, type, status)
    VALUES (?, ?, 'processing')`).bind(event.id, event.type).run();
  if (inserted.meta.changes) return true;
  const retried = await db.prepare(`UPDATE billing_events SET status = 'processing', error_message = NULL,
    updated_at = CURRENT_TIMESTAMP WHERE stripe_event_id = ? AND (
      status = 'failed' OR (status = 'processing' AND updated_at <= datetime('now', '-10 minutes'))
    )`).bind(event.id).run();
  return Boolean(retried.meta.changes);
}

export async function processBillingEvent(
  db: D1Database,
  stripe: Stripe,
  event: Stripe.Event,
  prices: PriceMap,
) {
  if (!await beginEvent(db, event)) return { duplicate: true };
  let handled = true;
  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const subscriptionId = stripeObjectId(session.subscription);
      if (!subscriptionId) throw new Error("Completed subscription Checkout Session has no subscription.");
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await syncSubscription(db, subscription, prices, { checkoutSessionId: session.id });
    } else if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      // Webhooks can arrive out of order. Re-read Stripe's current projection
      // instead of allowing an older event snapshot to regress entitlement.
      const subscription = await stripe.subscriptions.retrieve((event.data.object as Stripe.Subscription).id);
      await syncSubscription(db, subscription, prices);
    } else if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoiceSubscriptionId(invoice);
      if (!subscriptionId) {
        handled = false;
      } else {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const graceUntil = event.type === "invoice.payment_failed"
          ? new Date(Date.now() + PAYMENT_GRACE_MS).toISOString()
          : null;
        await syncSubscription(db, subscription, prices, { graceUntil });
      }
    } else {
      handled = false;
    }

    await db.prepare(`UPDATE billing_events SET status = ?, processed_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP WHERE stripe_event_id = ?`)
      .bind(handled ? "processed" : "ignored", event.id).run();
    return { duplicate: false, handled };
  } catch (error) {
    const detail = (error instanceof Error ? error.message : "Unknown webhook processing error").slice(0, 500);
    await db.prepare(`UPDATE billing_events SET status = 'failed', error_message = ?,
      updated_at = CURRENT_TIMESTAMP WHERE stripe_event_id = ?`).bind(detail, event.id).run();
    throw error;
  }
}
