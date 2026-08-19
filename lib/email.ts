import { getDatabase } from "../db";
import { gameLabels, isAnalysisGame, reportUrl, type AnalysisGame } from "./analysis";
import { analysisReadyEmail, analysisReceivedEmail } from "./email-templates.mjs";
import { subsystemEnabled } from "./subsystem-controls.mjs";

type EmailEnv = {
  TRANSACTIONAL_EMAIL_ENABLED?: string;
  RESEND_API_KEY?: string;
  ANALYSIS_FROM_EMAIL?: string;
  PUBLIC_SITE_URL?: string;
};

type DeliveryKind = "analysis_received" | "report_ready";
type EmailContent = { subject: string; html: string; text: string };
type DeliveryRow = {
  id: number;
  analysisRequestId: number;
  kind: DeliveryKind;
  status: string;
  idempotencyKey: string;
  attempts: number;
  maxAttempts: number;
};

type DeliveryInput = {
  database?: D1Database;
  analysisRequestId: number;
  analysisPublicId: string;
  email: string;
  game: AnalysisGame;
  url: string;
  mistake?: string;
};

function deliveryFields() {
  return `id, analysis_request_id AS analysisRequestId, kind, status, idempotency_key AS idempotencyKey,
    attempts, max_attempts AS maxAttempts`;
}

async function emailConfiguration() {
  const { env } = await import("cloudflare:workers");
  const emailEnv = env as unknown as EmailEnv;
  const apiKey = emailEnv.RESEND_API_KEY?.trim() || "";
  const from = emailEnv.ANALYSIS_FROM_EMAIL?.trim() || "";
  const validFrom = from.length <= 320 && !/[\r\n]/.test(from);
  return {
    enabled: subsystemEnabled(emailEnv.TRANSACTIONAL_EMAIL_ENABLED) && Boolean(apiKey && from && validFrom),
    apiKey,
    from,
    siteUrl: safeSiteUrl(emailEnv.PUBLIC_SITE_URL),
  };
}

function safeSiteUrl(value?: string) {
  try {
    const url = new URL(value || "https://replaymethod.xyz");
    if (url.protocol === "https:" || url.hostname === "localhost") return url.origin;
  } catch { /* use the canonical production origin */ }
  return "https://replaymethod.xyz";
}

async function ensureDelivery(db: D1Database, input: DeliveryInput, kind: DeliveryKind) {
  const idempotencyKey = `${kind}/${input.analysisPublicId}`;
  await db.prepare(`INSERT OR IGNORE INTO email_deliveries (
      public_id, analysis_request_id, kind, idempotency_key
    ) VALUES (?, ?, ?, ?)`)
    .bind(crypto.randomUUID().replaceAll("-", ""), input.analysisRequestId, kind, idempotencyKey).run();
  return db.prepare(`SELECT ${deliveryFields()} FROM email_deliveries
    WHERE analysis_request_id = ? AND kind = ? LIMIT 1`)
    .bind(input.analysisRequestId, kind).first<DeliveryRow>();
}

async function claimDelivery(db: D1Database, id: number) {
  const now = new Date().toISOString();
  return db.prepare(`UPDATE email_deliveries SET status = 'sending', attempts = attempts + 1,
      last_error_code = NULL, next_retry_at = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status IN ('pending', 'retry') AND attempts < max_attempts
      AND (next_retry_at IS NULL OR next_retry_at <= ?)
    RETURNING ${deliveryFields()}`).bind(id, now).first<DeliveryRow>();
}

async function markActivationRequired(db: D1Database, id: number) {
  await db.prepare(`UPDATE email_deliveries SET status = 'pending', last_error_code = 'provider_not_configured',
    next_retry_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status != 'accepted'`).bind(id).run();
}

async function markFailure(db: D1Database, row: DeliveryRow, code: string, retryable: boolean) {
  // Received-email content contains a one-time ownership credential that is
  // deliberately never persisted in plaintext. Only the stable report-ready
  // payload can be reconstructed for a later idempotent attempt.
  const shouldRetry = row.kind === "report_ready" && retryable && row.attempts < row.maxAttempts;
  const delayMs = Math.min(15 * 60_000, 60_000 * (2 ** Math.max(0, row.attempts - 1)));
  const nextRetryAt = shouldRetry ? new Date(Date.now() + delayMs).toISOString() : null;
  await db.prepare(`UPDATE email_deliveries SET status = ?, last_error_code = ?, next_retry_at = ?,
    updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(shouldRetry ? "retry" : "failed", code.slice(0, 80), nextRetryAt, row.id).run();
  console.warn("transactional email not sent", { deliveryId: row.id, kind: row.kind, code, retryable: shouldRetry });
  return false;
}

async function sendWithResend(config: Awaited<ReturnType<typeof emailConfiguration>>, to: string, content: EmailContent, idempotencyKey: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        from: config.from,
        to: [to],
        reply_to: "contact@replaymethod.xyz",
        subject: content.subject,
        html: content.html,
        text: content.text,
      }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({})) as { id?: unknown };
    return {
      ok: response.ok && typeof payload.id === "string",
      providerMessageId: typeof payload.id === "string" ? payload.id.slice(0, 120) : null,
      code: response.ok ? "invalid_provider_response" : `resend_http_${response.status}`,
      retryable: response.status === 409 || response.status === 429 || response.status >= 500,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function sendClaimedDelivery(
  db: D1Database,
  row: DeliveryRow,
  config: Awaited<ReturnType<typeof emailConfiguration>>,
  to: string,
  content: EmailContent,
) {
  try {
    const result = await sendWithResend(config, to, content, row.idempotencyKey);
    if (!result.ok) return markFailure(db, row, result.code, result.retryable);
    await db.prepare(`UPDATE email_deliveries SET status = 'accepted', provider_message_id = ?, accepted_at = CURRENT_TIMESTAMP,
      last_error_code = NULL, next_retry_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(result.providerMessageId, row.id).run();
    return true;
  } catch (error) {
    const code = error instanceof DOMException && error.name === "AbortError" ? "provider_timeout" : "provider_network_error";
    return markFailure(db, row, code, true);
  }
}

async function deliver(input: DeliveryInput, kind: DeliveryKind, content: EmailContent) {
  const db = input.database || await getDatabase();
  if (kind === "report_ready") {
    const report = await db.prepare("SELECT status FROM analysis_requests WHERE id = ? LIMIT 1")
      .bind(input.analysisRequestId).first<{ status: string }>();
    if (report?.status !== "ready") {
      console.warn("report-ready email suppressed before report readiness", { analysisRequestId: input.analysisRequestId });
      return false;
    }
  }

  const row = await ensureDelivery(db, input, kind);
  if (!row) return false;
  if (row.status === "accepted") return true;
  const config = await emailConfiguration();
  if (!config.enabled) {
    await markActivationRequired(db, row.id);
    return false;
  }
  const claimed = await claimDelivery(db, row.id);
  if (!claimed) return false;
  return sendClaimedDelivery(db, claimed, config, input.email, content);
}

export async function sendAnalysisReceived(input: DeliveryInput) {
  return deliver(input, "analysis_received", analysisReceivedEmail({
    gameLabel: gameLabels[input.game],
    url: input.url,
  }));
}

export async function sendAnalysisReady(input: DeliveryInput & { mistake: string }) {
  return deliver(input, "report_ready", analysisReadyEmail({
    gameLabel: gameLabels[input.game],
    url: input.url,
    mistake: input.mistake,
  }));
}

export async function processDueEmailDeliveries(db: D1Database, limit = 10) {
  const config = await emailConfiguration();
  if (!config.enabled) return { processed: 0, activationRequired: true };
  await db.batch([
    db.prepare(`UPDATE email_deliveries SET status = 'failed', last_error_code = 'uncertain_received_attempt',
      next_retry_at = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE status = 'sending' AND kind = 'analysis_received' AND updated_at <= datetime('now', '-10 minutes')`),
    db.prepare(`UPDATE email_deliveries SET status = 'failed', last_error_code = 'idempotency_window_expired',
      next_retry_at = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE status = 'sending' AND kind = 'report_ready' AND updated_at <= datetime('now', '-23 hours')`),
    db.prepare(`UPDATE email_deliveries SET status = 'retry', last_error_code = 'stale_sending_lease',
      next_retry_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE status = 'sending' AND kind = 'report_ready' AND updated_at <= datetime('now', '-10 minutes')
        AND updated_at > datetime('now', '-23 hours') AND attempts < max_attempts`),
  ]);
  const due = await db.prepare(`SELECT ${deliveryFields()} FROM email_deliveries
    WHERE status = 'retry' AND next_retry_at IS NOT NULL AND next_retry_at <= ?
    ORDER BY next_retry_at ASC LIMIT ?`).bind(new Date().toISOString(), limit).all<DeliveryRow>();
  let processed = 0;

  for (const candidate of due.results || []) {
    const row = await claimDelivery(db, candidate.id);
    if (!row) continue;
    const analysis = await db.prepare(`SELECT public_id AS publicId, email, game, status,
        highest_impact_mistake AS mistake FROM analysis_requests WHERE id = ? LIMIT 1`)
      .bind(row.analysisRequestId).first<Record<string, unknown>>();
    if (!analysis || !isAnalysisGame(String(analysis.game))) {
      await markFailure(db, row, "analysis_not_found", false);
      continue;
    }

    if (row.kind === "report_ready") {
      if (analysis.status !== "ready" || !analysis.mistake) {
        await markFailure(db, row, "report_not_ready", false);
        continue;
      }
      await sendClaimedDelivery(db, row, config, String(analysis.email), analysisReadyEmail({
        gameLabel: gameLabels[String(analysis.game) as AnalysisGame],
        url: reportUrl(config.siteUrl, String(analysis.publicId)),
        mistake: String(analysis.mistake),
      }));
    } else {
      await markFailure(db, row, row.kind === "analysis_received" ? "received_retry_not_safe" : "delivery_context_missing", false);
      continue;
    }
    processed += 1;
  }
  return { processed, activationRequired: false };
}
