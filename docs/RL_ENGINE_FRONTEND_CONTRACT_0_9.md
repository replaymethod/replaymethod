# Rocket League engine-to-frontend contract 0.9

Status: handoff contract only. This document does not authorize a frontend
change, customer copy change, public detector activation, Early Access policy
change, release or deployment.

## Material engine change

The fixed 60-lane catalog now contains 60 measuring opportunity contracts and
zero capability-only lanes. Every applicable contract records one explicit
denominator containing firing, non-firing and abstained decisions. All 60 lanes
remain `public: false`, lifecycle `shadow`, and blocked from customer coaching
by the existing quality gate.

`normalized.metadata.shadowEvaluation` therefore reports:

```json
{
  "detectorCount": 60,
  "measuring": 60,
  "capabilityAbstained": 0,
  "publicEligible": 0
}
```

Mode-specific lanes still return `not_applicable` in 1v1. A measuring contract
with zero source opportunities returns `no_signal`; that means only that the
replay contained no event in its defined denominator. It is not a clean bill
of play and must not be rendered as “good”, “passed” or “no mistake”.

## Proxy and abstention semantics

The new contracts separate replay-visible measurements from stronger coaching
truth. Examples:

- `offense.open_net_execution` may fire only an
  `unconverted_low_pressure_shot_proxy`; expert review must establish whether
  the net was genuinely open.
- `challenge.fake_opportunity` can nominate a high-speed exposed commitment for
  review; it cannot prove that a fake was the better counterfactual.
- `boost.small_pad_blindness` can measure full-pad dependency patterns; it
  abstains from claiming that an uncollected small-pad route was reachable.
- rotation, role and trust lanes measure access/geometry proxies and preserve
  intent, communication and alternative-action uncertainty.

Frontend code must never promote a proxy classification into the catalog title
or a causal explanation. The engine-owned `superAnalysis` publication gate is
the only future route to customer-ready findings.

## Customer render gate

The 0.8 render contract is unchanged. Render `primaryFocus`,
`supportingFocuses` or `weeklyPlan` only when all of these are true:

1. `status === "ready"`;
2. `publicationStatus === "customer_eligible"`;
3. `primaryFocus` is non-null;
4. the exact detector activation remains enabled server-side.

Current expected output remains:

```json
{
  "publicationStatus": "private_shadow",
  "status": "quality_gate_blocked",
  "primaryFocus": null,
  "supportingFocuses": [],
  "weeklyPlan": {
    "status": "withheld_until_quality_gate"
  }
}
```

`privateReviewCandidates`, raw detector evaluations and private root-cause
candidates must never be rendered to a customer or converted into generated
copy.

## Engine 0.9 identities

- analyzer: `rocket-league-analyzer@0.9.0`;
- detector bundle: `rocket-league-detectors@0.9.0-shadow`;
- shadow runtime: `rocket-league-shadow-runtime@0.9.0`;
- expanded suite: `rocket-league-expanded-detectors@0.2.0`;
- normalizer: `rocket-league-normalizer@0.8.0`;
- tactical spatial: `rocket-league-tactical-spatial@0.3.0`;
- decision context: `rocket-league-decision-context@0.8.0`;
- decision metadata: `rocket-league-decision-engine-metadata@0.8.0`;
- opportunity contract: `rocket-league-opportunity-contract@0.2.0`;
- mechanics model: `rocket-league-mechanics-model@0.1.0`;
- Super Analysis: `rocket-league-super-analysis@0.2.0`.

No customer response field was removed. The only material consumer change is
that `capability_abstained` is no longer expected from the 60 current lanes;
consumers should retain support for it for backward-compatible historical
reports.
