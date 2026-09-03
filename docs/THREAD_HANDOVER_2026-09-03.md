# Replay Method thread handover — 2026-09-03

Purpose: preserve the decisions and current frontend checkpoint from the long
design/product thread before continuing in a fresh chat.

## Current working arrangement

- Frontend work may continue while the separate engine chat completes the
  final pre-review engine version.
- Do not mix frontend work with the engine/reviewer files currently modified
  in the shared worktree.
- The owner begins the human detector review only after the engine chat reports
  `READY FOR REVIEW` and freezes the reviewed detector versions.
- The product demo should eventually be rebuilt from the actual analysis and
  coaching product contract, rather than inventing a separate fake product.

## Approved homepage direction

- Use a restrained ElevenLabs-inspired editorial system: lighter display
  weight, clean typography, generous whitespace and minimal decoration.
- At wide widths, left-align the narrative and place supporting body copy beside
  major headings. At smaller widths, stack the body copy below the heading.
- Animate controls only. Reading surfaces and non-clickable cards stay static.
- Buttons use quiet background, border and color transitions without lifting,
  bouncing or decorative motion.
- Use a normal top header at the beginning of the page. After the hero leaves
  view, a separate compact header slides in from the top. The open directory
  closes on scroll and is not carried down the page.
- Use a left-aligned editorial footer grid rather than centered equal columns.
- The `Why Replay Method?` section was removed because it repeated the hero and
  method sections. Its useful verification sentence was moved into the product
  demo introduction.
- The product-demo label row should read as a quiet editorial rail, not a nested
  dashboard card.

## Current frontend files

- `app/components/CustomerChrome.tsx`
- `app/components/Landing.tsx`
- `app/premium-pass.css`
- `e2e/product-journeys.spec.ts`

These files contain the uncommitted frontend checkpoint described above. The
engine/reviewer modifications in the same working tree belong to the parallel
engine chat and must remain separate.

## Product and engine decisions to preserve

- Rocket League `.replay` files provide structured frame and event data. They
  support analysis of observable mechanical execution as well as game sense.
- The engine may evaluate touch quality, control, shots, aerial movement,
  landings, recoveries, wall transitions, movement, boost and kickoff execution
  when replay evidence is sufficient.
- It must not claim unobserved controller input, camera view, communication,
  intent, fatigue or the exact cause of an ambiguous failure.
- The target is balanced product value and depth across mechanics and game
  sense, approximately 50/50 in coaching usefulness rather than an artificial
  equal detector count.
- Sixty detectors are the current catalog, not a permanent ceiling. New lanes
  should be added only when a coverage audit demonstrates a real, measurable
  gap.
- The engine chat is tasked with acquiring 1,000 additional unique modern
  replays and 1,000 additional unique quality sources, with strict duplicate,
  recency, provenance and leakage controls.
- The full detector review is postponed until that final pre-review engine and
  review packet are complete. The 35-case pilot is quarantined workflow QA and
  must not become calibration evidence.
- Free uses one set of 10 ranked replays. Planned Premium uses recurring sets of
  10–35 replays, Pattern Memory, tailored weekly coaching and comparable
  follow-up measurement. Premium must not imply a lower truth threshold for
  Free.
- Longitudinal validation can run during the paid beta, but baseline,
  detector/context/metric versions, coaching shown and comparable follow-ups
  must be stored correctly from the first customer cohort.

## Next frontend task

Design the real analysis/coaching/Premium product surface while preserving the
engine evidence boundary. Define the information hierarchy and reusable visual
components first; do not hard-code unsupported detector results or coaching
claims. Once the engine contract is frozen and reviewed, adapt the homepage
product demo to the same components and data model.

## Required continuation checks

1. Inspect the actual Git status before editing because engine work may still
   be active in the same worktree.
2. Keep the four frontend files and this handover separate from engine files.
3. Re-check desktop, tablet and 320–390 px mobile layouts.
4. Verify the top-to-compact header transition, menu closing on scroll,
   reduced-motion behavior, keyboard focus and horizontal overflow.
5. Run relevant lint, build and targeted Playwright checks before any later
   release.
6. A pushed branch is a source checkpoint, not proof of production deployment.
