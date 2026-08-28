# Rocket League engine 0.9 truth matrix — 2026-08-28

Status: code-verified local implementation. This document does not authorize
detector activation, customer coaching, holdout access, release or deployment.

## Current counts

| Measure | Count | Meaning |
| --- | ---: | --- |
| Catalogued | 60 | Fixed entries across nine analysis areas. |
| Measuring contracts | 60 | Every applicable lane owns a firing/non-firing/abstention denominator. |
| Capability-only lanes | 0 | Engine startup fails if any catalog lane lacks a measuring contract. |
| Expert-calibrated | 0 | Independent labels and adjudication have not been completed. |
| Current-version holdout tested | 0 | Existing and new frozen holdouts remain closed. |
| Customer-enabled | 0 | All lanes remain private shadow and `public: false`. |

The 25 pre-0.9 contracts retain the opportunity definitions documented in
[`RL_ENGINE_TRUTH_MATRIX_2026-08-27.md`](RL_ENGINE_TRUTH_MATRIX_2026-08-27.md).
Engine 0.9 adds the 35 contracts below. “Defined” means the code measures a
narrow replay-visible opportunity. It does not mean the catalog title or a
counterfactual coaching conclusion has been expert-validated.

## New 0.9 contracts

| Detector | Opportunity denominator | Measured firing proxy | Preserved boundary |
| --- | --- | --- | --- |
| `boost.low_exposure` | `zero_boost_exposure` | Sustained zero reserve in critical defensive/pressure context | Does not prove boost was required for a better option. |
| `boost.large_pad_detour` | `boost_route_pickup` | Large-pad pickup isolated from ball and layered coverage before opponent continuation | Parser-native `big` pads are normalized to `large`; raw 0–255 boost telemetry is converted to percent. Does not reconstruct the complete route counterfactual. |
| `boost.small_pad_blindness` | `boost_route_pickup` | Full-pad dependency/overfill pattern before opponent continuation | Parser-native `big` pads are normalized to `large`; raw 0–255 boost telemetry is converted to percent. Does not prove an uncollected small pad was reachable. |
| `boost.teammate_starvation` | `boost_route_pickup` | High-reserve large-pad pickup while a teammate has very low reserve | Parser-native `big` pads are normalized to `large`; raw 0–255 boost telemetry is converted to percent. Does not prove route ownership or teammate intent. |
| `rotation.caught_ahead` | `rotation_transition` | Ahead of ball, exposed coverage and opponent continuation | Does not infer offensive assignment. |
| `rotation.cut` | `rotation_transition` | Same-lane intervention despite materially slower access | Does not infer communication or teammate disengagement. |
| `rotation.same_lane` | `rotation_transition` | Compressed same-lane team layer | Does not prove every short overlap is harmful. |
| `rotation.spacing_too_far` | `team_support_decision` | Remote support during exposed opponent turnover | Does not prove intended field coverage was wrong. |
| `rotation.back_post_bypass` | `defensive_positioning` | Near-side defensive entry without goal-side leverage | Does not reconstruct the full available route. |
| `rotation.goal_side_loss` | `defensive_positioning` | Non-goal-side exposed defense before opponent continuation | Does not isolate teammate forcing or challenge assignment. |
| `rotation.backboard_uncovered` | `defensive_positioning` | High defensive ball without a replay-visible backboard/goal-side layer | Does not prove player responsibility or reachability. |
| `challenge.late` | `tactical_challenge` | Beaten challenge after opponent access advantage | Does not isolate timing from aim or fake intent. |
| `challenge.fake_opportunity` | `tactical_challenge` | High-speed exposed commitment nominated for fake review | Does not prove a fake was superior. |
| `challenge.low_probability_aerial` | `tactical_challenge` | Private-development high-tail aerial miss (`closest_approach_distance >= 200`) that concedes access | The 200-unit boundary came from the observed tail of the locked 120-replay development baseline; it is a review-candidate threshold, not a calibrated success probability. |
| `challenge.advantage_state` | `tactical_challenge` | Exposed opponent continuation while protecting a late lead | Does not define the only valid team risk policy. |
| `recovery.demolition_reentry` | `demolition_reentry` | Parser-native `demo` respawn fails to restore bounded defensive access | Both `demo` and legacy `demolition` facts are accepted; ordinary kickoff spawns are excluded and route intent remains unknown. |
| `recovery.play_reentry` | `recovery_reentry` | Slow useful-speed return while distant from play | Speed remains a proxy for the next useful job. |
| `possession.panic_clear` | `possession_clear` | Low/medium-pressure clear immediately returns possession | Does not prove the exact controllable alternative. |
| `possession.touch_frequency` | `possession_sequence` | Dense touch sequence ends in opponent access | Does not prove which touch removed an option. |
| `offense.shot_quality` | `shot_execution` | Low alignment or immediate opponent recovery after shot | Does not estimate calibrated expected goals. |
| `offense.open_net_execution` | `shot_execution` | Unconverted low-pressure shot in opponent third | Explicitly does not prove the net was open. |
| `offense.pass_lane` | `tactical_touch` | Low-pressure non-pass with comparable teammate access before turnover | Does not prove pass reachability or value. |
| `offense.follow_up` | `shot_follow_up` | Shot ends without goal or bounded team follow-up | Does not assign a specific teammate's rebound role. |
| `offense.backboard_use` | `attack_creation` | Long direct center returns possession, nominated for backboard review | Does not prove backboard feasibility or superiority. |
| `defense.near_post_trap` | `defensive_positioning` | Near-side, non-goal-side position before opponent continuation | Does not enumerate every save line. |
| `defense.corner_overcommit` | `defensive_positioning` | Exposed first-access corner commitment before opponent continuation | Does not prove the commitment was avoidable. |
| `defense.goal_line_congestion` | `defensive_positioning` | Close same-lane defenders inside goal-line band | Does not prove distinct shot lanes were uncovered. |
| `defense.shadow_distance` | `defensive_shadow` | Very close/far shadow distance under pressure before opponent access | Does not observe attacker orientation/options completely. |
| `defense.post_save_recovery` | `post_save_recovery` | Save immediately returns opponent pressure | Does not prove a specific clear was available. |
| `kickoff.cheat_distance` | `kickoff_support` | Non-taker boost route misses immediate follow-up proxy | Does not observe the team kickoff call. |
| `kickoff.role_compliance` | `kickoff_support` | Attributed support role leaves immediate outcome gap | Does not infer communication or planned variation. |
| `teamplay.support_angle` | `team_support_decision` | Narrow same-access support geometry | Does not prove a pass or challenge option was removed. |
| `teamplay.role_overlap` | `team_support_decision` | Same-lane, same-access, close team roles | Does not infer complete team role assignment. |
| `teamplay.trust_break` | `team_support_decision` | Intervention overrides faster teammate before turnover | Does not infer trust, communication or intent. |
| `teamplay.transition_balance` | `rotation_transition` | Attack-heavy exposed transition before opponent access | Does not reconstruct the full team transition plan. |

## Required evidence gate

All 60 contracts require rank/mode exposure, timestamps, two independent blind
reviewers and separate adjudication. Proxy firings are candidates for review,
not findings. Precision, recall, false-positive rate, expert agreement,
causality, improvement and rank-up claims remain unavailable until those gates
are completed on the locked corpus and current detector versions.
