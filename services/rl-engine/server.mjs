import { createServer as createHttpServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";
import { analyzeReplay } from "./analyzer.mjs";
import { inspectReplay, PARSER_VERSION, ReplayInputError } from "./parser.mjs";

export { PARSER_VERSION };

export const MAX_REPLAY_BYTES = 16 * 1024 * 1024;
export const ENGINE_VERSION = "rl-engine.v1";
export const MINIMUM_TOKEN_LENGTH = 24;

class RequestContractError extends Error {
  constructor(code, publicMessage) {
    super(publicMessage);
    this.name = "RequestContractError";
    this.code = code;
    this.publicMessage = publicMessage;
  }
}

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
  if (!token || token.length < MINIMUM_TOKEN_LENGTH || token.length > 512) return false;
  const supplied = request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
  const left = Buffer.from(supplied);
  const right = Buffer.from(token);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function readBody(request) {
  const rawLength = request.headers["content-length"];
  const declared = rawLength == null ? 0 : Number(rawLength);
  if (!Number.isFinite(declared) || declared < 0) {
    throw new RequestContractError("invalid_content_length", "The replay upload metadata was invalid.");
  }
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
  const inputError = error instanceof ReplayInputError;
  const contractError = error instanceof RequestContractError;
  const known = inputError || contractError;
  json(response, contractError ? 400 : inputError ? 422 : 500, {
    kind: "blocked",
    code: known ? error.code : "rl_engine_failure",
    publicMessage: known ? error.publicMessage : "The replay engine failed safely. Your upload was not converted into coaching.",
    internalMessage: (error instanceof Error ? error.message : "Unknown replay engine failure.").slice(0, 1800),
    retryable: !known,
  });
}

function requiredHeader(request, name, maximumLength, code, publicMessage, { optional = false } = {}) {
  const raw = String(request.headers[name] ?? "");
  if ((!raw && !optional) || raw.length > maximumLength || /[\u0000-\u001f\u007f]/.test(raw)) {
    throw new RequestContractError(code, publicMessage);
  }
  let decoded;
  try { decoded = decodeURIComponent(raw).trim(); } catch { decoded = raw.trim(); }
  if ((!decoded && !optional) || decoded.length > maximumLength || /[\u0000-\u001f\u007f]/.test(decoded)) {
    throw new RequestContractError(code, publicMessage);
  }
  return decoded;
}

function maximumConcurrency(value) {
  const parsed = Number(value ?? 1);
  return Number.isInteger(parsed) ? Math.min(8, Math.max(1, parsed)) : 1;
}

export function createServer({ token = process.env.RL_ENGINE_TOKEN, maxConcurrency = process.env.RL_ENGINE_MAX_CONCURRENCY } = {}) {
  const concurrencyLimit = maximumConcurrency(maxConcurrency);
  const ready = typeof token === "string" && token.length >= MINIMUM_TOKEN_LENGTH && token.length <= 512;
  let activeRequests = 0;
  const server = createHttpServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://rl-engine.internal");
    if (request.method === "GET" && url.pathname === "/livez") {
      return json(response, 200, { ok: true, service: "replay-method-rl-engine", status: "live" });
    }
    if (request.method === "GET" && url.pathname === "/healthz") {
      return json(response, ready ? 200 : 503, {
        ok: ready,
        service: "replay-method-rl-engine",
        status: ready ? "ready" : "not_ready",
        engineVersion: ENGINE_VERSION,
        parserVersion: PARSER_VERSION,
        activeRequests,
        maxConcurrency: concurrencyLimit,
      });
    }
    if (request.method !== "POST" || !["/v1/analyze/rocket-league", "/v1/inspect/rocket-league"].includes(url.pathname)) {
      return json(response, 404, { error: "not_found" });
    }
    if (!authorized(request, token)) return json(response, 401, { error: "unauthorized" });
    if (request.headers["content-type"]?.split(";")[0] !== "application/octet-stream") {
      return json(response, 415, { error: "application_octet_stream_required" });
    }
    if (activeRequests >= concurrencyLimit) {
      return json(response, 503, {
        kind: "blocked",
        code: "rl_engine_busy",
        publicMessage: "The replay worker is at capacity. The upload is preserved for an automatic retry.",
        internalMessage: "RL engine concurrency limit reached.",
        retryable: true,
      });
    }

    let requestId = "invalid";
    let counted = false;
    try {
      requestId = requiredHeader(request, "x-replay-method-request", 32, "request_id_required", "The analysis request identifier was missing.");
      if (!/^[a-f0-9]{32}$/.test(requestId)) throw new RequestContractError("request_id_invalid", "The analysis request identifier was invalid.");
      const player = requiredHeader(request, "x-replay-method-player", 160, "subject_player_required", "Add the exact in-game player name before uploading.");
      const rank = requiredHeader(request, "x-replay-method-rank", 80, "rank_invalid", "The submitted rank metadata was invalid.", { optional: true });
      activeRequests += 1;
      counted = true;
      const bytes = await readBody(request);
      const result = url.pathname.includes("/inspect/")
        ? { kind: "inspection", normalized: inspectReplay(bytes, player, rank) }
        : analyzeReplay(bytes, player, rank);
      return json(response, 200, result);
    } catch (error) {
      console.error("rocket league request failed", {
        requestId: /^[a-f0-9]{32}$/.test(requestId) ? requestId : "invalid",
        code: typeof error?.code === "string" ? error.code : "rl_engine_failure",
        retryable: !(error instanceof ReplayInputError || error instanceof RequestContractError),
      });
      return clientError(response, error);
    } finally {
      if (counted) activeRequests = Math.max(0, activeRequests - 1);
    }
  });
  server.headersTimeout = 10_000;
  server.requestTimeout = 125_000;
  server.keepAliveTimeout = 5_000;
  server.maxHeadersCount = 32;
  server.maxRequestsPerSocket = 100;
  return server;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const port = Number(process.env.PORT ?? 8788);
  const token = process.env.RL_ENGINE_TOKEN;
  if (!token || token.length < MINIMUM_TOKEN_LENGTH || token.length > 512) {
    console.error(`RL_ENGINE_TOKEN must be set to a secret of ${MINIMUM_TOKEN_LENGTH}–512 characters.`);
    process.exit(1);
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error("PORT must be an integer between 1 and 65535.");
    process.exit(1);
  }
  const server = createServer({ token });
  server.listen(port, "0.0.0.0", () => {
    console.log(`Replay Method RL engine listening on :${port}`);
  });
  const shutdown = (signal) => {
    console.log(`Replay Method RL engine received ${signal}; draining requests.`);
    const deadline = setTimeout(() => {
      server.closeAllConnections();
      process.exit(1);
    }, 10_000);
    deadline.unref();
    server.close(() => {
      clearTimeout(deadline);
      process.exit(0);
    });
  };
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}
