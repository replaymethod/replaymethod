import Link from "next/link";
import { asc } from "drizzle-orm";
import { getDb } from "../../../db";
import { rlReviewCandidates } from "../../../db/schema";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { detectorName, ensureRlReviewQueueSeeded, RL_LABEL_SET_VERSION } from "../../../lib/rl-review";
import { detectorQualitySummary, percentage as qualityPercentage } from "../../../lib/rl-quality";
import reviewMoments from "../../../docs/RL_REVIEW_MOMENTS.json";
import ReviewCandidateForm from "./ReviewCandidateForm";
import ReplayMomentViewer, { type ReplayMoment } from "./ReplayMomentViewer";

export const dynamic = "force-dynamic";

type SearchParams = { detector?: string; verdict?: string; replay?: string; page?: string };
const pageSize = 8;
const ratioPercentage = (value: number, total: number) => total ? `${Math.round(value / total * 100)}%` : "—";

export default async function RlReviewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireChatGPTUser("/admin/rl-review");
  const { env } = await import("cloudflare:workers");
  const adminEmail = (env as unknown as { ADMIN_EMAIL?: string }).ADMIN_EMAIL?.toLowerCase();
  if (!adminEmail || user.email.toLowerCase() !== adminEmail) return <main className="admin-denied"><div><span>REPLAY METHOD ADMIN</span><h1>Access denied.</h1><Link href="/">Return home</Link></div></main>;

  await ensureRlReviewQueueSeeded();
  const db = await getDb();
  const candidates = await db.select().from(rlReviewCandidates).orderBy(asc(rlReviewCandidates.detectorId), asc(rlReviewCandidates.id));
  const params = await searchParams;
  const detectorIds = [...new Set(candidates.map(row => row.detectorId))];
  const replayIds = [...new Set(candidates.map(row => row.replayFingerprint))];
  const reviewed = candidates.filter(row => row.verdict !== "unreviewed");
  const confirmed = candidates.filter(row => row.verdict === "confirmed").length;
  const rejected = candidates.filter(row => row.verdict === "rejected").length;
  const uncertain = candidates.filter(row => row.verdict === "uncertain").length;
  const timestampChecked = reviewed.filter(row => row.timestampVerified != null);
  const timestampVerified = timestampChecked.filter(row => row.timestampVerified).length;
  const detectorStats = detectorIds.map(detectorId => {
    const rows = candidates.filter(row => row.detectorId === detectorId);
    return { detectorId, ...detectorQualitySummary(rows) };
  });
  const momentArtifact = reviewMoments as unknown as { schemaVersion: string; candidateCount: number; replayCount: number; moments: Record<string, ReplayMoment> };

  const filtered = candidates.filter(row => (!params.detector || row.detectorId === params.detector) && (!params.verdict || row.verdict === params.verdict) && (!params.replay || row.replayFingerprint === params.replay));
  const requestedPage = Math.max(1, Number(params.page) || 1);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(requestedPage, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const pageUrl = (page: number) => {
    const query = new URLSearchParams();
    if (params.detector) query.set("detector", params.detector);
    if (params.verdict) query.set("verdict", params.verdict);
    if (params.replay) query.set("replay", params.replay);
    query.set("page", String(page));
    return `/admin/rl-review?${query}`;
  };

  return <main className="rl-review-page"><nav className="editor-nav shell"><Link href="/admin">← Mission control</Link><div className="brand"><span className="logo">↻</span><span>replay<span>method</span></span></div><span className="rl-private">PRIVATE CALIBRATION</span></nav><section className="rl-review-shell shell"><header className="rl-review-heading"><div><span>ROCKET LEAGUE · EXPERT REVIEW</span><h1>Teach the engine what is actually useful.</h1><p>Review shadow-detector candidates before any detector is allowed to influence a public player report.</p></div><aside><span>LABEL SET</span><b>{RL_LABEL_SET_VERSION}</b><small>{reviewed.length} decisions saved with audit history</small></aside></header>
    <section className="rl-review-stats"><article><span>Progress</span><b>{ratioPercentage(reviewed.length, candidates.length)}</b><small>{reviewed.length} / {candidates.length}</small></article><article><span>Confirmed</span><b>{confirmed}</b><small>useful signals</small></article><article><span>False positives</span><b>{rejected}</b><small>rejected candidates</small></article><article><span>Uncertain</span><b>{uncertain}</b><small>needs more context</small></article><article><span>Timestamp accuracy</span><b>{ratioPercentage(timestampVerified, timestampChecked.length)}</b><small>{timestampChecked.length} checked</small></article><article><span>Replay moments</span><b>{momentArtifact.candidateCount}</b><small>{momentArtifact.replayCount} anonymized replays</small></article></section>
    <section className="rl-detector-grid">{detectorStats.map(stat => <article key={stat.detectorId} className={stat.gate.eligible ? "eligible" : "blocked"}><div className="rl-detector-title"><span>{detectorName(stat.detectorId)}</span><em>{stat.gate.eligible ? "PUBLIC READY" : `${stat.gate.blockedBy.length} GATES OPEN`}</em></div><h2>{stat.precision == null ? "No score yet" : `${qualityPercentage(stat.precision)} accepted`}</h2><p>{stat.reviewed}/{stat.total} reviewed · {stat.replayCount} source replays</p><div className="rl-review-progress"><i style={{ width: `${stat.total ? stat.reviewed / stat.total * 100 : 0}%` }} /></div><small>{stat.reviewedPositives} confirmed · {stat.reviewedNegatives} rejected · confidence floor {qualityPercentage(stat.precisionLowerBound)}</small><details><summary>Quality gate</summary><ul>{stat.gate.checks.map(check => <li className={check.passed ? "passed" : "blocked"} key={check.id}>{check.passed ? "✓" : "○"} {check.label}</li>)}</ul></details></article>)}</section>
    <form className="rl-review-filters" action="/admin/rl-review"><label><span>DETECTOR</span><select name="detector" defaultValue={params.detector ?? ""}><option value="">All detectors</option>{detectorIds.map(id => <option value={id} key={id}>{detectorName(id)}</option>)}</select></label><label><span>VERDICT</span><select name="verdict" defaultValue={params.verdict ?? ""}><option value="">All verdicts</option><option value="unreviewed">Unreviewed</option><option value="confirmed">Confirmed</option><option value="rejected">False positive</option><option value="uncertain">Uncertain</option></select></label><label><span>REPLAY</span><select name="replay" defaultValue={params.replay ?? ""}><option value="">All replays</option>{replayIds.map(id => <option value={id} key={id}>{id}</option>)}</select></label><button>Apply filters</button><Link href="/admin/rl-review">Clear</Link></form>
    <section className="rl-review-list"><header><div><span>REVIEW QUEUE</span><h2>{filtered.length} candidates</h2></div><small>Page {currentPage} of {pageCount}</small></header>{pageRows.map(candidate => { const observation = JSON.parse(candidate.observationJson) as Record<string, unknown>; const moment = momentArtifact.moments[candidate.candidateKey]; return <article className={`rl-candidate ${candidate.verdict}`} key={candidate.id}><div className="rl-candidate-head"><div><span>{detectorName(candidate.detectorId)} · v{candidate.detectorVersion}</span><h3>{candidate.reviewQuestion}</h3></div><i>{candidate.verdict}</i></div>{moment ? <ReplayMomentViewer moment={moment} /> : <div className="rl-moment-missing">Replay moment unavailable. Keep this candidate unreviewed until the source artifact is restored.</div>}<div className="rl-evidence"><div><span>MOMENT</span><b>{candidate.timestampSeconds == null ? "Unknown" : `${candidate.timestampSeconds.toFixed(2)}s`}</b><small>frame {candidate.frame ?? "—"}</small></div><div><span>REPLAY</span><b>{candidate.replayFingerprint}</b><small>{candidate.mode ?? "Unknown mode"} · patch {candidate.gameVersion ?? "unknown"}</small></div><pre>{JSON.stringify(observation, null, 2)}</pre></div><ReviewCandidateForm candidate={{ id: candidate.id, verdict: candidate.verdict, timestampVerified: candidate.timestampVerified, notes: candidate.notes }} /></article>; })}</section>
    <nav className="rl-pagination"><Link aria-disabled={currentPage === 1} href={pageUrl(Math.max(1, currentPage - 1))}>← Previous</Link><span>{(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}</span><Link aria-disabled={currentPage === pageCount} href={pageUrl(Math.min(pageCount, currentPage + 1))}>Next →</Link></nav>
  </section></main>;
}
