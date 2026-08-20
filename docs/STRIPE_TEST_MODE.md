# Stripe test-mode runbook

Replay Method uses Stripe-hosted Checkout for recurring plans, Stripe's Customer Portal for self-service subscription management, and signed webhooks as the source of truth for access. The first completed diagnosis remains free and requires no card.

This milestone is test-mode ready. It does not create live objects, make charges, deploy, or change a Stripe account. Test Products and Prices could not be created locally because no Stripe credentials or Stripe CLI are available in this workspace.

## Environment contract

Configure these as server-only secrets or variables:

- `STRIPE_MODE=test`
- `STRIPE_RESTRICTED_KEY`: a restricted test key (`rk_test_…`)
- `STRIPE_WEBHOOK_SECRET`: the signing secret (`whsec_…`) for `/api/billing/webhook`
- `STRIPE_PRICE_QUARTERLY`: recurring USD Price ID for $17.99 every three months
- `STRIPE_PRICE_MONTHLY`: recurring USD Price ID for $6.99 monthly
- `STRIPE_PRICE_SEMIANNUAL`: recurring USD Price ID for $28.99 every six months
- `PUBLIC_SITE_URL`: canonical HTTPS origin used by Checkout and Portal redirects

The application rejects a live key while `STRIPE_MODE=test` and rejects a test key while `STRIPE_MODE=live`. Do not put any Stripe secret in a `NEXT_PUBLIC_` variable.

## Restricted-key permissions

Grant the minimum test-mode write/read access needed for:

- Checkout Sessions
- Customers
- Customer Portal Sessions
- Subscriptions (read)

The webhook handler also retrieves Subscriptions after lifecycle events. Expand permissions only when a concrete Stripe API error proves one is needed.

## Test Products and Prices

Create one product for Replay Method beta access and three recurring Prices:

1. Monthly: USD 6.99, recurring every month.
2. 3-month cycle: USD 17.99, recurring every three months.
3. 6-month block: USD 28.99, recurring every six months.

Put their `price_…` IDs in the environment variables above. The server accepts
only the `monthly`, `quarterly` and `semiannual` plan keys and maps them to these trusted Price
IDs; the browser never supplies an amount.

## Webhook endpoint

Send these events to `POST /api/billing/webhook`:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

The endpoint verifies the `Stripe-Signature` header against the untouched raw request body. Event IDs are stored for idempotency; raw webhook payloads and payment details are not stored. Failed processing is retryable under the same event ID.

## Customer Portal and recovery settings

In Stripe test mode, enable Customer Portal subscription cancellation at period end and payment-method updates. Keep completed Replay Method reports readable after cancellation.

Enable Stripe Smart Retries in Billing recovery settings and configure customer recovery messaging there. On `invoice.payment_failed`, Replay Method allows a three-day access grace window while Stripe retries payment; later subscription webhooks remain authoritative. Do not implement a separate manual retry schedule in application code.

## Required test-mode verification

Before any separately authorized live-mode activation:

1. Complete both plan checkouts with Stripe test payment methods.
2. Confirm duplicate webhook delivery does not duplicate subscriptions or usage.
3. Confirm invalid signatures are rejected.
4. Confirm Portal cancellation preserves access through the paid period and then removes paid entitlement.
5. Confirm payment failure enters grace, successful recovery clears it, and terminal non-payment removes entitlement.
6. Confirm four completed analyses are allowed per 30-day window, while failures and abstentions release their reservation.
7. Confirm an unverified browser cannot buy for or use another player's paid entitlement by entering their email.

Tax collection is intentionally not enabled. Seller identity and tax registrations must be resolved before enabling Stripe Tax or live billing.
