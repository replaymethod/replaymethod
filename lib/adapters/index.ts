import type { AdapterResult, AdapterSuccess, GameId } from "../core/contracts";
import { resolveAuthorizedRiotAccount, resolveRiotIntegration } from "../riot-integration.mjs";
import { requestRocketLeagueAnalysis, resolveRocketLeagueEngine } from "../rl-engine-client.mjs";
import { subsystemEnabled } from "../subsystem-controls.mjs";

export type AnalysisInput = {
  requestId: number;
  publicId: string;
  jobPublicId: string;
  playerId: number | null;
  game: GameId;
  platform: string;
  currentRank: string;
  targetRank: string | null;
  playerContext: string | null;
  evidenceType: string;
  evidenceUrl: string | null;
  fileKey: string | null;
  goal: string;
  notes: string | null;
  providerAccountId: string | null;
  providerRegion: string | null;
  providerConnectionStatus: string | null;
};

export type AdapterEnv = {
  BUCKET: R2Bucket;
  RL_ENGINE_ENABLED?: string;
  RIOT_INGESTION_ENABLED?: string;
  RL_ENGINE_URL?: string;
  RL_ENGINE_TOKEN?: string;
  RL_ENGINE_TIMEOUT_MS?: string;
  RIOT_LEAGUE_API_KEY?: string;
  RIOT_VALORANT_API_KEY?: string;
  RIOT_RSO_CLIENT_ID?: string;
  RIOT_RSO_CLIENT_SECRET?: string;
  RIOT_RSO_REDIRECT_URI?: string;
  RIOT_API_TIMEOUT_MS?: string;
};

function blocked(code: string, publicMessage: string, internalMessage: string, retryable = false): AdapterResult {
  return { kind: "blocked", code, publicMessage, internalMessage, retryable };
}

async function rocketLeagueAdapter(input: AnalysisInput, env: AdapterEnv): Promise<AdapterResult> {
  if (["gameplay_video", "vod_link"].includes(input.evidenceType)) {
    return blocked(
      "rl_video_evidence_queued",
      "Your console video evidence is preserved for the video-analysis beta. Visible moments may be reviewed, but no hidden telemetry will be invented.",
      `Rocket League ${input.platform} video evidence requires the separately calibrated video adapter.`,
    );
  }
  if (!subsystemEnabled(env.RL_ENGINE_ENABLED)) {
    return blocked("rl_engine_disabled", "Your replay is safely stored. Automated replay processing is temporarily paused.", "RL_ENGINE_ENABLED is not true.");
  }
  if (input.evidenceType !== "replay_file" || !input.fileKey) {
    return blocked(
      "rl_binary_replay_required",
      "Automatic Rocket League coaching currently requires the original .replay file.",
      "A link/VOD was submitted; the deterministic replay engine requires a binary replay."
    );
  }
  const engine = resolveRocketLeagueEngine(env);
  if (!engine.ok) {
    return blocked(
      engine.code || "rl_engine_not_configured",
      "Your replay is safely stored. Automated replay processing is awaiting the dedicated analysis worker.",
      engine.reason || "Rocket League engine configuration is invalid."
    );
  }

  const replay = await env.BUCKET.get(input.fileKey);
  if (!replay) return blocked("raw_input_missing", "The uploaded replay could not be found.", `R2 object ${input.fileKey} is missing.`);
  let response: Response;
  try {
    response = await requestRocketLeagueAnalysis(engine, input, replay.body);
  } catch (error) {
    const timedOut = error instanceof DOMException && ["AbortError", "TimeoutError"].includes(error.name);
    return blocked(
      timedOut ? "rl_engine_timeout" : "rl_engine_unreachable",
      "The replay worker is temporarily unavailable. Your original upload is preserved for an automatic retry.",
      timedOut ? `RL engine exceeded the ${engine.timeoutMs}ms request timeout.` : "RL engine network request failed.",
      true,
    );
  }
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
  if (response.status === 401 || response.status === 403) {
    return blocked("rl_engine_auth_failed", "The replay worker configuration needs operator attention. Your upload is preserved.", `RL engine rejected its bearer credential with HTTP ${response.status}.`);
  }
  if (response.status === 408 || response.status === 429 || response.status >= 500) {
    return blocked("rl_engine_unavailable", "The replay worker is temporarily unavailable. Your original upload is preserved for an automatic retry.", `RL engine returned transient HTTP ${response.status}.`, true);
  }
  if (!response.ok) {
    return blocked("rl_engine_contract_failed", "The replay worker configuration needs operator attention. Your upload is preserved.", `RL engine returned unexpected HTTP ${response.status}.`);
  }
  let payload: AdapterSuccess;
  try {
    payload = await response.json() as AdapterSuccess;
  } catch {
    return blocked("rl_engine_contract_failed", "The replay worker returned an unreadable result. Your upload is preserved.", "RL engine success response was not valid JSON.");
  }
  if (payload.kind !== "success" || payload.normalized?.game !== "rocket-league" || !Array.isArray(payload.findings)) {
    return blocked("rl_engine_contract_failed", "The replay worker returned an unsupported result. Your upload is preserved.", "RL engine returned an invalid adapter contract.");
  }
  if (!payload.findings.length) {
    return blocked("insufficient_evidence", "The replay was read, but it did not support a reliable coaching finding.", "RL engine returned a successful normalized replay with no public findings.");
  }
  return payload;
}

function riotAdapter(input: AnalysisInput, env: AdapterEnv): AdapterResult {
  if (!subsystemEnabled(env.RIOT_INGESTION_ENABLED)) {
    return blocked("riot_ingestion_disabled", "Riot match ingestion is not active yet. Your request is preserved and no coaching was invented.", "RIOT_INGESTION_ENABLED is not true.");
  }
  const integration = resolveRiotIntegration(input.game, env);
  if (!integration.ok) {
    return blocked(
      integration.code || "riot_production_access_required",
      `${input.game === "league" ? "League" : "VALORANT"} automation is prepared but waiting for Riot production approval. No coaching will be invented from a public profile link.`,
      integration.reason || "Riot production configuration is incomplete.",
    );
  }
  const account = resolveAuthorizedRiotAccount(input);
  if (!account.ok) {
    return blocked(
      account.code || "riot_account_connection_required",
      "Reconnect through Riot Sign On to authorize your own match history.",
      account.reason || "No authorized Riot account is available for this analysis.",
    );
  }
  return blocked(
    "riot_match_ingestion_not_activated",
    "Official Riot match ingestion is not active in this environment. Your request is preserved and no coaching was invented.",
    `Validated ${input.game} production/RSO configuration and an authorized PUUID for ${account.region}, but the approved match-history data plane is not activated in this source build.`,
  );
}

export async function runGameAdapter(input: AnalysisInput, env: AdapterEnv): Promise<AdapterResult> {
  if (input.game === "rocket-league") return rocketLeagueAdapter(input, env);
  return riotAdapter(input, env);
}
