# Release readiness — 20 August 2026

## Approved public release

The approved release is a public marketing site and free beta waitlist. It is suitable for ads whose conversion goal is a beta signup. It must not be advertised as a working paid coach or as accepting Rocket League files while the production quality gate is closed.

Production defaults remain fail-closed:

- `RL_ENGINE_ENABLED=false`
- `RL_PUBLIC_DETECTORS_ENABLED=false`
- `BILLING_CHECKOUT_ENABLED=false`
- `RIOT_INGESTION_ENABLED=false`
- `BACKGROUND_PROCESSING_ENABLED=false`

The landing page reads the replay-engine switch at runtime. When closed, every Rocket League CTA leads to `#join-beta`, the upload UI is absent, and the analysis API returns `503` before storing a replay. Checkout remains unavailable independently.

## Billing foundation

The live Stripe account initially contained one Replay Method Membership product
and four legacy recurring USD prices: $12 monthly, $27 every three months, $49
every six months, and $89 every twelve months. They are no longer accepted by the
application after the 2026-08-20 pricing review. The approved public beta prices
are $6.99 monthly, $17.99 every three months and $28.99 every six months. The live webhook endpoint is
configured for checkout completion, subscription lifecycle, paid invoices and
failed invoices. The signing secret is stored as a Sites secret. Checkout remains
closed until restricted-key, tax, platform and cost gates pass.

Checkout must remain closed until all of these are complete:

1. Store a least-privilege restricted live key as `STRIPE_RESTRICTED_KEY`.
2. Configure and test the Stripe Customer Portal, including cancellation at period end.
3. Confirm Swedish/EU VAT registrations, customer-location collection, product tax code and invoice treatment with a qualified adviser; then decide whether to enable automatic tax.
4. Display complete trader/address/tax details and the final withdrawal flow before payment.
5. Clear commercial platform and intellectual-property use for paid Rocket League functionality.
6. Pass a real replay end-to-end test and the public detector quality gate.

Do not substitute a broad secret key for the restricted key and do not enable checkout merely because prices exist.

## Identity, entitlements and privacy

Production has passwordless report ownership with one-time claims and a 90-day essential HttpOnly session. Billing entitlements and the free-proof allowance are server-owned and idempotent. Verified users can download a JSON export or permanently delete their account from `/reports`. Deletion:

- requires same-origin authentication and the exact confirmation phrase;
- refuses while paid rights remain active;
- deletes stored replay objects before database records;
- removes reports, training data, identity, sessions, billing mappings and waitlist rows;
- clears the session cookie.

Operational security and de-identified aggregate detector-quality records are not exported as personal account data. Manual privacy support remains available at `contact@replaymethod.xyz`.

## Consumer, tax and platform boundaries

The service and privacy notices now distinguish the current free waitlist from a future paid contract, disclose recurring totals and allowances, require an adult purchaser, describe cancellation and EU withdrawal rights, preserve mandatory refund rights, and disclose storage/advertising-cookie behavior.

Primary references reviewed:

- EU consumer withdrawal guidance: https://europa.eu/youreurope/citizens/consumers/shopping/returns/index_en.htm
- EU distance-selling obligations: https://europa.eu/youreurope/business/selling-in-eu/selling-goods-services/ecommerce-distance-selling/index_en.htm
- Konsumentverket subscription withdrawal guidance: https://www.konsumentverket.se/varor-och-tjanster/angerratt-abonnemang-tv-mobil-internet/
- Skatteverket cross-border service VAT guidance: https://www.skatteverket.se/foretag/moms/saljavarorochtjanster/forsaljningtillandraeulander/saljatjanstertillandraeulander.4.76a43be412206334b89800010696.html
- Epic fan-content policy: https://legal.epicgames.com/epicgames/fan-art-policy
- Epic terms: https://legal.epicgames.com/epicgames/tos

Important: Epic's fan-content policy describes non-commercial fan content. It is not treated here as permission for a paid Replay Method service. Paid Rocket League functionality stays closed until separate clearance is documented.

## Ads allowed now

Allowed claims:

- “Join the Rocket League replay beta.”
- “See the product vision and get first access.”
- “No card, no upload today, unsubscribe anytime.”
- “Evidence-gated coaching in development; no rank guarantee.”

Do not claim:

- that replay uploads or automated reports are currently available;
- that a detector has passed public validation;
- guaranteed rank, MMR, win-rate or performance improvement;
- publisher endorsement or official integration;
- paid access, a free completed diagnosis, or immediate turnaround while the switches are off.

## Monitoring, capacity and rollback

Monitor waitlist POST error rates, signup conversion, page errors, D1 usage and Sites deployment health. The existing Render engine is on a free instance and may cold-start for 50 seconds or more; it is not approved for ad-scale replay intake. Upgrade capacity only after explicit spend approval and after real-replay validation.

Rollback order:

1. Keep or set all subsystem switches to `false`.
2. Redeploy the previous known-good Sites version.
3. Verify `/`, `/privacy`, `/terms`, `/api/waitlist` and the closed `/api/analyses` boundary.
4. Preserve the failed version and logs for incident review; do not delete production data during rollback.

The Stripe webhook may remain registered while checkout is closed. No payment test is valid until a restricted key, portal, tax treatment and paid-launch approval are all complete.
