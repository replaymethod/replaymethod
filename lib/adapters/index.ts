import type { AdapterResult, AdapterSuccess, GameId } from "../core/contracts";

export type AnalysisInput = {
  requestId: number;
  publicId: string;
  playerId: number | null;
  game: GameId;
  currentRank: string;
  targetRank: string | null;
  playerContext: string | null;
  evidenceType: string;
  evidenceUrl: string | null;
  fileKey: string | null;
  goal: string;
  notes: string | null;
};

export type AdapterEnv = {
  BUCKET: R2Bucket;
  RL_ENGINE_URL?: string;
  RL_ENGINE_TOKEN?: string;
  RIOT_LEAGUE_API_KEY?: string;
  RIOT_VALORANT_API_KEY?: string;
  RIOT_RSO_CLIENT_ID?: string;
};

function blocked(code: string, publicMessage: string, internalMessage: string, retryable = false): AdapterResult {
  return { kind: "blocked", code, publicMessage, internalMessage, retryable };
}

async function rocketLeagueAdapter(input: AnalysisInput, env: AdapterEnv): Promise<AdapterResult> {
  if (input.evidenceType !== "replay_file" || !input.fileKey) {
    return blocked(
      "rl_binary_replay_required",
      "Automatic Rocket League coaching currently requires the original .replay file.",
      "A link/VOD was submitted; the deterministic replay engine requires a binary replay."
    );
  }
  if (!env.RL_ENGINE_URL || !env.RL_ENGINE_TOKEN) {
    return blocked(
      "rl_engine_not_configured",
      "Your replay is safely stored. Automated replay processing is awaiting the dedicated analysis worker.",
      "RL_ENGINE_URL or RL_ENGINE_TOKEN is missing. The native boxcars/subtr-actor worker is not configured."
    );
  }

  const replay = await env.BUCKET.get(input.fileKey);
  if (!replay) return blocked("raw_input_missing", "The uploaded replay could not be found.", `R2 object ${input.fileKey} is missing.`);
  const response = await fetch(new URL("/v1/analyze/rocket-league", env.RL_ENGINE_URL), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RL_ENGINE_TOKEN}`,
      "Content-Type": "application/octet-stream",
      "X-Replay-Method-Request": input.publicId,
      "X-Replay-Method-Player": encodeURIComponent(input.playerContext || ""),
      "X-Replay-Method-Rank": encodeURIComponent(input.currentRank)
    },
    body: replay.body
  });
  if (response.status === 422) {
    let detail: Partial<{
      code: string;
      publicMessage: string;
      internalMessage: string;
      retryable: boolean;
    }> = {};
    try { detail = await response.json(); } catch { /* a non-contract worker must still fail safely */ }
    return blocked(
      detail.code || "unsupported_or_invalid_replay",
      detail.publicMessage || "This replay version or file could not be parsed safely.",
      detail.internalMessage || "RL engine returned HTTP 422 without a structured error.",
      detail.retryable === true,
    );
  }
  if (!response.ok) throw new Error(`Rocket League engine failed with HTTP ${response.status}.`);
  const payload = await response.json() as AdapterSuccess;
  if (payload.kind !== "success" || payload.normalized?.game !== "rocket-league" || !payload.findings?.length) {
    throw new Error("Rocket League engine returned an invalid adapter contract.");
  }
  return payload;
}

function riotAdapter(input: AnalysisInput, env: AdapterEnv): AdapterResult {
  const apiKey = input.game === "league" ? env.RIOT_LEAGUE_API_KEY : env.RIOT_VALORANT_API_KEY;
  if (!apiKey) {
    return blocked(
      "riot_production_access_required",
      `${input.game === "league" ? "League" : "VALORANT"} automation is prepared but waiting for Riot production approval. No coaching will be invented from a public profile link.`,
      `${input.game} production API key is missing.`
    );
  }
  if (!env.RIOT_RSO_CLIENT_ID) {
    return blocked(
      "riot_rso_required",
      "Connect Riot Account will activate after Riot Sign On approval.",
      "RIOT_RSO_CLIENT_ID is missing. Player-specific ingestion must be opt-in."
    );
  }
  return blocked(
    "riot_account_connection_required",
    "Reconnect through Riot Sign On to authorize your own match history.",
    "This legacy link submission has no verified Riot PUUID/RSO grant."
  );
}

export async function runGameAdapter(input: AnalysisInput, env: AdapterEnv): Promise<AdapterResult> {
  if (input.game === "rocket-league") return rocketLeagueAdapter(input, env);
  return riotAdapter(input, env);
}
