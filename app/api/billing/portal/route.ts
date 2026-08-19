import { getDatabase } from "../../../../db";
import { authenticatedPlayer, isSameOrigin } from "../../../../lib/player-session";
import { BillingConfigurationError, billingConfiguration } from "../../../../lib/stripe";
import { operationalErrorCode } from "../../../../lib/request-security.mjs";

export const runtime = "edge";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Invalid portal request." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const db = await getDatabase();
    const player = await authenticatedPlayer(request, db);
    if (!player) return Response.json({ error: "Verify your private report link first." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    const customer = await db.prepare("SELECT stripe_customer_id AS stripeCustomerId FROM billing_customers WHERE player_id = ?")
      .bind(player.id).first<{ stripeCustomerId: string }>();
    if (!customer) return Response.json({ error: "No subscription account is connected yet." }, { status: 404, headers: { "Cache-Control": "no-store" } });
    const config = await billingConfiguration();
    const session = await config.stripe.billingPortal.sessions.create({
      customer: customer.stripeCustomerId,
      return_url: `${config.siteUrl}/reports`,
    });
    return Response.json({ url: session.url }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof BillingConfigurationError) {
      return Response.json({ error: error.message }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    console.error("billing portal failed", { code: operationalErrorCode(error) });
    return Response.json({ error: "Subscription management could not be opened. Try again shortly." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
