import Stripe from "stripe";

export const STRIPE_API_VERSION = "2026-07-29.dahlia" as const;
export type PaidPlan = "monthly" | "quarterly" | "semiannual";
export type PriceMap = Partial<Record<PaidPlan, string>>;

type StripeEnvironment = {
  STRIPE_MODE?: string;
  STRIPE_RESTRICTED_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_QUARTERLY?: string;
  STRIPE_PRICE_MONTHLY?: string;
  STRIPE_PRICE_SEMIANNUAL?: string;
  STRIPE_AUTOMATIC_TAX_ENABLED?: string;
  STRIPE_TAX_REGISTRATION_CONFIRMED?: string;
  STRIPE_MANAGED_PAYMENTS_ENABLED?: string;
  PUBLIC_SITE_URL?: string;
};

export class BillingConfigurationError extends Error {}

export function isPaidPlan(value: unknown): value is PaidPlan {
  return value === "monthly" || value === "quarterly" || value === "semiannual";
}

export async function stripeEnvironment() {
  const { env } = await import("cloudflare:workers");
  return env as unknown as StripeEnvironment;
}

export async function stripeClient() {
  const env = await stripeEnvironment();
  const key = env.STRIPE_RESTRICTED_KEY?.trim();
  const mode = env.STRIPE_MODE?.trim() || "test";
  if (!key) throw new BillingConfigurationError("Secure checkout is not configured yet.");
  if (mode !== "test" && mode !== "live") throw new BillingConfigurationError("STRIPE_MODE must be test or live.");
  if (mode === "test" && !key.includes("_test_")) throw new BillingConfigurationError("Stripe test mode requires a test API key.");
  if (mode === "live" && !key.includes("_live_")) throw new BillingConfigurationError("Stripe live mode requires a live API key.");
  return new Stripe(key, {
    // The account contract is pinned independently of the SDK's generated
    // literal type so upgrades cannot silently move production semantics.
    apiVersion: STRIPE_API_VERSION as Stripe.LatestApiVersion,
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export async function billingConfiguration() {
  const env = await stripeEnvironment();
  const quarterly = env.STRIPE_PRICE_QUARTERLY?.trim();
  const monthly = env.STRIPE_PRICE_MONTHLY?.trim();
  const semiannual = env.STRIPE_PRICE_SEMIANNUAL?.trim();
  if (!quarterly || !monthly) throw new BillingConfigurationError("Paid plan prices are not configured yet.");
  return {
    stripe: await stripeClient(),
    prices: { monthly, quarterly, ...(semiannual ? { semiannual } : {}) } satisfies PriceMap,
    automaticTaxEnabled: env.STRIPE_AUTOMATIC_TAX_ENABLED?.trim() === "true"
      && env.STRIPE_TAX_REGISTRATION_CONFIRMED?.trim() === "true",
    managedPaymentsEnabled: env.STRIPE_MANAGED_PAYMENTS_ENABLED?.trim() === "true",
    siteUrl: safeSiteUrl(env.PUBLIC_SITE_URL),
    webhookSecret: env.STRIPE_WEBHOOK_SECRET?.trim() || "",
  };
}

function safeSiteUrl(value?: string) {
  const fallback = "https://replaymethod.xyz";
  try {
    const url = new URL(value || fallback);
    if (url.protocol !== "https:" && url.hostname !== "localhost") return fallback;
    return url.origin;
  } catch {
    return fallback;
  }
}

export function planForPrice(priceId: string, prices: PriceMap): PaidPlan | "unknown" {
  if (priceId === prices.quarterly) return "quarterly";
  if (priceId === prices.monthly) return "monthly";
  if (priceId === prices.semiannual) return "semiannual";
  return "unknown";
}

export function stripeObjectId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id || null;
}

export function randomIntegrationIdentifier() {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `replay_method_${Array.from(bytes, byte => alphabet[byte % alphabet.length]).join("")}`;
}
