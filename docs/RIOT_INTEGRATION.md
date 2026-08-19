# Riot integration

## Product boundary

Replay Method is an opt-in, post-match training product. It must not provide real-time advice, opponent scouting or an unofficial MMR/ranking system. Player-specific data should be connected through Riot Sign On where required.

League and VALORANT should use separate production applications/keys even though Replay Method presents one user account and can share an approved RSO identity client.

## League

The intended first useful path is:

`RSO/Riot ID → PUUID → ranked match list → match + timeline → normalized events/metrics → multi-match patterns → findings`

Timeline data can support deaths/context, CS/gold/XP tempo, objective participation, vision, recalls and repeat patterns. The engine must go beyond restating the scoreboard and must label inferences as such.

## VALORANT

VALORANT does not provide the same personal/development-key path as League. Production access and opt-in player authorization are critical blockers. The first API-supported engine should focus on claims available in official match data: opening duels, first deaths/kills, round patterns, map/agent splits, economy and supported combat/ability events. Positioning or detailed utility claims that need VOD must not be fabricated from API data.

## Application preparation

Owner-facing application materials should describe:

- a user-initiated, post-match coaching workflow
- one Replay Method account with per-game connections
- explicit opt-in and disconnect/delete controls
- private reports
- free useful functionality
- no real-time competitive advantage
- no opponent scouting
- no hidden/public MMR replacement
- truthful evidence, confidence and limitations

Required credentials must be installed as host secrets, never pasted into chat or committed.

## Checked-in readiness boundary

The shared adapter now keeps three inputs separate:

1. User-submitted Riot ID, role/agent/champion and match/VOD link are request
   context only. They never create or verify a Riot provider account.
2. A connected provider account requires an RSO-authorized opaque PUUID, routing
   region and `connection_status=connected` in `game_accounts`.
3. Official match and timeline payloads enter through a game-specific validator
   before they can become `game-data.v1` or any finding.

League and VALORANT configuration is validated independently. The host must
provide the relevant game API key plus `RIOT_RSO_CLIENT_ID`,
`RIOT_RSO_CLIENT_SECRET`, and an HTTPS `RIOT_RSO_REDIRECT_URI` (loopback HTTP is
accepted only for local development). `RIOT_API_TIMEOUT_MS` is bounded to 3–30
seconds. Configuration presence is not evidence of production approval.

The checked-in contracts carry official payloads as `unknown` until a
game-specific production-schema validator accepts them. No public profile link,
typed Riot ID or VOD URL is converted into PUUID ownership or match history.

## Activation checklist

After Riot grants the required product/RSO access in a separate owner-authorized
run:

1. Register the exact production redirect URI and install each credential in
   the host secret manager.
2. Implement and verify state, PKCE/authorization-code handling, callback error
   containment, token refresh/revocation, disconnect and deletion.
3. Persist only the provider identity and connection lifecycle needed by the
   product; keep access/refresh credentials encrypted outside report data and
   logs.
4. Validate real League match/timeline and VALORANT match payloads against the
   approved API schemas. Add sanitized fixtures only when they come from an
   authorized source.
5. Exercise 401/403, 404, 429, regional routing, timeout and partial-history
   behavior. Apply bounded retries without turning unavailable data into advice.
6. Calibrate game-specific detectors on representative, authorized data before
   enabling findings. API ingestion success alone is not a coaching quality
   gate.

Until those steps and official approval exist, status remains
`EXTERNAL ACCESS REQUIRED — RIOT PRODUCTION / RSO`. The adapter intentionally
returns a safe blocked result and does not call unofficial or fabricated data.

## Official references

- Riot Developer Portal: https://developer.riotgames.com/
- Portal documentation: https://developer.riotgames.com/docs/portal
- League documentation: https://developer.riotgames.com/docs/lol
- VALORANT documentation: https://developer.riotgames.com/docs/valorant
- General policies: https://developer.riotgames.com/policies/general
- Developer terms: https://developer.riotgames.com/terms
