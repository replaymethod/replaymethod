import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { rlReviewCandidates, rlReviewLabels } from "../../../db/schema";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { ensureRlReviewerApplicant } from "../../../lib/admin";
import { detectorName, ensureRlReviewQueueSeeded, RL_LABEL_SET_VERSION, RL_REVIEW_CANDIDATE_KEYS } from "../../../lib/rl-review";
import reviewMoments from "../../../docs/RL_REVIEW_MOMENTS.json";
import ReviewCandidateForm from "./ReviewCandidateForm";
import ReplayMomentViewer, { type ReplayMoment } from "./ReplayMomentViewer";

export const dynamic = "force-dynamic";

type SearchParams = { detector?: string; verdict?: string; page?: string };
const pageSize = 6;

export default async function RlReviewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireChatGPTUser("/admin/rl-review");
  const reviewer = await ensureRlReviewerApplicant(user);
  if (!reviewer) return <main className="admin-denied"><div><span>REPLAY METHOD REVIEW</span><h1>A stable account ID is required.</h1><p>Sign in again before requesting reviewer access.</p><Link href="/">Return home</Link></div></main>;
  if (reviewer.status !== "active") return <main className="admin-denied"><div><span>REVIEWER ACCESS · {reviewer.status.toUpperCase()}</span><h1>{reviewer.status === "revoked" ? "Reviewer access is revoked." : "Your reviewer request is recorded."}</h1><p>{reviewer.status === "revoked" ? "This identity can no longer submit labels." : "The owner must verify your Rocket League qualification before any candidate is shown."}</p><small>{reviewer.email} · stable reviewer {reviewer.publicId.slice(0, 10).toUpperCase()}</small><Link href="/">Return home</Link></div></main>;

  await ensureRlReviewQueueSeeded();
  const db = await getDb();
  const [storedCandidates, labelHistory] = await Promise.all([
    db.select().from(rlReviewCandidates).orderBy(asc(rlReviewCandidates.detectorId), asc(rlReviewCandidates.id)),
    db.select().from(rlReviewLabels).where(eq(rlReviewLabels.reviewerId, reviewer.id)).orderBy(asc(rlReviewLabels.id))
  ]);
  const candidates = storedCandidates.filter(candidate => RL_REVIEW_CANDIDATE_KEYS.has(candidate.candidateKey));
  const latestLabels = new Map<number, typeof labelHistory[number]>();
  for (const label of labelHistory) latestLabels.set(label.candidateId, label);
  const params = await searchParams;
  const detectorIds = [...new Set(candidates.map(row => row.detectorId))];
  const personalVerdict = (id: number) => latestLabels.get(id)?.verdict ?? "unreviewed";
  const filtered = candidates.filter(row => (
    (!params.detector || row.detectorId === params.detector)
    && (!params.verdict || personalVerdict(row.id) === params.verdict)
  ));
  const reviewed = candidates.filter(row => personalVerdict(row.id) !== "unreviewed").length;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const requestedPage = Math.max(1, Number(params.page || "1") || 1);
  const currentPage = Math.min(requestedPage, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const momentArtifact = reviewMoments as unknown as { moments: Record<string, ReplayMoment> };
  const pageUrl = (page: number) => {
    const query = new URLSearchParams();
    if (params.detector) query.set("detector", params.detector);
    if (params.verdict) query.set("verdict", params.verdict);
    query.set("page", String(page));
    return `/admin/rl-review?${query}`;
  };

  return <main className="rl-review-page"><section className="rl-review-shell">
    <nav className="rl-review-nav"><Link href="/">↻ Replay Method</Link><div><span>{reviewer.displayName || reviewer.email}</span><b>{reviewer.qualification.replaceAll("_", " ")}</b></div></nav>
    <header className="rl-review-hero"><div><span>BLIND EXPERT REVIEW · {RL_LABEL_SET_VERSION}</span><h1>Judge the moment.<br />Not another reviewer.</h1><p>You see detector evidence and your own saved label only. Other reviewers’ decisions and aggregate verdicts remain hidden.</p></div><aside><span>YOUR PROGRESS</span><b>{reviewed} / {candidates.length}</b><small>Each candidate counts once for this stable identity</small></aside></header>

    <section className="rl-review-blind-note"><i>◉</i><div><b>Blindness is active</b><p>No consensus score, prior verdict or reviewer note is exposed in this queue.</p></div></section>

    <form className="rl-review-filters" action="/admin/rl-review">
      <label><span>DETECTOR</span><select name="detector" defaultValue={params.detector ?? ""}><option value="">All detectors</option>{detectorIds.map(id => <option value={id} key={id}>{detectorName(id)}</option>)}</select></label>
      <label><span>MY VERDICT</span><select name="verdict" defaultValue={params.verdict ?? ""}><option value="">All</option><option value="unreviewed">Unreviewed</option><option value="confirmed">Confirmed</option><option value="rejected">False positive</option><option value="uncertain">Uncertain</option></select></label>
      <button>Apply</button><Link href="/admin/rl-review">Clear</Link>
    </form>

    <section className="rl-review-list"><header><div><span>YOUR REVIEW QUEUE</span><h2>{filtered.length} candidates</h2></div><small>Page {currentPage} of {pageCount}</small></header>{pageRows.map(candidate => {
      const own = latestLabels.get(candidate.id);
      const observation = JSON.parse(candidate.observationJson) as Record<string, unknown>;
      const moment = momentArtifact.moments[candidate.candidateKey];
      const verdict = own?.verdict ?? "unreviewed";
      return <article className={`rl-candidate ${verdict}`} key={candidate.id}>
        <div className="rl-candidate-head"><div><span>{detectorName(candidate.detectorId)} · v{candidate.detectorVersion}</span><h3>{candidate.reviewQuestion}</h3></div><i>{verdict === "unreviewed" ? "YOUR LABEL: OPEN" : `YOUR LABEL: ${verdict}`}</i></div>
        {moment ? <ReplayMomentViewer moment={moment} /> : <div className="rl-moment-missing">Replay moment unavailable. Keep this candidate unreviewed until the source artifact is restored.</div>}
        <div className="rl-evidence"><div><span>MOMENT</span><b>{candidate.timestampSeconds == null ? "Unknown" : `${candidate.timestampSeconds.toFixed(2)}s`}</b><small>frame {candidate.frame ?? "—"}</small></div><div><span>REPLAY</span><b>{candidate.replayFingerprint}</b><small>{candidate.mode ?? "Unknown mode"} · patch {candidate.gameVersion ?? "unknown"}</small></div><pre>{JSON.stringify(observation, null, 2)}</pre></div>
        <ReviewCandidateForm candidate={{ id: candidate.id, verdict, timestampVerified: own?.timestampVerified ?? null, notes: own?.notes ?? null }} />
      </article>;
    })}</section>
    <nav className="rl-pagination"><Link aria-disabled={currentPage === 1} href={pageUrl(Math.max(1, currentPage - 1))}>← Previous</Link><span>{filtered.length ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}</span><Link aria-disabled={currentPage === pageCount} href={pageUrl(Math.min(pageCount, currentPage + 1))}>Next →</Link></nav>
  </section></main>;
}
