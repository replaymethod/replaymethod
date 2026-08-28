# Rocket League 0.7 blind-label handbook

Status: private expert-calibration material for
`rocket-league-expert-labels.v8-all-contracts-context-0.5`. It does not
authorize public coaching, threshold changes or holdout access.

Review the replay moment before answering. Do not infer the engine's hidden
status from the detector name, question wording or candidate order. Judge only
the narrow behavior in the table, not whether the whole play was good or bad.
Use `uncertain` when the retained evidence cannot establish attribution,
context, consequence or a feasible alternative.

| Detector | `present` example | `absent` example | `uncertain` example |
| --- | --- | --- | --- |
| `boost.zero_duration` | Zero reserve visibly removes a useful challenge, recovery, route or continuation during the episode. | The brief zero-reserve interval does not remove any needed option before reserve or the play resets. | The player remains at zero boost, but the window cannot establish the next required job or a boost-supported alternative. |
| `boost.supersonic_waste` | Boost is held while already effectively supersonic without useful extra speed, route, height or opponent-denial value. | The spend materially accelerates, changes the reachable route, supports an aerial or creates another concrete tactical value. | The speed gain is small, but route intention, pad denial or the next action is outside the retained evidence. |
| `boost.overfill` | A pickup visibly discards substantial normalized reserve and neither preserves route nor denies a needed pad. | The pickup is efficient, required for the route, or materially denies the opponent. | Route intention or the next required job is outside the retained evidence. |
| `boost.defensive_reserve` | A defensive commitment begins with very low reserve and the missing reserve visibly removes a reachable save, challenge or recovery option. | Available reserve supports every needed defensive action in the window. | Low reserve is visible but no feasible higher-reserve alternative can be established. |
| `rotation.third_overextension` | The defensive last layer crosses beyond recoverable coverage and the opponent gains the exposed next action. | The player is not the last layer, remains recoverably goal-side, or the team safely resolves the play. | Layer ownership or recoverability cannot be established from the window. |
| `rotation.spacing_too_close` | The subject duplicates a teammate's ball lane at close range and materially removes layered coverage or reaction time. | The players remain separated by role/lane or the proximity is required for an immediate pass, bump, kickoff or resolved play. | The geometry overlaps, but actual comms, assigned role or the intended continuation cannot be established. |
| `challenge.dive` | The subject makes an avoidable commitment without assigned access and the lost recovery creates material team risk. | The commitment wins/forces the play, is required by access or clock/score, or preserves usable coverage. | The player misses or is bypassed, but fake, delay, teammate call or a feasible safer option is unresolved. |
| `challenge.teammate_coverage` | The challenge removes the actor while no teammate can cover the opponent's next material action. | A usable teammate layer covers the next outcome or the challenge resolves safely. | A teammate is geometrically behind but actual reachability/role is unclear. |
| `challenge.last_player` | The true last defender commits avoidably and creates open-net or uncontested opponent access. | The player is not last, or the last-player challenge safely wins/forces the outcome. | Last-player role is visible but avoidability or resulting threat is not. |
| `challenge.quality` | The player loses assigned access through an avoidable commitment and coverage is materially exposed. | Contact/force is appropriate and preserves useful coverage or recovery. | A whiff occurs but intent, fake, teammate call or team risk cannot be established. |
| `recovery.momentum_loss` | An avoidable landing or path choice destroys useful momentum and materially delays the next required job. | The player preserves useful speed or intentionally slows because the correct job is a controlled wait/reset. | Speed is lost, but the retained window cannot establish whether faster re-entry was feasible or desirable. |
| `recovery.reentry_quality` | Landing/path choice visibly delays the next useful job beyond a feasible faster recovery. | The recovery restores the required job promptly without causing a new overcommit. | Speed is low but the correct job may be a deliberate reset or wait. |
| `possession.first_touch` | In low or moderate pressure, an unnecessarily hard first touch gives the opponent the next controllable action when a softer controllable option is visible. | The team retains control, or the forceful touch is a necessary clear, pass, shot or contest. | The opponent controls next, but touch force, pressure or the stronger controllable alternative is not established. |
| `possession.giveaway` | Under usable control and without forcing pressure, the touch surrenders the next controllable action. | The team retains control or the touch is a necessary clear, pass or contest. | Opponent touches next, but possession/control or a feasible alternative is unclear. |
| `possession.first_touch_retention` | A comparable first touch unnecessarily gives the opponent the next controllable action. | The touch retains team control or deliberately creates a safe next option. | The next event is attributable but does not establish control, or pressure forces relief. |
| `offense.center_to_opponent` | A center predictably feeds the opponent first with no compensating tactical value. | The team reaches the center first or the ball forces a valuable defensive response. | Opponent touches first but teammate intent, bump/demo value or planned pressure is unclear. |
| `defense.clear_direction` | A controllable defensive clear directly sustains opponent pressure when a safer direction is feasible. | The clear produces team relief or the chosen direction is forced and safe. | Opponent recycles immediately, but alternative direction/reachability is not visible. |
| `kickoff.speed` | Relative to the visible spawn and route, avoidable execution delay makes the subject materially late to the kickoff job. | The subject reaches the assigned kickoff job on time with an appropriate route, including a deliberate fake or support role. | The arrival is late by a heuristic time band, but spawn, assigned role, fake or team plan cannot be verified. |
| `kickoff.contact` | Contact execution gives the opponent clear immediate leverage relative to the declared kickoff role. | Contact creates intended team leverage or a controlled neutral outcome. | Team kickoff plan, cheat role or narrow outcome makes contact quality indeterminate. |
| `teamplay.double_commit` | Subject and teammate both materially commit to the same ball without enough layered coverage, creating avoidable team risk. | Only one player materially commits, roles remain layered, or the joint action is a required kickoff/pass/goal-line defense. | Both approach the play, but simultaneous commitment, assigned roles or resulting risk cannot be established. |

For every `uncertain` label, record the concrete blocker: attribution,
timestamp, role, pressure, reachability, teammate plan, forced action,
alternative unavailable, score/time strategy, insufficient window or parser
telemetry. `uncertain` is evidence preservation, not a negative label.

Every candidate also requires independent judgments for timestamp correctness,
context correctness and coaching relevance. A behavior can be `present` while
the timestamp or context is wrong; do not repair the engine's evidence by
silently moving the judgment to another moment.
