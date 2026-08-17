# Operations and recovery

## Health surfaces

- `/admin` — funnel and job mission control
- `/admin/analyses/{id}` — submission, versions, failure details, QA override and retry
- `/api/analyses/{publicId}` — private-link status/report payload
- RL engine `/healthz` — parser service health and version

Admin is restricted by the configured owner email header. Public reports are currently high-entropy bearer links; account-bound report authorization is a pre-scale security milestone.

## Common failure handling

| Failure | Expected behavior |
| --- | --- |
| Corrupt/unsupported replay | Block with `invalid_replay`, `empty_replay` or `file_too_large`; do not generate coaching. |
| Missing RL worker | Preserve R2 object and block with `rl_engine_not_configured`. |
| Riot access absent | Preserve request and block with `riot_production_access_required`. |
| Parser/LLM/transient error | Mark retry/failed with internal detail; allow admin retry. |
| Email failure | Report remains available by private link; log failure without losing report. |
| Duplicate retry | Atomic job claim prevents a completed/running job from being claimed again. |
| Intake abuse | Reject after five submissions from the same email within 24 hours; do not upload another object. |

Due retry jobs are woken by report polling and by the worker's scheduled handler. Configure a production cron for that handler when the hosting environment exposes scheduled triggers; polling remains a fail-safe rather than the primary queue runner.

## Backup and restore

Before material schema or hosting changes:

1. Export D1 data.
2. Export or replicate the private R2 bucket.
3. Tag/commit the exact source and migrations.
4. Record configured environment variable names (never values).
5. Test restore into a non-production project.
6. Verify at least one pending and one completed report before DNS changes.

The runtime bootstrap is additive, but a formal deployment should apply the matching migration in `drizzle/`. Never delete existing analysis tables during a deploy.

## Release gate

Run:

```bash
npm ci
npm run lint
npm test
```

Then verify on a preview deployment:

1. landing and all three game pages on mobile and desktop
2. Rocket League `.replay` validation and blocked/success state
3. Riot truthful blocked state
4. private report polling and history
5. admin queue, detail and retry
6. privacy/terms links
7. analytics remains fail-soft

Deploy the checkpoint only after preview passes. Do not alter domain DNS during a normal source release.

## Incident rules

- Disable the affected game adapter rather than returning generic or fabricated coaching.
- Keep raw submissions private and preserved for reprocessing unless deletion is requested.
- Roll back source before attempting a destructive data rollback.
- Rotate a secret immediately if it appears in logs, screenshots or source history.
- Record parser/game version when a patch causes a spike in failures.
