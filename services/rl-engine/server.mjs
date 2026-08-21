import { createServer as createHttpServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import { PARSER_VERSION, ReplayInputError } from "./parser.mjs";

export { PARSER_VERSION };

export const MAX_REPLAY_BYTES = 16 * 1024 * 1024;
export const ENGINE_VERSION = "rl-engine.v1";
export const MINIMUM_TOKEN_LENGTH = 24;
export const DEFAULT_JOB_TIMEOUT_MS = 80_000;

class RequestContractError extends Error {
  constructor(code, publicMessage) {
    super(publicMessage);
    this.name = "RequestContractError";
    this.code = code;
    this.publicMessage = publicMessage;
  }
}

class EngineTransientError extends Error {
  constructor(code, publicMessage, internalMessage = publicMessage) {
    super(internalMessage);
    this.name = "EngineTransientError";
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
  const transientError = error instanceof EngineTransientError;
  const known = inputError || contractError || transientError;
  json(response, contractError ? 400 : inputError ? 422 : transientError ? 503 : 500, {
    kind: "blocked",
    code: known ? error.code : "rl_engine_failure",
    publicMessage: known ? error.publicMessage : "The replay engine failed safely. Your upload was not converted into coaching.",
    internalMessage: (error instanceof Error ? error.message : "Unknown replay engine failure.").slice(0, 1800),
    candidatePlayers: inputError && Array.isArray(error.candidatePlayers) ? error.candidatePlayers : undefined,
    retryable: transientError || !known,
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

function jobTimeout(value) {
  const parsed = Number(value ?? DEFAULT_JOB_TIMEOUT_MS);
  return Number.isFinite(parsed) ? Math.min(115_000, Math.max(5_000, Math.round(parsed))) : DEFAULT_JOB_TIMEOUT_MS;
}

function replayWorkerError(payload) {
  if (payload?.name === "ReplayInputError" && typeof payload.code === "string") {
    const error = new ReplayInputError(
      payload.code,
      payload.publicMessage ?? "The replay could not be parsed safely.",
      payload.message,
      Array.isArray(payload.candidatePlayers) ? payload.candidatePlayers : [],
    );
    return error;
  }
  const error = new Error(
    typeof payload?.message === "string" ? payload.message : "The replay worker failed without a result.",
  );
  if (typeof payload?.code === "string") error.code = payload.code;
  return error;
}

export function createReplayProcessor({ size = 1, timeoutMs = DEFAULT_JOB_TIMEOUT_MS } = {}) {
  const workerCount = maximumConcurrency(size);
  const deadlineMs = jobTimeout(timeoutMs);
  const slots = [];
  let sequence = 0;
  let closed = false;

  const failPending = (slot, error) => {
    if (!slot.pending) return;
    clearTimeout(slot.pending.timer);
    slot.pending.reject(error);
    slot.pending = null;
    slot.busy = false;
  };

  const spawn = (slot) => {
    if (closed) return;
    const worker = new Worker(new URL("./analysis-worker.mjs", import.meta.url), { execArgv: [] });
    slot.worker = worker;
    slot.ready = false;
    slot.busy = false;
    worker.on("message", (message) => {
      if (slot.worker !== worker) return;
      if (message?.type === "ready") {
        slot.ready = true;
        return;
      }
      if (!slot.pending || message?.jobId !== slot.pending.jobId) return;
      const pending = slot.pending;
      clearTimeout(pending.timer);
      slot.pending = null;
      slot.busy = false;
      if (message?.ok) pending.resolve(message.result);
      else pending.reject(replayWorkerError(message?.error));
    });
    const replace = (error) => {
      if (slot.worker !== worker) return;
      slot.worker = null;
      slot.ready = false;
      failPending(slot, error);
      if (!closed) spawn(slot);
    };
    worker.once("error", (error) => replace(new EngineTransientError(
      "rl_engine_worker_failed",
      "The replay worker restarted safely. Your upload is preserved for an automatic retry.",
      error instanceof Error ? error.message : "Replay worker failed.",
    )));
    worker.once("exit", (code) => replace(new EngineTransientError(
      "rl_engine_worker_exited",
      "The replay worker restarted safely. Your upload is preserved for an automatic retry.",
      `Replay worker exited before returning a result (code ${code}).`,
    )));
  };

  for (let index = 0; index < workerCount; index += 1) {
    const slot = { worker: null, ready: false, busy: false, pending: null };
    slots.push(slot);
    spawn(slot);
  }

  const processReplay = ({ operation, bytes, player, rank, publicOutputEnabled }) => {
    const slot = slots.find((candidate) => candidate.ready && !candidate.busy && candidate.worker);
    if (!slot) return Promise.reject(new EngineTransientError(
      "rl_engine_warming",
      "The replay worker is warming up. Your upload is preserved for an automatic retry.",
    ));
    slot.busy = true;
    const jobId = ++sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const worker = slot.worker;
        failPending(slot, new EngineTransientError(
          "rl_engine_job_timeout",
          "The replay worker exceeded its safe processing window. Your upload is preserved for an automatic retry.",
          `Replay processing exceeded ${deadlineMs}ms.`,
        ));
        slot.worker = null;
        slot.ready = false;
        if (worker) void worker.terminate();
        if (!closed) spawn(slot);
      }, deadlineMs);
      timer.unref();
      slot.pending = { jobId, resolve, reject, timer };
      const replayBytes = new Uint8Array(bytes);
      slot.worker.postMessage(
        { jobId, operation, bytes: replayBytes, player, rank, publicOutputEnabled },
        [replayBytes.buffer],
      );
    });
  };

  return {
    processReplay,
    isReady: () => !closed && slots.every((slot) => slot.ready && slot.worker),
    close: async () => {
      closed = true;
      await Promise.all(slots.map(async (slot) => {
        failPending(slot, new EngineTransientError("rl_engine_shutdown", "The replay worker is restarting."));
        const worker = slot.worker;
        slot.worker = null;
        slot.ready = false;
        if (worker) await worker.terminate();
      }));
    },
  };
}

export function createServer(options = {}) {
  const token = options.token ?? process.env.RL_ENGINE_TOKEN;
  const maxConcurrency = options.maxConcurrency ?? process.env.RL_ENGINE_MAX_CONCURRENCY;
  const publicOutputEnabled = options.publicOutputEnabled ?? process.env.RL_PUBLIC_DETECTORS_ENABLED === "true";
  const concurrencyLimit = maximumConcurrency(maxConcurrency);
  const processor = options.processReplay ? null : createReplayProcessor({
    size: concurrencyLimit,
    timeoutMs: options.jobTimeoutMs ?? process.env.RL_ENGINE_JOB_TIMEOUT_MS,
  });
  const processReplay = options.processReplay ?? processor.processReplay;
  const configured = typeof token === "string" && token.length >= MINIMUM_TOKEN_LENGTH && token.length <= 512;
  let activeRequests = 0;
  const server = createHttpServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://rl-engine.internal");
    if (request.method === "GET" && url.pathname === "/livez") {
      return json(response, 200, { ok: true, service: "replay-method-rl-engine", status: "live" });
    }
    if (request.method === "GET" && url.pathname === "/healthz") {
      const ready = configured && (processor?.isReady() ?? true);
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
      const result = await processReplay({
        operation: url.pathname.includes("/inspect/") ? "inspect" : "analyze",
        bytes,
        player,
        rank,
        publicOutputEnabled,
      });
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
  server.once("close", () => { void processor?.close(); });
  server.once("error", () => { void processor?.close(); });
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
