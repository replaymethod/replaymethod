import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "../../../../db";
import { analysisFindings, analysisJobs, analysisRequests } from "../../../../db/schema";
import { requireChatGPTUser } from "../../../chatgpt-auth";
import { gameLabels, isAnalysisGame, parseLines } from "../../../../lib/analysis";
import AnalysisEditor from "./AnalysisEditor";

export const dynamic = "force-dynamic";

export default async function AnalysisAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireChatGPTUser(`/admin/analyses/${(await params).id}`);
  const { env } = await import("cloudflare:workers");
  const adminEmail = (env as unknown as { ADMIN_EMAIL?: string }).ADMIN_EMAIL?.toLowerCase();
  if (!adminEmail || user.email.toLowerCase() !== adminEmail) return <main className="admin-denied"><div><span>REPLAY METHOD ADMIN</span><h1>Access denied.</h1><Link href="/">Return home</Link></div></main>;
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const db = await getDb();
  const row = await db.select().from(analysisRequests).where(eq(analysisRequests.id, id)).get();
  if (!row || !isAnalysisGame(row.game)) notFound();
  const [job, finding] = await Promise.all([
    db.select().from(analysisJobs).where(eq(analysisJobs.analysisRequestId, row.id)).get(),
    db.select().from(analysisFindings).where(eq(analysisFindings.analysisRequestId, row.id)).get()
  ]);

  return <main className="editor-page"><nav className="editor-nav shell"><Link href="/admin">← Mission control</Link><div className="brand"><span className="logo">↻</span><span>replay<span>method</span></span></div><a href={`/report/${row.publicId}`} target="_blank">Open player view ↗</a></nav><section className="editor-shell shell"><header><div><span>{gameLabels[row.game]} · {row.currentRank}{row.targetRank ? ` → ${row.targetRank}` : ""}</span><h1>{job ? "Inspect the analysis." : "Review the beta report."}</h1><p>{row.goal}</p></div><i className={row.status}>{row.status}</i></header>{job && <section className="job-health"><div><span>JOB</span><b>{job.stageLabel}</b><small>{job.status} · attempt {job.attempts}/{job.maxAttempts}</small></div><div><span>ENGINE</span><b>{job.detectorVersion || "Not reached"}</b><small>{job.parserVersion || "Parser pending"}</small></div><div><span>QUALITY</span><b>{finding ? `${Math.round(finding.confidence * 100)}% ${finding.confidenceLabel}` : "No finding"}</b><small>{finding?.estimatedImpact || job.errorCode || "Awaiting evidence"}</small></div><div><span>RUNTIME / COST</span><b>{job.durationMs == null ? "—" : `${(job.durationMs / 1000).toFixed(2)}s`}</b><small>${(job.estimatedCostMicros / 1_000_000).toFixed(5)} estimated</small></div></section>}<div className="submission-context"><article><span>PLAYER</span><b>{row.playerContext || "Not provided"}</b><small><a href={`mailto:${row.email}`}>{row.email}</a></small></article><article><span>EVIDENCE</span><b>{row.originalFileName || "Private link"}</b>{row.fileKey ? <a href={`/api/admin/analyses/${row.id}/evidence`}>Download replay ↓</a> : row.evidenceUrl ? <a href={row.evidenceUrl} target="_blank" rel="noreferrer">Open evidence ↗</a> : null}</article><article><span>CONTEXT</span><b>{row.notes || "No extra notes"}</b><small>Submitted {new Date(`${row.createdAt}Z`).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</small></article></div><AnalysisEditor analysis={{ id: row.id, publicId: row.publicId, email: row.email, status: row.status, jobPublicId: job?.publicId || null, jobStatus: job?.status || null, highestImpactMistake: row.highestImpactMistake || "", whyItCosts: row.whyItCosts || "", evidenceMoments: parseLines(row.evidenceMoments).join("\n"), nextQueueRule: row.nextQueueRule || "", practicePlan: parseLines(row.practicePlan).join("\n"), coachNote: row.coachNote || "" }} /></section></main>;
}
