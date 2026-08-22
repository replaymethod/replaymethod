const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);

function cleanHeader(value, maximumLength) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, maximumLength);
}

function encodedHeader(value, maximumLength) {
  return encodeURIComponent(cleanHeader(value, maximumLength));
}

export function resolveRocketLeagueEngine(env = {}) {
  if (!env.RL_ENGINE_URL || !env.RL_ENGINE_TOKEN) {
    return { ok: false, code: "rl_engine_not_configured", reason: "RL_ENGINE_URL or RL_ENGINE_TOKEN is missing." };
  }
  if (String(env.RL_ENGINE_TOKEN).length < 24 || String(env.RL_ENGINE_TOKEN).length > 512) {
    return { ok: false, code: "rl_engine_token_invalid", reason: "RL_ENGINE_TOKEN must contain 24–512 characters." };
  }
  let base;
  try {
    base = new URL(String(env.RL_ENGINE_URL));
  } catch {
    return { ok: false, code: "rl_engine_url_invalid", reason: "RL_ENGINE_URL is not a valid absolute URL." };
  }
  if (base.username || base.password || (base.protocol !== "https:" && !(base.protocol === "http:" && localHosts.has(base.hostname)))) {
    return { ok: false, code: "rl_engine_url_invalid", reason: "RL_ENGINE_URL must use HTTPS, except for an explicit loopback development URL, and cannot contain credentials." };
  }
  const configuredTimeout = Number(env.RL_ENGINE_TIMEOUT_MS || 180_000);
  const timeoutMs = Number.isFinite(configuredTimeout)
    ? Math.min(240_000, Math.max(5_000, Math.round(configuredTimeout)))
    : 180_000;
  return {
    ok: true,
    endpoint: new URL("/v1/analyze/rocket-league", base),
    token: String(env.RL_ENGINE_TOKEN),
    timeoutMs,
  };
}

export async function requestRocketLeagueAnalysis(config, input, body, fetchImpl = fetch) {
  const authorization = `Bearer ${config.token}`;
  const player = encodedHeader(input.playerContext, 160);
  if (player) {
    const statusResponse = await fetchImpl(new URL(`/v1/jobs/${cleanHeader(input.jobPublicId, 32)}`, config.endpoint), {
      method: "GET",
      headers: { Authorization: authorization },
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    if (statusResponse.status !== 404) return statusResponse;
  }

  return fetchImpl(config.endpoint, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/octet-stream",
      "X-Replay-Method-Request": cleanHeader(input.jobPublicId, 32),
      "X-Replay-Method-Player": player,
      "X-Replay-Method-Rank": encodedHeader(input.currentRank, 80),
    },
    body,
    signal: AbortSignal.timeout(config.timeoutMs),
  });
}
