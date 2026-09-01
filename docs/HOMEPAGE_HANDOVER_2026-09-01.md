# Homepage handover — 2026-09-01

Status: logged for the next frontend session on 2026-09-02. Do not implement
these items automatically. The owner explicitly asked to stop after logging and
safely checkpointing the current work.

## Preserve before continuing

- Preserve the current homepage direction, typography, dark method module,
  light Why module and the existing product-demo visual system.
- Treat the current user-approved homepage copy as the starting authority.
- Keep engine, calibration and blind-review work outside this frontend scope.
- Do not commit, push, publish or deploy further work without fresh permission.

## Tomorrow's work

### 1. Free method and Planned Premium

- Rewrite the complete card set under both tabs. The current wording feels
  uneven and does not yet tell one clean story.
- Give each tab a clear three-step progression with distinct jobs and no
  duplicated promise.
- Make labels, headings and descriptions deliberately comparable in length and
  information density.
- Correct the visual geometry: equal card dimensions, aligned internal anchors,
  balanced whitespace, consistent title baselines and symmetric spacing on
  desktop and mobile.
- Keep the two-tab interaction and the current premium visual tone unless a
  demonstrably stronger solution is found.

### 2. Quick Fix across every common ranked RL mistake

- Audit the muted teaser area in every Quick Fix panel, not only one selected
  fault.
- Decide what that area should do before rewriting it:
  - reveal one more fault-specific and genuinely useful insight;
  - tease a deeper evidence view or longitudinal Premium capability; or
  - combine a concise insight with a clear next action.
- Determine which additional details are useful for each fault rather than
  repeating one generic sentence across the set.
- Do not imply unsupported detector coverage, calibrated certainty, guaranteed
  rank improvement or that Premium receives more truthful detector quality.

### 3. Make the interactive product demo sell the next step

- Review the sequence from fault selection to example result, Quick Fix,
  evidence teaser and CTA.
- Make the free analysis feel like the obvious next action after the demo.
- Tease the planned paid continuation through cadence, memory, tailored
  coaching and follow-up verification—not through "better AI" or hidden truth.
- Evaluate whether the demo needs another useful interaction, clearer evidence,
  a stronger transition into the CTA or more fault-specific depth.
- Preserve the current restrained visual identity and improve it only where the
  change makes comprehension, desire or flow materially stronger.

### 4. Clean up the intake prompt and unify the method controls

- Reconsider the `Ready to find what repeats?` prompt above the ten-file intake.
  The current preference is to remove it rather than preserve a weak extra
  bubble.
- Move any information the prompt was meant to carry into a stronger, more
  informative subtitle so the intake remains clean and straight to the point.
- Write and approve that subtitle before removing the prompt; do not create a
  comprehension gap merely to reduce visual elements.
- Harmonize the color treatment of `How does Replay Method work?` and the
  `Free method` / `Planned Premium` segmented control. They have different
  functions and may retain different structures, but should use one coherent
  solid-blue palette, text contrast and selected/unselected logic rather than
  looking like unrelated bubble systems.

## Questions to resolve before implementation

1. What complete story should the Free tab tell in exactly three steps?
2. What complete story should Planned Premium tell in exactly three different
   steps?
3. What should the muted Quick Fix teaser reveal for each fault?
4. Which Premium capabilities can be teased truthfully before they are live?
5. What single action should the user most want after testing the demo?
6. Where should Free/Premium remain intriguing, and where must the boundary be
   explicit before the user makes a conversion or purchase decision?
7. What exact subtitle can replace the intake prompt without repeating the hero
   or upload heading?
8. Which shared blue values and contrast states make the question label and tab
   selector feel like one system?

## Acceptance checks for the next session

- Copy is reviewed fault by fault and tab by tab, not mechanically duplicated.
- All cards are optically and geometrically symmetric at desktop and mobile
  widths.
- Hover, focus and selected states remain consistent with the current design.
- The question label and method selector share a coherent solid-color language.
- The intake remains immediately understandable if its prompt bubble is removed.
- The demo-to-free CTA path is obvious without adding visual noise.
- Premium teasing is attractive but truthful and remains labelled as planned
  wherever required.
- Relevant lint, build and targeted desktop/mobile Playwright checks pass.
