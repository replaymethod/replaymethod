# Replay Method beta pricing review

Decision date: 2026-08-20. This is a reversible launch hypothesis, not a promise
that a lower price will automatically increase revenue. Replay Method needs its
own conversion, retention, utilization and contribution data before claiming an
optimum.

## Decision

- Keep the first supported diagnosis free with no card.
- Offer **$6.99 USD monthly** as the lowest-commitment paid continuation.
- Offer **$17.99 USD every three months** ($6.00/month effective), an honest 14%
  saving versus three monthly charges.
- Offer **$28.99 USD every six months** ($4.83/month effective), an honest 31%
  saving versus six monthly charges; retire the twelve-month choice.
- Keep checkout closed until engine cost, tax, platform, restricted-key and
  legal gates pass.

## Evidence used

### Subscription and gaming benchmarks

[RevenueCat's 2026 report](https://www.revenuecat.com/state-of-subscription-apps-2026-business)
covers more than 115,000 subscription apps and $16B in tracked revenue. Gaming is
structurally lower-priced at a $4.99 monthly and $24.99 yearly median. Only 13%
of gaming subscription sales are yearly, while weekly and monthly together
represent 82%. Two-plan paywalls are the most common structure across categories
(41–60%); three-or-more-plan layouts are a minority (6–27%). The report also
shows that price alone does not determine conversion: high-priced apps can
convert better when their value and audience support the price.

Replay Method therefore uses one low-commitment monthly plan and bounded three-
and six-month improvement cycles. It does not copy gaming's weekly-heavy pattern because
the product is meant to verify behavior across matches, not create weekly churn.

### Direct and adjacent competitors

Public prices checked on 2026-08-20:

| Product | Relevant public price | Launch implication |
| --- | --- | --- |
| [ReplayLabs](https://replaylabs.app/) | Free weekly unlock; Starter €3.99/month; Pro €8.99/month; seven-day trial | The closest Rocket League analyzer brackets a sensible paid launch range. |
| [Mobalytics Plus](https://mobalytics.gg/lol/glp/plus) | $7.99 monthly; $21.99/three months; $69.99/year; seven-day trial | A mature multi-game suite can sustain a higher monthly anchor than an unproven single-game beta. |
| [Aimlabs+](https://aimlabs.com/aimlabs) | $10 monthly; $9/month on three months; $7/month on six months | Established training breadth supports higher pricing and longer commitments. |

$6.99 sits above the gaming monthly median but below the mature Mobalytics and
Aimlabs monthly anchors, while remaining between ReplayLabs Starter and Pro. The
longer-cycle prices keep the upfront charge below the retired $49 and $89 commitments.

### Younger-player affordability and consumer protection

[Swedbank and the Swedish savings banks' 2025 research](https://www.swedbank.se/om-oss/samhallsengagemang/veckopengens-dag.html)
reports typical monthly allowances of SEK 300 at age 13, SEK 400 at age 14 and
SEK 500 at age 15. A roughly sixty-krona monthly product is still a meaningful
choice for a young player, but it is materially more plausible than a large
annual prepayment. Public purchase remains restricted to an 18+ purchaser.

[Konsumentverket's guidance on marketing to children](https://www.konsumentverket.se/marknadsratt-foretag/marknadsforing-till-barn-regler-for-foretag/)
requires extra care because children are more vulnerable to commercial pressure.
Replay Method therefore avoids countdowns, fake scarcity, manipulative streaks,
hidden renewals and personalized pressure. The free report demonstrates value
before any paid continuation is offered.

### Price ending and choice architecture

Anderson and Simester's retail field experiments, published as
[Effects of $9 Price Endings on Retail Sales](https://www.kellogg.northwestern.edu/faculty/anderson_e/htm/personalpage_files/Papers/Effects_of_9_Price_Endings_on_Retail_Sales.pdf),
found demand effects from 9-endings in that setting. This is supporting—not
decisive—evidence for the selected .99 endings; a digital coaching subscription may
behave differently. The stronger product-specific reason is transparent market
positioning and a clearly tiered paywall.

## Economics guardrail

At full utilization, $6.99 covers four completed analyses, or about $1.75 gross
revenue per completed analysis before tax, payment fees, support and refunds. To
retain an 80% service gross margin at full use, variable processing cost must be
no more than about $0.35 per completed analysis before those other deductions.
That threshold must be verified from production telemetry before checkout opens.

## Measurement and next decision

Track useful free-report completion, price-view-to-checkout intent, checkout
completion, free-to-paid conversion, monthly retention, three- and six-month renewal,
analyses used, variable cost per completed report, refunds, disputes and support
confusion. Do not add annual pricing until at least one real retention cohort
shows that the long commitment matches delivered value. Evaluate payer lifetime
value and net revenue, not conversion rate alone.
