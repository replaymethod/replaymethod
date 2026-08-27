# Rocket League engine truth matrix — 2026-08-27

Status: code-verified local audit. This document does not authorize detector
activation, public coaching-policy changes, holdout access or release actions.

## Verified counts

| Measure | Count | Meaning |
| --- | ---: | --- |
| Catalogued | 60 | Versioned catalog entries across all nine analysis areas. |
| Executable lanes | 60 | 20 measuring probes plus 40 explicit capability checks. |
| Measuring telemetry | 20 | Produces replay-derived measurements or candidates. |
| Opportunity contracts | 20 | Every measuring lane counts firing, non-firing and abstained decisions against one denominator. |
| Positive-episode only | 0 | No measuring lane is limited to positive candidates. |
| Capability-abstaining | 40 | No opportunity is classified; status is `capability_abstained`. |
| Expert-calibrated | 0 | No detector has a complete independent two-reviewer label set. |
| Holdout-tested for current frozen detector rules | 0 | The frozen holdout was not opened in this run. |
| Formally customer-enabled | 0 | No activation record passes the public gate. |

All precision, recall, false-positive-rate and detector-correctness confidence
intervals are therefore **unavailable**, not zero. Parser/corpus coverage is not
detector accuracy.

## Evidence and artifact status

- Current code versions: analyzer/detector bundle/shadow runtime `0.7.0`,
  decision context `0.5.0`, tactical spatial `0.2.0`, opportunity contract
  `0.2.0`, Pattern Memory `0.2.0`, batch aggregation `1.3.0`.
- The authorized active review import is still the `0.3.0` three-detector set:
  343 moments from 85 of 120 `calibration_dev` replays. It was not modified.
- The unlabeled `0.5.0` checkpoint is superseded and must not be labeled because
  its boost detectors interpreted raw 0–255 replay units as 0–100 boost.
- The first `0.6.0` review queue is superseded and must not be labeled. Its
  context-only sampler selected 867 1v1 candidates but only 34 3v3 candidates.
- Both `0.6.0` review queues are superseded by the current `0.7.0` set and must
  not be labeled. They are preserved for audit only.
- The private, non-activated `0.7.0` checkpoint covers all 20 opportunity
  detectors: 2,276 candidates and 2,276 moments from 119 `calibration_dev`
  replays, with zero missing or extra IDs. It contains 602 1v1, 961 2v2 and
  713 3v3 candidates; rank cohorts contain 827 gold–platinum, 844
  diamond–champion and 605 grand-champion–SSL candidates. Two blind reviewer
  assignments require 4,552 independent decisions before adjudication.
- Two current calibration runs reproduce fingerprint
  `4064952115b86d701917f0d69eb6d9fd04096b42e49252877a077cd9e4af557a`
  with no opportunity-count or version drift. They contain 66,359 evaluations:
  7,704 firing, 43,572 non-firing and 15,083 abstained.
- Current queue SHA-256:
  `5bd0d565ab44ceb563e931da61636f9de7a65d7cc3eb63acde72ef66fc269b73`.
- Current moments SHA-256:
  `fd725505d7f27ba0a5dec125aca620f2f715b636d1806112633ec32faa098a50`.
- Current independent-review plan SHA-256:
  `4bf7056ba6cc02b5a842daf712dc9995badd5bdc8346f87cda772d823c239ffc`.
- Label handbook SHA-256:
  `ed56cdcd71243ffc02cce6fd94f18ab217472c29fbda1d0f095758aa76a344ef`.
  The plan and both redacted packets carry this fingerprint.
- Reviewer A packet SHA-256:
  `bed3835cfec27d8aaeaff623b2b9ece21390fbafc770879e7e0ab41af1b981f4`.
  Reviewer B packet SHA-256:
  `de29f4c0acfb7a8eb7530e54eff063e51f0f5e4073a81cd7a0da254724df08ec`.
- The private merge tool rejects label leakage, provenance drift, incomplete or
  non-identical coverage and reused reviewer identities before joining blind
  gameplay truth to hidden model decisions.
- The earlier active queue and moments remain hash-locked and preserved:
  queue JSON `493fb7be6747439124e857fa6a744f6354a93853d8d1c330d1998ce06c3b3af3`,
  queue gzip `5610880fa34b1688064139f0fe1fe06ec53152ad6cd729d94a4ada3448d6062d`,
  moments JSON `a53a0eda796edd8534846c921da6e4afc754e81db3da74ef1ea55d19af5628c7`
  and moments gzip `934ca81ea5fca8858a43fe35b64cbfdddb4305934bbc0081438f91fb555c9871`.
- The active local database has four QA label events on two candidates. This is
  neither complete double review nor calibration evidence and is excluded from
  quality claims.

## Telemetry legend

- `FS`: 10 Hz named ball/player frame state: position, rotation, linear/angular
  velocity, boost, distance to ball and clock.
- `D30`: bounded 30 Hz detail frames around subject-linked decision events.
- `EV`: parser-backed event/touch/possession/kickoff timeline and match phases.
- `DC`: versioned decision context: access order, pressure, possession, coverage,
  score/clock and bounded next outcome.
- `ROLE`: reliable team role, rotation lane and defensive-layer inference.
- `COUNTER`: evidence-complete alternative-action/counterfactual model.

## Detector matrix

`Defined` means a firing/non-firing/abstention contract exists. `Missing` means
no gameplay denominator is claimed. Engine 0.7 has no `episode-only` measuring
lane.

### Boost economy

| Detector | v | Exact target | Required telemetry | Opportunity | Current truth / primary confounder and blocker |
| --- | --- | --- | --- | --- | --- |
| `boost.low_exposure` | 0.1.0 | Low reserve in a critical decision window | FS, EV, DC | Missing | Capability only; “critical” must be tied to attributable threat/exit options. |
| `boost.supersonic_waste` | 0.4.0 | Complete boost press with little speed gain while effectively supersonic | FS, DC | Defined: `boost_press_efficiency` | Route, height, contact and pad-denial value remain unresolved; mixed cases abstain. Private and unlabeled. |
| `boost.zero_duration` | 0.2.0 | Complete live-play zero-reserve episode | FS, DC | Defined: `zero_boost_exposure` | Duration is an exposure proxy; it does not prove that a boost-supported option was needed. Private and unlabeled. |
| `boost.overfill` | 0.3.0 | Material normalized boost discarded by a pad pickup | EV, DC | Defined: `boost_overfill` | Corrected from raw 0–255 units; route value and denial value remain confounders. Private and unlabeled. |
| `boost.large_pad_detour` | 0.1.0 | Large-pad route that abandons useful play access | FS, EV, DC, COUNTER | Missing | Needs route alternatives, time-to-play and threat value. |
| `boost.small_pad_blindness` | 0.1.0 | Missed small-pad route that preserves role | FS, pad map, ROLE, COUNTER | Missing | Needs reachable-route alternatives and role preservation. |
| `boost.teammate_starvation` | 0.1.0 | Pad route removes teammate resource/coverage | FS, pad state, ROLE, DC | Missing | Needs teammate intention, respawn timing and alternative pads. |
| `boost.defensive_reserve` | 0.1.0 | Insufficient reserve at a defensive commitment | FS, EV, DC | Defined: `defensive_commitment` | Private reserve/access bands; does not prove a higher-boost route was feasible. |

### Positioning and rotation

| Detector | v | Exact target | Required telemetry | Opportunity | Current truth / primary confounder and blocker |
| --- | --- | --- | --- | --- | --- |
| `rotation.caught_ahead` | 0.1.0 | Subject remains ahead of ball during adverse transition | FS, EV, DC, ROLE | Missing | Offensive role/intent and recovery route can justify position. |
| `rotation.third_overextension` | 0.1.0 | Last layer crosses ahead and loses next access | FS, DC, ROLE | Defined: `defensive_commitment` | Only 37 firing opportunities before review sampling; bounded next access is not full threat proof. |
| `rotation.cut` | 0.1.0 | Subject takes a teammate-owned access turn | FS, EV, DC, ROLE | Missing | Faster access or teammate disengagement can make the cut correct. |
| `rotation.same_lane` | 0.1.0 | Teammates occupy redundant approach lanes | FS, ROLE | Missing | Short overlaps and intentional passing lanes are confounders. |
| `rotation.spacing_too_close` | 0.2.0 | Close same-lane teammate geometry with comparable access | FS, DC, ROLE | Defined: `team_spacing_decision` | Comms and intentional passing/kickoff structures are unresolved; 1v1 is inapplicable. Private and unlabeled. |
| `rotation.spacing_too_far` | 0.1.0 | Support depth removes useful follow-up access | FS, DC, ROLE | Missing | Needs ball-speed/threat forecast and intended coverage. |
| `rotation.back_post_bypass` | 0.1.0 | Defensive route bypasses a safer back-post layer | FS, EV, ROLE, COUNTER | Missing | Near-post intervention can be required; route feasibility needed. |
| `rotation.goal_side_loss` | 0.1.0 | Subject surrenders goal-side leverage | FS, DC, ROLE | Missing | Challenge forcing and teammate cover can justify the line. |
| `rotation.backboard_uncovered` | 0.1.0 | Reachable backboard threat has no assigned cover | FS, DC, ROLE | Missing | Needs threat trajectory, reachability and teammate assignment. |

### Challenges and decisions

| Detector | v | Exact target | Required telemetry | Opportunity | Current truth / primary confounder and blocker |
| --- | --- | --- | --- | --- | --- |
| `challenge.dive` | 0.2.0 | Attributable commitment without assigned access that creates exposed risk | EV, FS, DC, ROLE | Defined: `challenge_dive` | Fake/delay intent, team calls and stronger alternatives remain confounders. Private and unlabeled. |
| `challenge.late` | 0.1.0 | Delayed contest concedes a material option | FS, EV, DC, COUNTER | Missing | Shadow/fake intention and teammate coverage must be modeled. |
| `challenge.fake_opportunity` | 0.1.0 | Missed chance to force without committing | FS, DC, COUNTER | Missing | Requires opponent option/reaction model. |
| `challenge.teammate_coverage` | 0.1.0 | Uncovered challenge followed by opponent access | FS, DC, ROLE | Defined: `challenge_quality` | Goal-side layer is geometric; actual teammate reachability remains a confounder. |
| `challenge.low_probability_aerial` | 0.1.0 | Aerial commitment with poor access probability | FS, D30, DC, COUNTER | Missing | Needs arrival/contact probability and alternative ground action. |
| `challenge.last_player` | 0.1.0 | Defensive last-layer challenge followed by opponent access | FS, DC, ROLE | Defined: `challenge_quality` | Does not alone prove an open net or that the challenge was avoidable. |
| `challenge.advantage_state` | 0.1.0 | Challenge risk conflicts with score/time state | FS, DC, COUNTER | Missing | Risk appetite is policy-sensitive and context-dependent. |
| `challenge.quality` | 0.3.0 | Challenge outcome with access, defensive layer and coverage | EV, FS, DC | Defined: `challenge_quality` | Only beaten/exposed cases fire; whiff without proven risk abstains. Private and unlabeled. |

### Recovery and tempo

| Detector | v | Exact target | Required telemetry | Opportunity | Current truth / primary confounder and blocker |
| --- | --- | --- | --- | --- | --- |
| `recovery.landing_orientation` | 0.1.0 | Landing orientation delays next useful action | D30, DC | Missing | Needs car orientation/contact and useful next job. |
| `recovery.post_aerial_exit` | 0.1.0 | Slow exit after an aerial involvement | D30, EV, DC | Missing | Controlled landing/reset can be correct. |
| `recovery.wall_to_ground` | 0.1.0 | Wall exit loses avoidable tempo | D30, FS, DC | Missing | Needs surface transition and feasible alternative mechanics. |
| `recovery.demolition_reentry` | 0.1.0 | Respawn route fails to restore required coverage | FS, EV, ROLE | Missing | Spawn choice and live team role must be inferred. |
| `recovery.momentum_loss` | 0.2.0 | Post-landing momentum loss that delays the re-entry speed band | D30, FS, DC | Defined: `recovery_reentry` | Deliberate reset/wait and the correct next job remain unresolved. Private and unlabeled. |
| `recovery.play_reentry` | 0.1.0 | Recovery path delays a useful role re-entry | FS, D30, DC, ROLE | Missing | Needs explicit useful-job and route-alternative model. |
| `recovery.reentry_quality` | 0.2.0 | Post-landing time to at least 1000 speed | D30, FS, DC | Defined: `recovery_reentry` | Speed is only a proxy for useful re-entry. Private and unlabeled. |

### Ball control and possession

| Detector | v | Exact target | Required telemetry | Opportunity | Current truth / primary confounder and blocker |
| --- | --- | --- | --- | --- | --- |
| `possession.first_touch` | 0.2.0 | Hard low/medium-pressure first touch followed by opponent control | EV, FS, DC | Defined: `first_touch_quality` | A softer feasible alternative is not proven from next-event ownership; high-pressure relief abstains. Private and unlabeled. |
| `possession.giveaway` | 0.2.0 | Low-pressure subject touch followed by opponent possession | EV, DC | Defined: `possession_giveaway` | Next opponent event can be a contest rather than surrendered control. Private and unlabeled. |
| `possession.panic_clear` | 0.1.0 | Clear under available control feeds opponent | EV, DC, COUNTER | Missing | Needs control-space and alternative-action model. |
| `possession.control_space` | 0.1.0 | Available controllable space is not used | FS, EV, DC, COUNTER | Missing | Reachable opponent pressure and mechanical feasibility needed. |
| `possession.touch_frequency` | 0.1.0 | Extra touch reduces next option value | EV, D30, DC, COUNTER | Missing | Requires option-value model and touch sequence ownership. |
| `possession.wall_control` | 0.1.0 | Wall possession breaks before a useful continuation | FS, EV, DC | Missing | Intent, boost and opponent interception window needed. |
| `possession.first_touch_retention` | 0.2.0 | Comparable first touch followed by team/opponent control | EV, FS, DC | Defined: `first_touch_retention` | High-pressure relief abstains; bounded next-event ownership is not full possession proof. Private and unlabeled. |

### Offense and creation

| Detector | v | Exact target | Required telemetry | Opportunity | Current truth / primary confounder and blocker |
| --- | --- | --- | --- | --- | --- |
| `offense.shot_quality` | 0.1.0 | Low-threat shot ends a stronger possession | EV, FS, DC, COUNTER | Missing | Needs goal probability/threat and alternative possession value. |
| `offense.open_net_execution` | 0.1.0 | Reachable open-net chance is not converted | EV, FS, DC | Missing | Needs defender reachability, target window and shot feasibility. |
| `offense.pass_lane` | 0.1.0 | Higher-value reachable pass lane is missed | FS, DC, ROLE, COUNTER | Missing | Teammate intent and interception risk are unresolved. |
| `offense.center_to_opponent` | 0.2.0 | Center followed by opponent first follow-up | EV, DC | Defined: `offense_center_outcome` | A tactical center can be correct despite opponent first touch. Private and unlabeled. |
| `offense.follow_up` | 0.1.0 | Team structure fails after a shot | EV, FS, DC, ROLE | Missing | Needs rebound forecast and assigned follow-up/cover roles. |
| `offense.backboard_use` | 0.1.0 | Reachable backboard creation option is missed | FS, DC, COUNTER | Missing | Requires defender coverage and shot/pass alternative valuation. |

### Defense and risk control

| Detector | v | Exact target | Required telemetry | Opportunity | Current truth / primary confounder and blocker |
| --- | --- | --- | --- | --- | --- |
| `defense.clear_direction` | 0.2.0 | Defensive clear followed by opponent recycle | EV, DC | Defined: `defensive_clear_outcome` | Immediate opponent touch does not alone prove a poor clear direction. Private and unlabeled. |
| `defense.near_post_trap` | 0.1.0 | Near-post route materially limits save options | FS, DC, ROLE, COUNTER | Missing | Needs shot threat, reachability and teammate goal coverage. |
| `defense.corner_overcommit` | 0.1.0 | Corner commitment opens a central threat | FS, DC, ROLE | Missing | Challenge necessity and teammate layers must be known. |
| `defense.goal_line_congestion` | 0.1.0 | Multiple defenders duplicate goal-line coverage | FS, ROLE | Missing | Temporary stacking and shot trajectory can justify proximity. |
| `defense.shadow_distance` | 0.1.0 | Shadow gap gives attacker a decisive option | FS, DC, COUNTER | Missing | Needs attacker control/options and subject braking/turn radius. |
| `defense.post_save_recovery` | 0.1.0 | Post-save action fails to relieve pressure | EV, D30, DC | Missing | Save quality, follow-up access and available clear options needed. |

### Kickoffs

| Detector | v | Exact target | Required telemetry | Opportunity | Current truth / primary confounder and blocker |
| --- | --- | --- | --- | --- | --- |
| `kickoff.speed` | 0.2.0 | Spawn-band arrival timing for the attributable kickoff job | EV, FS, DC | Defined: `kickoff_speed` | Current spawn timing bands are private corpus heuristics, not expert-calibrated technique truth; middle bands abstain. |
| `kickoff.contact` | 0.2.0 | Subject contact gives immediate team/opponent leverage | EV, DC | Defined: `kickoff_contact` | Neutral/narrow outcomes abstain; team plan and teammate cheat can alter value. Private and unlabeled. |
| `kickoff.cheat_distance` | 0.1.0 | Follow player's cheat depth mismatches likely outcome | FS, EV, DC, ROLE | Missing | Requires role, kickoff call and outcome distribution. |
| `kickoff.role_compliance` | 0.1.0 | Kickoff assignment leaves an immediate coverage gap | FS, EV, ROLE | Missing | Team communication and intentional kickoff strategy unavailable. |

### Team coordination

| Detector | v | Exact target | Required telemetry | Opportunity | Current truth / primary confounder and blocker |
| --- | --- | --- | --- | --- | --- |
| `teamplay.double_commit` | 0.2.0 | Subject and nearest teammate materially approach the same ball action | FS, DC, ROLE | Defined: `team_commitment_decision` | Joint kickoff/pass/goal-line action and comms remain unresolved; 1v1 is inapplicable. Private and unlabeled. |
| `teamplay.support_angle` | 0.1.0 | Support angle removes pass/challenge options | FS, DC, ROLE, COUNTER | Missing | Needs teammate intent and reachable option set. |
| `teamplay.role_overlap` | 0.1.0 | Players duplicate one role and leave another empty | FS, DC, ROLE | Missing | Role inference is not evidence-complete. |
| `teamplay.trust_break` | 0.1.0 | Subject overrides a covered teammate's action | FS, EV, DC, ROLE | Missing | Requires teammate ownership and subject intervention timing. |
| `teamplay.transition_balance` | 0.1.0 | Transition lacks an attack/defense safety layer | FS, DC, ROLE | Missing | Needs stable role assignment and threat/access forecast. |

## Defensible claims now

- Original supported PC replays can be validated, player-attributed and parsed
  into versioned 10 Hz frame state, event timeline and bounded 30 Hz detail.
- All 60 catalog lanes execute privately; 20 measure telemetry and 40 stop at
  explicit capability abstention.
- Twenty private detectors account for firing, non-firing and abstained
  opportunities. Their classifications remain unvalidated coaching hypotheses.
- Pattern Memory can freeze and compare the same private detector/context/
  threshold definition across match windows and can abstain on inadequate
  exposure. It does not prove causation or improvement.

## Claims that remain prohibited

- Any detector precision, recall, false-positive rate or expert agreement.
- “All mistakes”, “AI coach is accurate”, stable player habit, rank benchmark,
  causal coaching impact or rank-up promise.
- Any public detector readiness or correctness claim based only on parser
  success, candidate counts, synthetic tests, local QA or Pattern Memory.
