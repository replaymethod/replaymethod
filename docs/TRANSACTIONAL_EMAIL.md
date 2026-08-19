# Transactional analysis email

Replay Method uses one existing server-side Resend integration for two requested-service messages:

1. Analysis received, with a one-time ownership link.
2. Report ready, only after the database report status is `ready`.

These messages do not depend on waitlist membership or marketing consent. Optional product updates remain a separate, explicit waitlist opt-in.

## Environment contract

- `RESEND_API_KEY`: server-only Resend API key.
- `ANALYSIS_FROM_EMAIL`: verified sender, for example `Replay Method <reports@replaymethod.xyz>`.
- `PUBLIC_SITE_URL`: canonical origin used to rebuild private retry links.

No key, sender, or report URL is placed in browser code. If either email variable is absent, the analysis still succeeds and the delivery row remains `pending` with `provider_not_configured`; no provider call is attempted.

## Delivery state and retries

`email_deliveries` stores one row per analysis and lifecycle kind. It stores no rendered body and no ownership token. States are:

- `pending`: recorded but provider activation is missing, or ready for an initial attempt.
- `sending`: atomically claimed by one worker.
- `accepted`: Resend accepted the request and returned a provider message ID. This does not claim inbox delivery.
- `retry`: a stable report-ready message hit a network, timeout, concurrent-idempotency, rate-limit, or provider-server failure and will be retried.
- `failed`: the retry budget is exhausted or the request cannot succeed safely.

There are at most three provider attempts for report-ready messages, with short exponential backoff. Cloudflare's existing scheduled worker processes due retries. Every provider request includes a stable Resend `Idempotency-Key` (`<kind>/<analysis-public-id>`), which prevents duplicate sends during the retry window. A stale report-ready `sending` lease is recovered only while Resend's 24-hour idempotency window remains usable; an older uncertain attempt is failed rather than risk a duplicate.

The report-ready path independently reads the database status before the initial send. Scheduled retries check it again. Email errors are logged by delivery ID and error code only; they do not roll back or corrupt an analysis.

The received message contains a one-time ownership credential. The plaintext token exists only in the initial provider request and is never stored; only its hash is persisted in `player_claims`. Because rebuilding that email would change the credential and defeat request idempotency, an ambiguous received-email provider failure is not retried later. The submission still succeeds, returns its private browser status link, and records the email failure for support. This is an intentional security/fail-soft boundary, not a claim that the message was delivered.

## Safe testing boundary

No live or test email was sent during implementation because this workspace has no Resend credentials. Do not use invented addresses. With an authorized Resend test key, use Resend's documented test recipients:

- `delivered+analysis-received@resend.dev`
- `delivered+report-ready@resend.dev`
- `bounced+analysis@resend.dev`
- `complained+analysis@resend.dev`
- `suppressed@resend.dev`

The repository tests render both templates locally, verify HTML escaping and plain-text alternatives, and check the readiness, idempotency, retry, and marketing-separation invariants without making network calls.

## Production activation required

**PRODUCTION ACTIVATION REQUIRED — TRANSACTIONAL EMAIL**

Before sending to real players:

- [ ] Verify the sender domain in Resend and publish the required DNS records.
- [ ] Create a least-privilege production API key and store it only in server secrets.
- [ ] Confirm `ANALYSIS_FROM_EMAIL` and that `contact@replaymethod.xyz` receives replies.
- [ ] Confirm the production worker has a scheduled trigger for retry processing.
- [ ] Send received/ready flows only to Resend's safe test recipients first.
- [ ] Exercise accepted, timeout, 429, 5xx, invalid-recipient, bounce, complaint, and suppression scenarios.
- [ ] Decide and implement production bounce/complaint webhook handling and suppression policy before scaled sending.
- [ ] Review final seller/contact footer details after the owner/legal boundary is resolved.
- [ ] Separately authorize production credentials and real recipients.

Provider references: [send email](https://resend.com/docs/api-reference/emails/send-email), [idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys), [safe test addresses](https://resend.com/docs/dashboard/emails/send-test-emails), and [sender-domain verification](https://resend.com/docs/knowledge-base/how-do-I-create-an-email-address-or-sender-in-resend).
