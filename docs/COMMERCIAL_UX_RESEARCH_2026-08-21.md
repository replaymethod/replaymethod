# Commercial UX calibration — 2026-08-21

This is a focused release input, not a visual-copy exercise. Public first-party
product pages and primary research were checked immediately before the Marcel
release work.

## Current market signals

- [trophi.ai Rocket League](https://www.trophi.ai/rocket-league-coaching) opens
  with the player problem (“stop guessing”), a rank-up outcome and a free
  action. Its useful pattern is problem → action → feedback. Replay Method must
  not copy its AI or result claims because our detector gate is not yet passed.
- [Mobalytics](https://mobalytics.gg/) communicates “improve and climb” before
  feature detail, then makes the loop visible across before/during/after/between
  games. Replay Method should express its own loop in three short states and
  keep the upload in the first viewport.
- [Tracker Network](https://tracker.gg/apps) makes each surface task-specific:
  in-game stats, mobile tracking and streaming are separate. Replay Method
  should similarly keep calibration operations away from the main player
  action.
- [Leetify](https://leetify.com/) leads with automatic match reports, personal
  bests and immediate feedback. The useful mechanism is fast personal
  recognition; the risk is turning the product into a broad rating dashboard.
- [OP.GG Desktop](https://op.gg/desktop/en) reduces setup through automatic game
  detection and one-click launch. Replay Method cannot provide automatic replay
  watching yet, so the honest short path is one direct native file-picker
  action.
- [Metafy](https://metafy.gg/discover) leads with player seriousness and direct
  access to a chosen human expert. Replay Method’s equivalent trust mechanism is
  not fake authority; it is stable qualified reviewer identity and visible
  evidence provenance.
- Blitz was checked but its public page blocked automated retrieval. Existing
  first-party references remain in COMPETITIVE_INTELLIGENCE.md; no new claim
  was inferred from an inaccessible page.

## Research constraints applied

- Devine and Otto, Cognition (2022),
  [Information about task progress modulates cognitive demand avoidance](https://pubmed.ncbi.nlm.nih.gov/35349871/):
  truthful progress information can make demanding tasks easier to continue.
  The replay flow therefore shows a short File → Context → Secured sequence.
- Katzir et al., Cognition (2020),
  [Cognitive performance is enhanced if one knows when the task will end](https://pubmed.ncbi.nlm.nih.gov/31978813/):
  a visible endpoint can reduce fatigue and improve effort allocation. The
  intake exposes exactly one remaining context step after file selection.
- [The impact of progress indicators on task completion](https://pubmed.ncbi.nlm.nih.gov/20676386/)
  reports that slow-looking early progress can increase abandonment. Replay
  Method must not fabricate percentage progress for parsing; it names real
  states instead.
- Szollosi et al.,
  [Nudges for people who think](https://pubmed.ncbi.nlm.nih.gov/39753819/):
  choice architecture should align the factual and motivational representation,
  not treat users as incapable. The player benefit leads; consent and
  calibration detail appear where factually required.

## Release decisions

1. Rocket League is the default product path; no game chooser precedes it.
2. The native replay picker is the only dominant first-view action.
3. “Contribute” and research identity are removed from the primary player CTA.
4. Local file acceptance, secure storage, parsing, attribution, mode
   verification, review and coaching are separate truthful states.
5. Pricing and expansion do not compete with the first replay action.
6. Technical validation language is retained in a dedicated beta route and
   owner/reviewer operations, not used as the homepage’s main persuasion.
7. No competitor wording, visual identity, testimonial or unverified capability
   is copied.
