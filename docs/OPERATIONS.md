# Operations and recovery

## Health surfaces

- `/admin` — funnel and job mission control
- `/admin/analyses/{id}` — submission, versions, failure details, QA override and retry
- `/api/analyses/{publicId}` — private-link status/report payload
- RL engine `/livez` — process liveness only
- RL engine `/healthz` — authenticated-service configuration readiness, parser/engine versions and concurrency

Admin requires Sites sign-in and the configured owner identity. Set `ADMIN_USER_ID` to the stable `oai-authenticated-user-id` value when available; it takes precedence over the `ADMIN_EMAIL` fallback on every admin page and API. Public reports are currently high-entropy bearer links; account-bound report authorization is a pre-scale security milestone. Private routes are served with `no-store` and `no-referrer` headers, and report bearer IDs are not reused as replay-object or engine-request identifiers.

## Common failure handling

| Failure | Expected behavior |
| --- | --- |
| Corrupt/unsupported replay | Block with `invalid_replay`, `empty_replay` or `file_too_large`; do not generate coaching. |
| Missing RL worker | Preserve R2 object and block with `rl_engine_not_configured`. |
| RL worker timeout/network/capacity | Preserve R2 object, keep the analysis pollable, and persist a due retry time. |
| RL worker auth/contract failure | Preserve R2 object and stop automatic retry until configuration is corrected. |
| Riot access absent | Preserve request and block with `riot_production_access_required`. |
| Parser/LLM/transient error | Mark retry/failed with internal detail; allow admin retry. |
| Email failure | Report remains available by private link; log failure without losing report. |
| Duplicate retry | Atomic job claim prevents a completed/running job from being claimed again. |
| Intake abuse | Require same-origin browser writes and reject after five submissions from the same email within 24 hours before uploading another object. Configure an edge request-rate rule before broad public promotion; application limits do not replace network-level abuse controls. |

Due retry jobs are woken by report polling and by the worker's scheduled handler. The scheduled handler also reclaims interrupted running leases after ten minutes, fails exhausted leases while releasing their reservations, and starts queued jobs that missed their original background dispatch. Configure a production cron for that handler when the hosting environment exposes scheduled triggers; polling remains a fail-safe rather than the primary queue runner.

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

### Rocket League worker release gate

Before a later explicit worker deployment:

1. Build the checked-in `services/rl-engine/Dockerfile` from a clean source SHA.
2. Scan the image and confirm it runs as the non-root `node` user.
3. Inject `RL_ENGINE_TOKEN` through the host secret manager; use the same value
   for the web binding without logging either value.
4. Keep `RL_ENGINE_MAX_CONCURRENCY=1` until representative load and memory
   measurements justify a change.
5. Confirm `/livez` is 200 and `/healthz` is 200 with the expected source
   versions. A missing/invalid token must make readiness return 503.
6. Exercise 401, 400 metadata validation, 415 content type, 422 invalid replay,
   503 capacity, and web-client timeout/retry behavior in preview.
7. Confirm SIGTERM drains in-flight work and a due retry remains claimable after
   service restart.
8. Do not enable a public detector. Deployment readiness and coaching quality
   promotion are separate gates.

## Incident rules

- Disable the affected game adapter rather than returning generic or fabricated coaching.
- Keep raw submissions private and preserved for reprocessing unless deletion is requested.
- Roll back source before attempting a destructive data rollback.
- Rotate a secret immediately if it appears in logs, screenshots or source history.
- Record parser/game version when a patch causes a spike in failures.
