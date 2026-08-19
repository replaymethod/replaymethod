const gameConfiguration = {
  league: { label: "League", apiKey: "RIOT_LEAGUE_API_KEY" },
  valorant: { label: "VALORANT", apiKey: "RIOT_VALORANT_API_KEY" },
};

const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1"]);
const controlCharacters = /[\u0000-\u001f\u007f]/;

function boundedSecret(value, minimum = 16, maximum = 512) {
  return typeof value === "string" && value.length >= minimum && value.length <= maximum && !controlCharacters.test(value);
}

function safeRedirect(value) {
  try {
    const redirect = new URL(String(value));
    if (redirect.username || redirect.password || redirect.hash) return null;
    if (redirect.protocol === "https:" || (redirect.protocol === "http:" && loopbackHosts.has(redirect.hostname))) return redirect;
  } catch { /* invalid URLs are handled as incomplete RSO configuration */ }
  return null;
}

export function resolveRiotIntegration(game, env = {}) {
  const definition = gameConfiguration[game];
  if (!definition) return { ok: false, code: "riot_game_invalid", reason: "Unsupported Riot game adapter." };
  const apiKey = env[definition.apiKey];
  if (!apiKey) {
    return {
      ok: false,
      code: "riot_production_access_required",
      reason: `${definition.apiKey} is missing. Separate approved production credentials are required for ${definition.label}.`,
    };
  }
  if (!boundedSecret(apiKey)) {
    return { ok: false, code: "riot_production_access_required", reason: `${definition.apiKey} is outside the accepted secret bounds.` };
  }
  if (!env.RIOT_RSO_CLIENT_ID || !env.RIOT_RSO_CLIENT_SECRET || !env.RIOT_RSO_REDIRECT_URI) {
    return {
      ok: false,
      code: "riot_rso_required",
      reason: "RIOT_RSO_CLIENT_ID, RIOT_RSO_CLIENT_SECRET and RIOT_RSO_REDIRECT_URI are required for opt-in player access.",
    };
  }
  const redirect = safeRedirect(env.RIOT_RSO_REDIRECT_URI);
  if (!boundedSecret(env.RIOT_RSO_CLIENT_ID, 3, 256) || !boundedSecret(env.RIOT_RSO_CLIENT_SECRET) || !redirect) {
    return { ok: false, code: "riot_rso_required", reason: "Riot Sign On configuration failed bounded client/secret/redirect validation." };
  }
  const configuredTimeout = Number(env.RIOT_API_TIMEOUT_MS || 10_000);
  const timeoutMs = Number.isFinite(configuredTimeout)
    ? Math.min(30_000, Math.max(3_000, Math.round(configuredTimeout)))
    : 10_000;
  return {
    ok: true,
    game,
    apiKeyName: definition.apiKey,
    apiKey,
    rsoClientId: env.RIOT_RSO_CLIENT_ID,
    rsoClientSecret: env.RIOT_RSO_CLIENT_SECRET,
    rsoRedirectUri: redirect.toString(),
    timeoutMs,
  };
}

export function resolveAuthorizedRiotAccount(input) {
  if (input.providerConnectionStatus !== "connected") {
    return { ok: false, code: "riot_account_connection_required", reason: "No connected Riot provider account is associated with this player and game." };
  }
  const puuid = String(input.providerAccountId || "");
  const region = String(input.providerRegion || "").toLowerCase();
  if (puuid.length < 32 || puuid.length > 128 || controlCharacters.test(puuid)) {
    return { ok: false, code: "riot_account_connection_required", reason: "The connected Riot account is missing a bounded opaque PUUID." };
  }
  if (!/^[a-z0-9-]{2,16}$/.test(region)) {
    return { ok: false, code: "riot_account_connection_required", reason: "The connected Riot account is missing a valid routing region." };
  }
  return { ok: true, puuid, region };
}
