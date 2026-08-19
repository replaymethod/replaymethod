import Stripe from "stripe";
import { getDatabase } from "../../../../db";
import { BillingConfigurationError, billingConfiguration } from "../../../../lib/stripe";
import { processBillingEvent } from "../../../../lib/stripe-billing";
import { declaredBodyTooLarge, operationalErrorCode } from "../../../../lib/request-security.mjs";

export const runtime = "edge";
const MAX_WEBHOOK_BYTES = 512 * 1024;

export async function POST(request: Request) {
  if (declaredBodyTooLarge(request, MAX_WEBHOOK_BYTES)) return Response.json({ error: "Webhook payload is too large." }, { status: 413 });
  try {
    const config = await billingConfiguration();
    if (!config.webhookSecret) throw new BillingConfigurationError("Stripe webhook verification is not configured.");
    const signature = request.headers.get("stripe-signature");
    if (!signature) return Response.json({ error: "Missing Stripe signature." }, { status: 400 });
    const payload = await request.text();
    if (new TextEncoder().encode(payload).byteLength > MAX_WEBHOOK_BYTES) {
      return Response.json({ error: "Webhook payload is too large." }, { status: 413 });
    }
    const event = await config.stripe.webhooks.constructEventAsync(
      payload,
      signature,
      config.webhookSecret,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
    const result = await processBillingEvent(await getDatabase(), config.stripe, event, config.prices);
    return Response.json({ received: true, ...result });
  } catch (error) {
    if (error instanceof BillingConfigurationError) {
      console.error("billing webhook configuration error", { code: operationalErrorCode(error) });
      return Response.json({ error: "Webhook endpoint is not configured." }, { status: 503 });
    }
    if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
      return Response.json({ error: "Invalid Stripe signature." }, { status: 400 });
    }
    console.error("billing webhook failed", { code: operationalErrorCode(error) });
    return Response.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
