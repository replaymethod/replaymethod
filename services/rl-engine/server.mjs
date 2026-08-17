import { createServer as createHttpServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";
import { analyzeReplay } from "./analyzer.mjs";
import { inspectReplay, ReplayInputError } from "./parser.mjs";

export const MAX_REPLAY_BYTES = 16 * 1024 * 1024;
export const ENGINE_VERSION = "rl-engine.v1";
export const PARSER_VERSION = "subtr-actor-1.2.0";

function json(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(body);
}

function authorized(request, token) {
  if (!token) return false;
  const supplied = request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
  const left = Buffer.from(supplied);
  const right = Buffer.from(token);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function readBody(request) {
  const declared = Number(request.headers["content-length"] ?? 0);
  if (declared > MAX_REPLAY_BYTES) {
    throw new ReplayInputError("file_too_large", "Rocket League replay files may be at most 16 MB.");
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_REPLAY_BYTES) {
      request.destroy();
      throw new ReplayInputError("file_too_large", "Rocket League replay files may be at most 16 MB.");
    }
    chunks.push(chunk);
  }
  if (!size) throw new ReplayInputError("empty_replay", "The uploaded replay file was empty.");
  return new Uint8Array(Buffer.concat(chunks));
}

function clientError(response, error) {
  const known = error instanceof ReplayInputError;
  json(response, known ? 422 : 500, {
    kind: "blocked",
    code: known ? error.code : "rl_engine_failure",
    publicMessage: known ? error.publicMessage : "The replay engine failed safely. Your upload was not converted into coaching.",
    internalMessage: error instanceof Error ? error.message : "Unknown replay engine failure.",
    retryable: !known,
  });
}

export function createServer({ token = process.env.RL_ENGINE_TOKEN } = {}) {
  return createHttpServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://rl-engine.internal");
    if (request.method === "GET" && url.pathname === "/healthz") {
      return json(response, 200, {
        ok: true,
        service: "replay-method-rl-engine",
        status: "ready",
        engineVersion: ENGINE_VERSION,
        parserVersion: PARSER_VERSION,
      });
    }
    if (request.method !== "POST" || !["/v1/analyze/rocket-league", "/v1/inspect/rocket-league"].includes(url.pathname)) {
      return json(response, 404, { error: "not_found" });
    }
    if (!authorized(request, token)) return json(response, 401, { error: "unauthorized" });
    if (request.headers["content-type"]?.split(";")[0] !== "application/octet-stream") {
      return json(response, 415, { error: "application_octet_stream_required" });
    }

    try {
      const bytes = await readBody(request);
      const player = String(request.headers["x-replay-method-player"] ?? "");
      const rank = String(request.headers["x-replay-method-rank"] ?? "");
      if (!player) throw new ReplayInputError("subject_player_required", "Add the exact in-game player name before uploading.");
      const result = url.pathname.includes("/inspect/")
        ? { kind: "inspection", normalized: inspectReplay(bytes, player, rank) }
        : analyzeReplay(bytes, player, rank);
      return json(response, 200, result);
    } catch (error) {
      console.error("rocket league request failed", error instanceof Error ? { name: error.name, message: error.message } : error);
      return clientError(response, error);
    }
  });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const port = Number(process.env.PORT ?? 8788);
  const token = process.env.RL_ENGINE_TOKEN;
  if (!token || token.length < 24) {
    console.error("RL_ENGINE_TOKEN must be set to a secret of at least 24 characters.");
    process.exit(1);
  }
  createServer({ token }).listen(port, "0.0.0.0", () => {
    console.log(`Replay Method RL engine listening on :${port}`);
  });
}
