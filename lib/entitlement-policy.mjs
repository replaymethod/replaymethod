export const ANALYSES_PER_WINDOW = 4;
export const FREE_ANALYSIS_LIMIT = 1;
export const ENTITLEMENT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
export const PAYMENT_GRACE_MS = 3 * 24 * 60 * 60 * 1000;
export const FREE_WINDOW_START = "2026-08-17T00:00:00.000Z";
export const FREE_WINDOW_END = "9999-12-31T23:59:59.999Z";

function timestamp(value) {
  const result = new Date(value).getTime();
  return Number.isFinite(result) ? result : NaN;
}

export function paidEntitlementWindow(subscription, now = new Date()) {
  if (!subscription) return null;
  if (subscription.planKey !== "quarterly" && subscription.planKey !== "monthly") return null;
  const nowMs = timestamp(now);
  const periodStart = timestamp(subscription.currentPeriodStart);
  const periodEnd = timestamp(subscription.currentPeriodEnd);
  if (![nowMs, periodStart, periodEnd].every(Number.isFinite) || nowMs < periodStart || nowMs >= periodEnd) return null;

  const status = String(subscription.status || "");
  const normallyActive = status === "active" || status === "trialing";
  const graceUntil = timestamp(subscription.graceUntil);
  const inPaymentGrace = status === "past_due" && Number.isFinite(graceUntil) && nowMs <= graceUntil;
  if (!normallyActive && !inPaymentGrace) return null;

  const windowNumber = Math.max(0, Math.floor((nowMs - periodStart) / ENTITLEMENT_WINDOW_MS));
  const windowStart = periodStart + windowNumber * ENTITLEMENT_WINDOW_MS;
  const windowEnd = Math.min(windowStart + ENTITLEMENT_WINDOW_MS, periodEnd);
  return {
    accessKind: "paid",
    planKey: subscription.planKey,
    limit: ANALYSES_PER_WINDOW,
    windowStart: new Date(windowStart).toISOString(),
    windowEnd: new Date(windowEnd).toISOString(),
    paymentGrace: inPaymentGrace,
  };
}

export function freeEntitlementWindow() {
  return {
    accessKind: "free",
    planKey: null,
    limit: FREE_ANALYSIS_LIMIT,
    windowStart: FREE_WINDOW_START,
    windowEnd: FREE_WINDOW_END,
    paymentGrace: false,
  };
}

export function entitlementWindow(subscription, now = new Date()) {
  return paidEntitlementWindow(subscription, now) || freeEntitlementWindow();
}
