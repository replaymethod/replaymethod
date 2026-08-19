# Evidence-backed player focus and progress

Replay Method keeps one active coaching focus per player and game. A completed report can add an observation only from a persisted, public analysis finding. Payment controls how often a player may request analyses; it never changes which finding is true or whether evidence is sufficient.

## Data model

- `analysis_findings.detector_id` preserves the stable detector identity supplied by the adapter.
- `player_focuses` stores the current or historical focus, its baseline/latest analysis references, detector identity, evidence-backed metric fields, observation count, and completion reason.
- `player_focus_observations` links a focus to a specific completed analysis and persisted finding. It stores confidence, up to five original evidence items, limitations, recurrence when supplied, and an explicitly selected metric value when one exists.

There is at most one `active` focus for a player/game. Older focuses are retained as completed history instead of being overwritten.

## Conservative progression rules

1. The first supported primary finding creates the focus and baseline observation.
2. A later analysis updates that focus only if it contains the same stable detector ID with non-insufficient confidence and real evidence.
3. If the active detector is absent, the system abstains. Absence is not treated as improvement, completion, or permission to replace the focus.
4. A quantitative baseline/latest/target is used only when the detector explicitly supplies `recommendation.progressMetricKey`, that key matches a finite metric, and the target unit and direction are explicit.
5. A focus completes automatically only after its explicit target is met and the detector-defined minimum observation count is reached.
6. A different supported finding may become the next focus only after that completion. Otherwise the current focus remains active.
7. Reprocessing the same analysis cannot increment progress twice because each focus/analysis observation is unique.

`maintain` is accepted as an observation direction but never auto-completes without an explicit tolerance model. No generic percentage threshold, rank promise, or fabricated target is introduced.

## Shadow-detector boundary

The Rocket League service currently keeps uncalibrated candidates in its private shadow runtime and abstains from returning public findings. This progress layer consumes only `StructuredFinding` objects that already passed the public analysis contract; it does not query review candidates, shadow runs, or private calibration artifacts.

If no public finding supports the current detector, focus persistence returns an abstention and leaves history unchanged.

## Failure isolation

Focus persistence runs after the completed report and usage state are durably saved. A focus-write error is logged but cannot revert the report to a retry state or send an early ready email. The report remains the source of truth for the completed analysis.
