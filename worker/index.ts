/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { processAnalysisJob } from "../lib/core/pipeline";
import { processDueEmailDeliveries } from "../lib/email";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  BUCKET: R2Bucket;
  RL_ENGINE_URL?: string;
  RL_ENGINE_TOKEN?: string;
  RL_ENGINE_TIMEOUT_MS?: string;
  RIOT_LEAGUE_API_KEY?: string;
  RIOT_VALORANT_API_KEY?: string;
  RIOT_RSO_CLIENT_ID?: string;
  RIOT_RSO_CLIENT_SECRET?: string;
  RIOT_RSO_REDIRECT_URI?: string;
  RIOT_API_TIMEOUT_MS?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  OPENAI_INPUT_COST_PER_MILLION?: string;
  OPENAI_OUTPUT_COST_PER_MILLION?: string;
  PUBLIC_SITE_URL?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

async function processDueRetries(env: Env, limit = 5) {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM analysis_report_access WHERE expires_at <= CURRENT_TIMESTAMP"),
    env.DB.prepare(`UPDATE analysis_usage SET status = 'released', released_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP WHERE status = 'reserved' AND analysis_request_id IN (
        SELECT analysis_request_id FROM analysis_jobs WHERE status = 'running'
          AND updated_at <= datetime('now', '-3 minutes')
      )`),
    env.DB.prepare(`UPDATE analysis_requests SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id IN (
      SELECT analysis_request_id FROM analysis_jobs WHERE status = 'running'
        AND updated_at <= datetime('now', '-3 minutes') AND attempts >= max_attempts
    )`),
    env.DB.prepare(`UPDATE analysis_jobs SET status = 'failed', stage = 'failed', stage_label = 'Interrupted analysis needs attention',
      error_code = 'stale_running_lease', error_message = 'The prior worker stopped before completing this analysis.',
      next_retry_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE status = 'running'
        AND updated_at <= datetime('now', '-3 minutes') AND attempts >= max_attempts`),
    env.DB.prepare(`UPDATE analysis_jobs SET status = 'retry', stage = 'retry', stage_label = 'Interrupted analysis recovered',
      error_code = 'stale_running_lease', error_message = 'The prior worker stopped before completing this analysis.',
      next_retry_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE status = 'running'
        AND updated_at <= datetime('now', '-3 minutes') AND attempts < max_attempts`),
  ]);
  const due = await env.DB.prepare(`SELECT public_id FROM analysis_jobs
    WHERE (status = 'queued' AND updated_at <= datetime('now', '-1 minute'))
      OR (status = 'retry' AND next_retry_at IS NOT NULL AND next_retry_at <= ?)
    ORDER BY next_retry_at ASC LIMIT ?`)
    .bind(new Date().toISOString(), limit).all<{ public_id: string }>();
  await Promise.all((due.results || []).map((job) => processAnalysisJob(job.public_id, env)));
}

async function cleanupExpiredReplayUploads(env: Env, limit = 10) {
  const expired = await env.DB.prepare(`SELECT id, object_key AS objectKey FROM replay_upload_sessions
    WHERE expires_at <= CURRENT_TIMESTAMP AND status != 'claimed' ORDER BY expires_at LIMIT ?`)
    .bind(limit).all<{ id: number; objectKey: string | null }>();
  for (const session of expired.results || []) {
    const parts = await env.DB.prepare("SELECT object_key AS objectKey FROM replay_upload_parts WHERE upload_session_id = ?")
      .bind(session.id).all<{ objectKey: string }>();
    const keys = [...(parts.results || []).map(part => part.objectKey), session.objectKey].filter((key): key is string => Boolean(key));
    if (keys.length) await env.BUCKET.delete(keys);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM replay_upload_parts WHERE upload_session_id = ?").bind(session.id),
      env.DB.prepare("DELETE FROM replay_upload_sessions WHERE id = ? AND status != 'claimed'").bind(session.id),
    ]);
  }
}

function withSecurityHeaders(response: Response, url: URL) {
  const headers = new Headers(response.headers);
  headers.set("Content-Security-Policy", "base-uri 'self'; frame-ancestors 'none'; object-src 'none'");
  headers.set("Permissions-Policy", "camera=(), geolocation=(), microphone=()");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  if (/^\/(?:access|admin|report|reports)(?:\/|$)/.test(url.pathname) || /^\/api\/(?:admin|analyses|billing|player|replay-uploads)(?:\/|$)/.test(url.pathname)) {
    headers.set("Cache-Control", "private, no-store");
    headers.set("Referrer-Policy", "no-referrer");
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      const imageResponse = await handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
      return withSecurityHeaders(imageResponse, url);
    }

    const response = await handler.fetch(request, env, ctx);

    // Keep the customer request alive while the analysis worker is running.
    // Cloudflare only gives waitUntil work a short grace period after the
    // response is returned; a valid replay parse can exceed that window on a
    // cold or CPU-constrained engine. Awaiting here lets the engine response be
    // durably persisted instead of leaving the job in a stale `running` state.
    // Concurrent/idempotent submissions remain safe because loadAndClaim only
    // transitions one queued/retry row to running.
    const schedulesAnalysis = request.method === "POST" && (
      (url.pathname === "/api/analyses" && response.status === 201) ||
      (/^\/api\/analyses\/[a-f0-9]{32}$/.test(url.pathname) && response.ok) ||
      (/^\/api\/admin\/analyses\/\d+\/retry$/.test(url.pathname) && response.ok)
    );
    if (schedulesAnalysis) {
      try {
        const body = await response.clone().json() as { jobPublicId?: string };
        if (body.jobPublicId) await processAnalysisJob(body.jobPublicId, env);
      } catch (error) {
        console.error("could not schedule analysis job", { code: error instanceof Error ? error.name : "unknown_error" });
      }
    }

    // A private report page polls this endpoint while an analysis is active.
    // That poll also wakes a due retry, so transient failures recover even on
    // hosts where a cron trigger has not yet been configured.
    if (request.method === "GET" && /^\/api\/analyses\/[a-f0-9]{32}$/.test(url.pathname) && response.ok) {
      try {
        const body = await response.clone().json() as {
          processing?: { status?: string; nextRetryAt?: string | null; jobPublicId?: string; updatedAt?: string };
        };
        const processing = body.processing;
        if (processing?.status === "retry" && processing.jobPublicId && processing.nextRetryAt && new Date(processing.nextRetryAt) <= new Date()) {
          await processAnalysisJob(processing.jobPublicId, env);
        } else if (processing?.status === "running" && processing.jobPublicId && processing.updatedAt && Date.now() - new Date(`${processing.updatedAt}Z`).getTime() >= 180_000) {
          await (async () => {
            const exhausted = await env.DB.prepare(`UPDATE analysis_jobs SET status = 'failed', stage = 'failed',
              stage_label = 'Analysis engine did not respond', error_code = 'stale_running_lease',
              error_message = 'The analysis engine did not complete within the recovery window.', next_retry_at = NULL,
              updated_at = CURRENT_TIMESTAMP WHERE public_id = ? AND status = 'running'
              AND updated_at <= datetime('now', '-3 minutes') AND attempts >= max_attempts`).bind(processing.jobPublicId).run();
            if (exhausted.meta.changes) {
              await env.DB.batch([
                env.DB.prepare(`UPDATE analysis_requests SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id IN (
                  SELECT analysis_request_id FROM analysis_jobs WHERE public_id = ?
                )`).bind(processing.jobPublicId),
                env.DB.prepare(`UPDATE analysis_usage SET status = 'released', released_at = CURRENT_TIMESTAMP,
                  updated_at = CURRENT_TIMESTAMP WHERE status = 'reserved' AND analysis_request_id IN (
                    SELECT analysis_request_id FROM analysis_jobs WHERE public_id = ?
                  )`).bind(processing.jobPublicId),
              ]);
              return;
            }
            const recovered = await env.DB.prepare(`UPDATE analysis_jobs SET status = 'retry', stage = 'blocked',
              stage_label = 'Restarting interrupted analysis', error_code = 'stale_running_lease',
              error_message = 'The prior worker stopped before completing this analysis.', next_retry_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP WHERE public_id = ? AND status = 'running'
              AND updated_at <= datetime('now', '-3 minutes') AND attempts < max_attempts`).bind(processing.jobPublicId).run();
            if (recovered.meta.changes) {
              await env.DB.prepare(`UPDATE analysis_usage SET status = 'released', released_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP WHERE status = 'reserved' AND analysis_request_id IN (
                  SELECT analysis_request_id FROM analysis_jobs WHERE public_id = ?
                )`).bind(processing.jobPublicId).run();
              await processAnalysisJob(processing.jobPublicId, env);
            }
          })();
        }
      } catch (error) {
        console.error("could not wake analysis retry", { code: error instanceof Error ? error.name : "unknown_error" });
      }
    }

    return withSecurityHeaders(response, url);
  },

  async scheduled(_: unknown, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(Promise.all([processDueRetries(env), processDueEmailDeliveries(env.DB), cleanupExpiredReplayUploads(env)]));
  },
};

export default worker;
