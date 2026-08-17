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

## Official references

- Riot Developer Portal: https://developer.riotgames.com/
- Portal documentation: https://developer.riotgames.com/docs/portal
- League documentation: https://developer.riotgames.com/docs/lol
- VALORANT documentation: https://developer.riotgames.com/docs/valorant
- General policies: https://developer.riotgames.com/policies/general
- Developer terms: https://developer.riotgames.com/terms
