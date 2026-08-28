# Rocket League 0.6 blind-label handbook

Review the replay moment before answering. Do not infer the engine's hidden
status from the detector name. Judge the narrow question, not whether the whole
play was good or bad. When the retained window cannot establish the alternative
or attribution, use `uncertain`.

| Detector | `present` example | `absent` example | `uncertain` example |
| --- | --- | --- | --- |
| `boost.overfill` | A pickup visibly discards substantial normalized reserve and neither preserves route nor denies a needed pad. | The pickup is efficient, required for the route, or materially denies the opponent. | Route intention or the next required job is outside the retained evidence. |
| `boost.defensive_reserve` | A defensive commitment begins with very low reserve and the missing reserve visibly removes a reachable save, challenge or recovery option. | Available reserve supports every needed defensive action in the window. | Low reserve is visible but no feasible higher-reserve alternative can be established. |
| `rotation.third_overextension` | The defensive last layer crosses beyond recoverable coverage and the opponent gains the exposed next action. | The player is not the last layer, remains recoverably goal-side, or the team safely resolves the play. | Layer ownership or recoverability cannot be established from the window. |
| `challenge.teammate_coverage` | The challenge removes the actor while no teammate can cover the opponent's next material action. | A usable teammate layer covers the next outcome or the challenge resolves safely. | A teammate is geometrically behind but actual reachability/role is unclear. |
| `challenge.last_player` | The true last defender commits avoidably and creates open-net or uncontested opponent access. | The player is not last, or the last-player challenge safely wins/forces the outcome. | Last-player role is visible but avoidability or resulting threat is not. |
| `challenge.quality` | The player loses assigned access through an avoidable commitment and coverage is materially exposed. | Contact/force is appropriate and preserves useful coverage or recovery. | A whiff occurs but intent, fake, teammate call or team risk cannot be established. |
| `recovery.reentry_quality` | Landing/path choice visibly delays the next useful job beyond a feasible faster recovery. | The recovery restores the required job promptly without causing a new overcommit. | Speed is low but the correct job may be a deliberate reset or wait. |
| `possession.giveaway` | Under usable control and without forcing pressure, the touch surrenders the next controllable action. | The team retains control or the touch is a necessary clear, pass or contest. | Opponent touches next, but possession/control or a feasible alternative is unclear. |
| `possession.first_touch_retention` | A comparable first touch unnecessarily gives the opponent the next controllable action. | The touch retains team control or deliberately creates a safe next option. | The next event is attributable but does not establish control, or pressure forces relief. |
| `offense.center_to_opponent` | A center predictably feeds the opponent first with no compensating tactical value. | The team reaches the center first or the ball forces a valuable defensive response. | Opponent touches first but teammate intent, bump/demo value or planned pressure is unclear. |
| `defense.clear_direction` | A controllable defensive clear directly sustains opponent pressure when a safer direction is feasible. | The clear produces team relief or the chosen direction is forced and safe. | Opponent recycles immediately, but alternative direction/reachability is not visible. |
| `kickoff.contact` | Contact execution gives the opponent clear immediate leverage relative to the declared kickoff role. | Contact creates intended team leverage or a controlled neutral outcome. | Team kickoff plan, cheat role or narrow outcome makes contact quality indeterminate. |

For every `uncertain` label, select or write the concrete blocker: attribution,
timestamp, role, pressure, reachability, teammate plan, forced action,
alternative unavailable, score/time strategy, insufficient window or parser
telemetry.
