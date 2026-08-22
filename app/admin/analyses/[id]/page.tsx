import { and, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "../../../../db";
import { analysisFindings, analysisJobs, analysisRequests, analysisUsage, billingSubscriptions, emailDeliveries, playerClaims, playerFocuses } from "../../../../db/schema";
import { requireChatGPTUser } from "../../../chatgpt-auth";
import { gameLabels, isAnalysisGame, parseLines } from "../../../../lib/analysis";
import { isConfiguredSiteAdmin } from "../../../../lib/admin";
import AnalysisEditor from "./AnalysisEditor";

export const dynamic = "force-dynamic";

export default async function AnalysisAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireChatGPTUser(`/admin/analyses/${(await params).id}`);
  if (!await isConfiguredSiteAdmin(user)) return <main className="admin-denied"><div><span>REPLAY METHOD ADMIN</span><h1>Access denied.</h1><Link href="/">Return home</Link></div></main>;
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const db = await getDb();
  const row = await db.select().from(analysisRequests).where(eq(analysisRequests.id, id)).get();
  if (!row || !isAnalysisGame(row.game)) notFound();
  const [job, finding, usage, deliveries, claim] = await Promise.all([
    db.select().from(analysisJobs).where(eq(analysisJobs.analysisRequestId, row.id)).get(),
    db.select().from(analysisFindings).where(eq(analysisFindings.analysisRequestId, row.id)).get(),
    db.select().from(analysisUsage).where(eq(analysisUsage.analysisRequestId, row.id)).get(),
    db.select().from(emailDeliveries).where(eq(emailDeliveries.analysisRequestId, row.id)).orderBy(desc(emailDeliveries.createdAt)),
    db.select().from(playerClaims).where(eq(playerClaims.analysisRequestId, row.id)).get()
  ]);
  const playerId = claim?.playerId ?? usage?.playerId ?? null;
  const [subscription, focus] = playerId ? await Promise.all([
    db.select().from(billingSubscriptions).where(eq(billingSubscriptions.playerId, playerId)).orderBy(desc(billingSubscriptions.updatedAt)).get(),
    db.select().from(playerFocuses).where(and(eq(playerFocuses.playerId, playerId), eq(playerFocuses.game, row.game), eq(playerFocuses.status, "active"))).get()
  ]) : [null, null];

  return <main className="editor-page"><nav className="editor-nav shell"><Link href="/admin">← Mission control</Link><div className="brand"><span className="logo" aria-hidden="true" /><span>replay<span>method</span></span></div><a href={`/report/${row.publicId}`} target="_blank">Open player view ↗</a></nav><section className="editor-shell shell"><header><div><span>{gameLabels[row.game]} · {row.currentRank}{row.targetRank ? ` → ${row.targetRank}` : ""}</span><h1>{job ? "Inspect the analysis." : "Review the beta report."}</h1><p>{row.goal}</p></div><i className={row.status}>{row.status}</i></header>{job && <><section className="job-health"><div><span>JOB</span><b>{job.stageLabel}</b><small>{job.status} · attempt {job.attempts}/{job.maxAttempts}</small></div><div><span>PARSER / DETECTOR</span><b>{job.detectorVersion || "Not reached"}</b><small>{job.parserVersion || "Parser pending"}</small></div><div><span>ANALYZER / COACHING</span><b>{job.coachingVersion || "Not reached"}</b><small>{job.analyzerVersion || "Analyzer pending"}</small></div><div><span>QUALITY</span><b>{finding ? `${Math.round(finding.confidence * 100)}% ${finding.confidenceLabel}` : "No finding"}</b><small>{finding?.estimatedImpact || job.errorCode || "Awaiting evidence"}</small></div><div><span>RUNTIME / COST</span><b>{job.durationMs == null ? "—" : `${(job.durationMs / 1000).toFixed(2)}s`}</b><small>${(job.estimatedCostMicros / 1_000_000).toFixed(5)} estimated</small></div></section>{(job.errorCode || job.errorMessage || job.nextRetryAt) && <section className="job-alert"><span>PIPELINE ATTENTION</span><b>{job.errorCode || "Retry scheduled"}</b><p>{job.errorMessage || "No internal error message was recorded."}</p><small>{job.nextRetryAt ? `Next retry ${new Date(job.nextRetryAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}` : "No automatic retry scheduled"}</small></section>}</>}<div className="submission-context"><article><span>PLAYER</span><b>{row.playerContext || "Not provided"}</b><small><a href={`mailto:${row.email}`}>{row.email}</a></small></article><article><span>EVIDENCE</span><b>{row.originalFileName || "Private link"}</b>{row.fileKey ? <a href={`/api/admin/analyses/${row.id}/evidence`}>Download replay ↓</a> : row.evidenceUrl ? <a href={row.evidenceUrl} target="_blank" rel="noreferrer">Open evidence ↗</a> : null}</article><article><span>CONTEXT</span><b>{row.notes || "No extra notes"}</b><small>Submitted {new Date(`${row.createdAt}Z`).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</small></article></div><section className="analysis-operations"><article><span>ENTITLEMENT</span><b>{usage ? `${usage.accessKind} · ${usage.status}` : "No usage record"}</b><small>{usage ? `slot ${usage.slot} · ${usage.planKey || "free beta"}` : "No player usage was reserved for this analysis."}</small></article><article><span>BILLING</span><b>{subscription ? `${subscription.planKey} · ${subscription.status}` : "No subscription"}</b><small>{subscription ? `${subscription.cancelAtPeriodEnd ? "Cancels" : "Renews"} ${new Date(subscription.currentPeriodEnd).toLocaleDateString("en-GB", { dateStyle: "medium" })}` : "No paid billing projection is associated with this player."}</small></article><article><span>TRANSACTIONAL EMAIL</span><b>{deliveries.length ? deliveries.map(item => `${item.kind}: ${item.status}`).join(" · ") : "No delivery records"}</b><small>{deliveries.length ? deliveries.map(item => item.lastErrorCode || `${item.attempts}/${item.maxAttempts} attempts`).join(" · ") : "No transactional send has been requested."}</small></article><article><span>ACTIVE FOCUS</span><b>{focus?.title || "No active focus"}</b><small>{focus ? `${focus.matchesObserved} observations · ${focus.metricLabel || "evidence only"}` : "No supported longitudinal finding is active."}</small></article><article><span>REPORT FEEDBACK</span><b>{row.feedbackScore ? `${row.feedbackScore}/5` : "Not rated"}</b><small>{row.feedbackText || (row.caseStudyConsent ? "Anonymous quote permission granted" : "No written feedback")}</small></article></section><AnalysisEditor analysis={{ id: row.id, publicId: row.publicId, email: row.email, status: row.status, jobPublicId: job?.publicId || null, jobStatus: job?.status || null, highestImpactMistake: row.highestImpactMistake || "", whyItCosts: row.whyItCosts || "", evidenceMoments: parseLines(row.evidenceMoments).join("\n"), nextQueueRule: row.nextQueueRule || "", practicePlan: parseLines(row.practicePlan).join("\n"), coachNote: row.coachNote || "" }} /></section></main>;
}
