# Rocket League engine-to-frontend contract 0.8

Status: handoff contract only. This document does not authorize a frontend
change, public detector activation, Early Access policy change or release.

## Product boundary

Engine 0.8 separates a technically heavy internal analysis from a deliberately
small customer payload. The frontend must not derive gameplay claims from raw
telemetry or private shadow candidates.

The contract is available at:

```text
normalized.metadata.decisionEngine.superAnalysis
```

Its schema identity is `rocket-league-super-analysis@0.2.0`.

## Render gate

The frontend may render `primaryFocus`, `supportingFocuses` or `weeklyPlan`
only when all of these are true:

1. `status === "ready"`;
2. `publicationStatus === "customer_eligible"`;
3. `primaryFocus` is non-null;
4. the exact detector activation remains enabled server-side.

Today every detector fails that publication gate. The expected output is:

```json
{
  "publicationStatus": "private_shadow",
  "status": "quality_gate_blocked",
  "primaryFocus": null,
  "supportingFocuses": [],
  "weeklyPlan": {
    "status": "withheld_until_quality_gate",
    "reason": "A practice prescription cannot be promoted from an unvalidated shadow association."
  }
}
```

`privateReviewCandidates` is calibration evidence. It must never be rendered
to a customer, converted into AI copy or treated as a finding.

`privateRootCauseCandidates` groups firing observations that occur in a bounded
eight-second sequence. Its relationship is temporal only. The engine labels
each chain `temporal_hypothesis_not_causal_proof`; the frontend must not render
it as a proven root cause until a future alternative-action model validates the
link.

## Future customer-ready focus shape

After the engine gate passes, one focus contains:

```json
{
  "detectorId": "recovery.landing_orientation",
  "detectorVersion": "0.1.0",
  "pillar": "mechanics",
  "verifiedObservation": "Replay-visible kinematic observation",
  "technicalReason": "Why the measured movement changes the next action",
  "causalStatus": "kinematic_association_not_controller_input_attribution",
  "correctionHypothesis": "One bounded change to test",
  "practiceHypothesis": "One short practice block",
  "remeasureMetrics": ["uprightDeviationDegrees", "timeToUsefulSpeed"],
  "evidence": [
    {
      "timestampSeconds": 42.3,
      "frame": 1269,
      "classification": "misaligned_landing_delayed_reentry",
      "contextKey": "..."
    }
  ]
}
```

The customer surface should show one focus, at most two supporting focuses and
three short weekly sessions. The engine owns selection, evidence, practice and
remeasurement fields. The frontend owns only presentation.

## Mechanics profile

`mechanicsProfile` is descriptive telemetry, not a grade. It currently exposes:

- counts of parser-observed dodge, reset, flick, half-flip, speed-flip,
  wall-aerial and wavedash events;
- eligible 30 Hz touch and recovery episode counts;
- observed ground, wall, aerial and transition frame fractions;
- exact mechanics-model schema and private publication status.

Do not turn event counts into “mechanics level”, “motor skill”, rank percentile
or pro comparison. Those require rank-stratified baselines and independent
labels that do not exist yet.

The private cross-replay layer can also emit a
`rocket-league-mechanics-signature-comparison@0.1.0`. It exposes compatible
baseline/follow-up medians and dispersion deltas. It deliberately sets
`improvementClaimEligible: false`: numeric direction alone is not a customer
improvement claim. This comparison must remain private until an eligible focus
defines the expected metric direction and the comparison sample passes the
same-context exposure gates.

## Evidence boundary

The output includes `evidenceBoundaries` with three distinct groups:

- `measured`: replay-visible car/ball kinematics and bounded outcomes;
- `inferredWithAbstention`: control value, recovery cost and decision context;
- `notObserved`: controller inputs, camera, communications, intent, fatigue and
  motor impairment.

The frontend must preserve that distinction. It must never rewrite “kinematic
association” as a known button error or psychological cause.

## Engine 0.8 identities

- analyzer and detector bundle: `0.8.0`;
- shadow runtime: `rocket-league-shadow-runtime@0.8.0`;
- normalizer: `rocket-league-normalizer@0.7.0`;
- mechanics model: `rocket-league-mechanics-model@0.1.0`;
- decision context: `rocket-league-decision-context@0.6.0`;
- decision metadata: `rocket-league-decision-engine-metadata@0.7.0`;
- opportunity contract: `rocket-league-opportunity-contract@0.2.0`;
- Super Analysis: `rocket-league-super-analysis@0.2.0`;
- cross-replay mechanics signature: `rocket-league-mechanics-signature@0.1.0`.
- mechanics signature comparison:
  `rocket-league-mechanics-signature-comparison@0.1.0`.

The 60-lane catalog now contains 25 measuring opportunity contracts and 35
explicit capability abstentions. All remain private shadow lanes.
