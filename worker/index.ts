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
  const due = await env.DB.prepare(`SELECT public_id FROM analysis_jobs
    WHERE status = 'retry' AND next_retry_at IS NOT NULL AND next_retry_at <= ?
    ORDER BY next_retry_at ASC LIMIT ?`)
    .bind(new Date().toISOString(), limit).all<{ public_id: string }>();
  await Promise.all((due.results || []).map((job) => processAnalysisJob(job.public_id, env)));
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
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    const response = await handler.fetch(request, env, ctx);

    // The request returns its private status URL immediately. Heavy ingestion,
    // parsing and coaching continue out of band and are idempotently claimed
    // from the persistent analysis_jobs table.
    const schedulesAnalysis = request.method === "POST" && (
      (url.pathname === "/api/analyses" && response.status === 201) ||
      (/^\/api\/admin\/analyses\/\d+\/retry$/.test(url.pathname) && response.ok)
    );
    if (schedulesAnalysis) {
      try {
        const body = await response.clone().json() as { jobPublicId?: string };
        if (body.jobPublicId) ctx.waitUntil(processAnalysisJob(body.jobPublicId, env));
      } catch (error) {
        console.error("could not schedule analysis job", error);
      }
    }

    // A private report page polls this endpoint while an analysis is active.
    // That poll also wakes a due retry, so transient failures recover even on
    // hosts where a cron trigger has not yet been configured.
    if (request.method === "GET" && /^\/api\/analyses\/[a-f0-9]{32}$/.test(url.pathname) && response.ok) {
      try {
        const body = await response.clone().json() as {
          processing?: { status?: string; nextRetryAt?: string | null; jobPublicId?: string };
        };
        const processing = body.processing;
        if (processing?.status === "retry" && processing.jobPublicId && processing.nextRetryAt && new Date(processing.nextRetryAt) <= new Date()) {
          ctx.waitUntil(processAnalysisJob(processing.jobPublicId, env));
        }
      } catch (error) {
        console.error("could not wake analysis retry", error);
      }
    }

    return response;
  },

  async scheduled(_: unknown, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(Promise.all([processDueRetries(env), processDueEmailDeliveries(env.DB)]));
  },
};

export default worker;
