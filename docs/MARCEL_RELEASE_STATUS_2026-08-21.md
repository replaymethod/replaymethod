# Marcel transformation and calibration release status — 21 August 2026

This file maps the mandatory 17-section execution brief to repository and release evidence. The Founder Manual remains the strategic authority. This is a truth ledger, not a substitute for it.

## 1–7 — Product and Marcel experience

- Implemented a product-first homepage: player problem, native Rocket League replay picker, immediate file response, essential context, consent, secure receipt.
- Rocket League is the default. League and VALORANT are explicitly deferred and do not compete for the first action.
- Removed the homepage game chooser, quiz-like decision preview, pricing ladder, CTA cluster, long report explanation and research-first contribution language.
- The visible loop is `Drop the replay → Reveal one pattern → Play with one rule`.
- Before replay selection, no context, account, payment, marketing or questionnaire fields are visible.
- After a valid `.replay` selection, the form progressively reveals three context fields and two required consent confirmations. Marketing consent is optional.
- The interface reports only truthful states: selected/accepted, securing, secured reference, parser pending, player attribution pending, review pending and coaching gated.
- Existing private reports, history, loading, error, recovery, player-resolution and follow-up states remain available and verified rather than being rebuilt.

## 8–9 — Live-capable calibration and brand separation

- Calibration intake is independently controlled by `RL_CALIBRATION_INTAKE_ENABLED`.
- D1 records replay provenance, consent, declared player/rank/mode, parser state/version, attribution, usability, review state, detector-set version and bounded processing errors.
- R2 remains private and stores the replay under a non-identifying public ID.
- Duplicate replay hashes do not create duplicate records or objects.
- Admin shows corpus total/usable, rank and mode coverage, parser failures, attribution mismatches, consent, review progress and the next cohort to recruit.
- Reviewer workflow uses a stable authenticated identity, owner-approved qualification, active/revoked state and blind initial labels. One reviewer cannot count twice.
- Reviewer absence does not block intake. Public coaching and billing stay independently closed.
- The commercial homepage leads with player self-interest; the dedicated beta route explains calibration operations.

## 10–12 — Research, acquisition and business truth

- Current competitor and behavioral-UX research is recorded in `docs/COMMERCIAL_UX_RESEARCH_2026-08-21.md`; only principles were extracted, not branding.
- Guides, sitemap, robots and keyword-oriented acquisition routes are preserved outside the core homepage journey.
- Google verification can be configured through `GOOGLE_SITE_VERIFICATION`; actual Search Console ownership remains an external owner/account action.
- Private project documentation records FA-tax approval, VAT liability from 2026-08-15, annual VAT, cash accounting, software-publishing activity and the 0 SEK preliminary-tax decision without committing personal identifiers.
- Public Stripe readiness documentation no longer claims Swedish registration is pending. It does not claim that Stripe, consumer, platform or evidence gates are resolved.

## 13 — Rendered acceptance evidence

- Required checked viewports: 1440x900, 430x932, 390x844 and 360x800.
- Landing to native picker: one intentional click.
- Required fields visible before file selection: zero.
- Required data before storage: original replay, exact in-game name, 2v2 rank cohort, email, calibration consent and rights confirmation. Product updates remain optional.
- Dominant first-screen actions: one.
- Primary homepage sections: hero/intake, three-step loop, product-proof illustration, beta truth, compact FAQ.
- Automated responsive checks cover 1440, 1280, 1024, 768, 430, 390 and 360 widths without horizontal overflow or clipped controls.
- Browser console/page errors: zero in the checked public routes.
- Product interaction is available in the first viewport; no explanatory section must be traversed first.

## 14–16 — Release and live verification

- Recoverable checkpoint: `5620812 chore: checkpoint replay beta foundation`.
- Source branch: `agent/premium-conversion-pass`.
- Migration `0013_simple_warbird.sql` is additive and preserves existing data.
- Lint, production build, 122 Node/engine checks, private-report browser states and the commercial responsive matrix pass locally.
- Production release evidence, exact deployed version, live R2/D1/admin smoke and runtime flag confirmation are recorded after deployment; this document must not claim them early.

## 17 — Remaining independent gates

- Real representative replay recruitment can begin once live intake smoke passes.
- Public detector activation remains blocked by representative usable corpus coverage, real parser/attribution outcomes, current-version detector candidates and agreement from two real qualified independent reviewers.
- Payment remains blocked by demonstrated player value/retention plus separate Stripe, consumer, platform and operational readiness. `BILLING_CHECKOUT_ENABLED` remains off.
- Multi-game automation remains blocked by Rocket League proof and authorized Riot ingestion.
- No reviewer, label, result, testimonial or coaching claim is fabricated.
