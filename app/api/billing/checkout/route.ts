import { getDatabase } from "../../../../db";
import { authenticatedPlayer, isSameOrigin } from "../../../../lib/player-session";
import {
  BillingConfigurationError,
  billingConfiguration,
  isPaidPlan,
  randomIntegrationIdentifier,
} from "../../../../lib/stripe";

export const runtime = "edge";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Invalid checkout request." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const payload = await request.json() as { plan?: unknown };
    if (!isPaidPlan(payload.plan)) {
      return Response.json({ error: "Choose a valid Replay Method plan." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }

    const db = await getDatabase();
    const player = await authenticatedPlayer(request, db);
    if (!player) {
      return Response.json({ error: "Verify the private link from your first report before starting a paid plan." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }

    const current = await db.prepare(`SELECT status FROM billing_subscriptions WHERE player_id = ?
      AND status IN ('active', 'trialing', 'past_due', 'unpaid', 'paused', 'incomplete') ORDER BY updated_at DESC LIMIT 1`)
      .bind(player.id).first<{ status: string }>();
    if (current) {
      return Response.json({ error: "You already have a subscription. Manage it from your private report history." }, { status: 409, headers: { "Cache-Control": "no-store" } });
    }

    const config = await billingConfiguration();
    const mapped = await db.prepare("SELECT stripe_customer_id AS stripeCustomerId FROM billing_customers WHERE player_id = ?")
      .bind(player.id).first<{ stripeCustomerId: string }>();
    let customerId = mapped?.stripeCustomerId;
    if (!customerId) {
      const customer = await config.stripe.customers.create({
        email: player.email,
        metadata: { player_public_id: player.publicId },
      }, { idempotencyKey: `replay_method_customer_${player.publicId}` });
      customerId = customer.id;
      await db.prepare(`INSERT INTO billing_customers (player_id, stripe_customer_id) VALUES (?, ?)
        ON CONFLICT(player_id) DO UPDATE SET stripe_customer_id = excluded.stripe_customer_id,
        updated_at = CURRENT_TIMESTAMP`).bind(player.id, customerId).run();
    }

    const bucket = Math.floor(Date.now() / 300_000);
    const session = await config.stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: player.publicId,
      line_items: [{ price: config.prices[payload.plan], quantity: 1 }],
      success_url: `${config.siteUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.siteUrl}/?checkout=canceled#pricing`,
      metadata: { player_public_id: player.publicId, plan_key: payload.plan },
      subscription_data: { metadata: { player_public_id: player.publicId, plan_key: payload.plan } },
      integration_identifier: randomIntegrationIdentifier(),
    }, { idempotencyKey: `replay_method_checkout_${player.publicId}_${payload.plan}_${bucket}` });

    if (!session.url) throw new Error("Stripe did not return a Checkout URL.");
    return Response.json({ url: session.url }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof BillingConfigurationError) {
      return Response.json({ error: error.message }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    console.error("billing checkout failed", error);
    return Response.json({ error: "Secure checkout could not be opened. Try again shortly." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
