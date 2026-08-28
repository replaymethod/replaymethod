# Rocket League 0.9 blind-label handbook

Status: private expert-calibration material for
`rocket-league-expert-labels.v10-all-60-context-0.8`. It does not authorize
public coaching, threshold changes, challenge/frozen access or release.

This file extends the complete 25-detector 0.8 handbook at
`docs/RL_LABEL_HANDBOOK_0_8.md`, whose required SHA-256 is
`9b09bc3f4c53fc2c3704f007781bc3f2df6032b220bb6318d106ef0facd401b4`.
The review-plan hash of this file therefore binds the unchanged 0.8 rules plus
the 35 additions below. Stop if that source hash differs.

## Universal rule

Review the anonymized moment before answering. Do not infer hidden model status
from detector name, wording or candidate order. Judge the narrow gameplay
behavior, not whether the entire play was good.

- `present`: the behavior in the review question is visibly established,
  including attribution, context, material consequence and any required
  feasible alternative.
- `absent`: the behavior is visibly not present, or the observed action retains
  the relevant useful option.
- `uncertain`: the moment cannot establish role, pressure, reachability,
  consequence, intent or a feasible alternative. A proxy firing is never by
  itself enough for `present`.

Record timestamp correctness, context correctness and coaching relevance
separately. Never repair the engine by moving the judgment to another moment.

## Engine 0.9 additions

| Detector | `present` | `absent` | `uncertain` |
| --- | --- | --- | --- |
| `boost.low_exposure` | Low/zero reserve visibly removes a material needed option in the critical context. | All required options remain usable or reserve is restored before consequence. | Critical next job or boost-supported alternative is not visible. |
| `boost.large_pad_detour` | The large-pad route visibly abandons useful play access when a materially better route is reachable. | The pickup preserves role/access or creates clear route/denial value. | Complete route feasibility or assigned role is outside the window. |
| `boost.small_pad_blindness` | A reachable small-pad route visibly preserves role better than the chosen full-pad route. | Small pads are used appropriately or no better small-pad route exists. | Pad reachability, respawn state or route intent is unresolved. |
| `boost.teammate_starvation` | The pickup visibly removes a teammate's required reserve/coverage when the subject already has sufficient reserve. | The subject owns the route or teammate has usable alternatives/reserve. | Pad ownership, teammate job or alternatives are unresolved. |
| `rotation.caught_ahead` | The subject is materially trapped ahead of the ball and cannot restore the needed transition layer. | Position is assigned/usable or recoverable coverage remains. | Offensive role or recovery feasibility is unclear. |
| `rotation.cut` | Subject overrides a clearly teammate-owned turn and materially reduces team options. | Subject owns faster/required access or teammate disengages. | Communication, ownership or alternative timing is unclear. |
| `rotation.same_lane` | Same-lane placement duplicates coverage and leaves a material lane/layer empty. | The overlap is brief/functional for pass, bump, kickoff or coverage. | Team intent or the allegedly empty option is not visible. |
| `rotation.spacing_too_far` | Support depth visibly prevents a reachable follow-up/challenge/coverage action. | Distance preserves the correct layer while remaining useful. | Threat forecast or intended coverage is unresolved. |
| `rotation.back_post_bypass` | A reachable back-post route is visibly bypassed and materially reduces defensive options. | Near-post intervention is required or back-post entry is not feasible/better. | Complete route and threat trajectory are unavailable. |
| `rotation.goal_side_loss` | Goal-side leverage is surrendered and materially weakens the next defensive action. | Goal-side/layered coverage is preserved or the line forces safely. | Teammate forcing/assignment or consequence is unclear. |
| `rotation.backboard_uncovered` | A reachable material backboard threat has no appropriate defender. | Threat is absent, unreachable, or covered by a usable layer. | Threat trajectory, reachability or player responsibility is unclear. |
| `challenge.late` | Avoidable timing delay visibly concedes a material opponent option. | Timing appropriately contacts, forces, shadows or preserves coverage. | Aim, fake intent or teammate call cannot be separated from timing. |
| `challenge.fake_opportunity` | A feasible fake clearly forces/preserves more value than the exposed commitment. | Commitment is required or produces equal/better material value. | Opponent reaction and fake counterfactual are not established. |
| `challenge.low_probability_aerial` | Pre-takeoff access is visibly poor, a safer feasible action exists and commitment creates risk. | Aerial access is credible/required or outcome preserves team value. | Contact probability or alternative ground action is unclear. |
| `challenge.advantage_state` | Commitment materially conflicts with score/clock/coverage strategy. | Risk is appropriate for state or safely layered. | Team risk policy or intended strategy is unavailable. |
| `recovery.demolition_reentry` | Demolition respawn route visibly delays a required coverage/access restoration versus a feasible route. | Route restores the correct job promptly. | Spawn choice, assigned job or alternative route is unclear. |
| `recovery.play_reentry` | Avoidable recovery path materially delays the next required live-play job. | Useful role is restored promptly or deliberate delay is correct. | Speed loss is visible but the next job/route is unresolved. |
| `possession.panic_clear` | With visible control space, the clear unnecessarily returns possession when a safer action is feasible. | Clear is forced, safe or creates useful team relief. | Pressure or controllable alternative is unclear. |
| `possession.touch_frequency` | A specific extra touch visibly removes a material next option. | Touch sequence preserves/improves control or each touch is necessary. | Density is high but the harmful touch/alternative is not identifiable. |
| `offense.shot_quality` | Shot is materially lower threat than a visible stronger possession option. | Shot creates credible threat, goal or useful follow-up. | Goal threat or alternative possession value is unresolved. |
| `offense.open_net_execution` | Net is genuinely open, shot is feasible and execution fails the convertible chance. | Net is covered/not feasible or chance is converted. | Low pressure exists but defender reachability/target window is unclear. |
| `offense.pass_lane` | A reachable higher-value pass is visibly available and the chosen touch removes it. | Pass is unavailable/lower value or chosen action retains team value. | Teammate intent, interception risk or reachability is unclear. |
| `offense.follow_up` | Team structure avoidably fails to provide a material rebound/continuation layer. | Goal/follow-up/coverage is appropriately preserved. | Rebound forecast or assigned role is unclear. |
| `offense.backboard_use` | Reachable backboard creation is visibly higher value and is missed. | Direct option is equal/better or backboard is unavailable/covered. | Defender coverage, feasibility or alternative value is unresolved. |
| `defense.near_post_trap` | Near-post position visibly removes a required save/exit line. | Position covers the threat or far-post route is not required/feasible. | Shot line, reachability or teammate cover is unclear. |
| `defense.corner_overcommit` | Avoidable corner commitment visibly opens a material central threat. | Commitment is required or middle remains covered. | Challenge necessity or teammate layer is unclear. |
| `defense.goal_line_congestion` | Defenders duplicate the same goal-line coverage and leave a material line/layer empty. | Players cover distinct threats or proximity is briefly required. | Shot trajectory or role separation is unclear. |
| `defense.shadow_distance` | Gap is materially wrong for visible attacker control and concedes the decisive option. | Distance preserves contest, turn and save options. | Attacker options/orientation or subject braking reach is unclear. |
| `defense.post_save_recovery` | Post-save action avoidably returns pressure when a feasible relief/coverage option exists. | Save creates relief/team access or immediate pressure is unavoidable. | Clear options or teammate reachability are unresolved. |
| `kickoff.cheat_distance` | Non-taker depth visibly misses the material likely follow-up for the assigned role. | Distance covers the intended outcome appropriately. | Kickoff call, assigned role or outcome distribution is unknown. |
| `kickoff.role_compliance` | Attributable kickoff role leaves an avoidable immediate coverage gap. | Role is executed and immediate coverage remains usable. | Team strategy or communication is unavailable. |
| `teamplay.support_angle` | Angle visibly removes a material pass/challenge/coverage option. | Angle creates distinct usable support and coverage. | Teammate intent or reachable option set is unclear. |
| `teamplay.role_overlap` | Players duplicate one role and visibly leave a material responsibility empty. | Roles remain distinct or overlap is briefly required. | Stable role assignment or empty space value is unclear. |
| `teamplay.trust_break` | Subject overrides a clearly covered teammate and materially reduces team options. | Subject owns/needs the intervention or team continuation remains stronger. | Communication, ownership or intent is unclear. |
| `teamplay.transition_balance` | Transition visibly lacks a required attack-defense safety layer. | Team preserves useful attack and defensive coverage. | Complete role assignment or threat/access forecast is unclear. |

For every `uncertain`, record the concrete blocker: attribution, timestamp,
role, pressure, reachability, teammate plan, forced action, unavailable
alternative, score/time strategy, insufficient window or parser telemetry.
`uncertain` preserves evidence; it is not a negative label.
