import { desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireChatGPTUser } from "../chatgpt-auth";
import { getDb } from "../../db";
import { rlReviewCandidates, rlReviewImports, rlReviewLabels, rlReviewers } from "../../db/schema";
import { isConfiguredSiteAdmin } from "../../lib/admin";
import { localReviewAvailable } from "../../lib/local-review-auth.mjs";
import { percentage, reviewerOperationsSummary } from "../../lib/rl-quality";
import { splitRlReviewPasses } from "../../lib/rl-review";
import ReviewerAccessForm from "../admin/ReviewerAccessForm";
import ReviewQueueImport from "../admin/ReviewQueueImport";
import { LocalReviewLogoutButton } from "../local-review-access/LocalReviewAccessForm";

export const dynamic = "force-dynamic";

const qualified = new Set(["competitive_player", "rocket_league_coach", "replay_analyst"]);

export default async function LocalReviewOwnerPage() {
  const requestHeaders = await headers();
  const { env } = await import("cloudflare:workers");
  if (!localReviewAvailable(env, requestHeaders)) notFound();

  const user = await requireChatGPTUser("/local-review-owner");
  if (user.localRole !== "owner" || !await isConfiguredSiteAdmin(user)) notFound();

  const db = await getDb();
  const [candidates, labels, reviewers, imports] = await Promise.all([
    db.select().from(rlReviewCandidates).where(eq(rlReviewCandidates.active, true)).orderBy(rlReviewCandidates.candidateKey).limit(1000),
    db.select().from(rlReviewLabels).orderBy(desc(rlReviewLabels.createdAt), desc(rlReviewLabels.id)).limit(10000),
    db.select().from(rlReviewers).orderBy(desc(rlReviewers.updatedAt), desc(rlReviewers.id)).limit(100),
    db.select().from(rlReviewImports).orderBy(desc(rlReviewImports.updatedAt), desc(rlReviewImports.id)).limit(10),
  ]);

  const activeReviewers = reviewers.filter(reviewer => reviewer.status === "active" && qualified.has(reviewer.qualification));
  const summary = reviewerOperationsSummary(candidates, labels);
  const passes = splitRlReviewPasses(candidates);
  const latestImport = imports[0];

  return <main className="local-owner-shell">
    <nav className="local-owner-nav">
      <div><span className="logo" aria-hidden="true" /><b>Replay Method</b><i>ENGINE CALIBRATION</i></div>
      <div><span>{user.displayName}</span><Link href="/admin?view=full">Full operations ↗</Link></div>
    </nav>

    <section className="local-owner-hero">
      <div><span>PRIVATE REVIEW LAB · LOCAL ONLY</span><h1>Teach the engine<br />what good looks like.</h1></div>
      <p>This is the focused control room for human calibration—not the customer product. Lock the evidence, verify two real reviewers, then judge Pass 1 independently.</p>
    </section>

    <section className="local-owner-status">
      <article className={latestImport ? "ready" : "attention"}><span>01 · EVIDENCE</span><b>{candidates.length || "—"}</b><h2>{latestImport ? "Queue locked" : "Import required"}</h2><p>{latestImport ? `${latestImport.replayCount} real replays · ${latestImport.holdoutOverlapCount} holdout overlap` : "The exact owner-authorized artifacts must be imported before review."}</p></article>
      <article className={activeReviewers.length >= 2 ? "ready" : "attention"}><span>02 · PEOPLE</span><b>{activeReviewers.length}/2</b><h2>{activeReviewers.length >= 2 ? "Reviewers ready" : "Verify reviewers"}</h2><p>Two independent qualified humans. Nobody sees another reviewer&apos;s judgment.</p></article>
      <article className={summary.doubleReviewed >= passes.first.length && passes.first.length > 0 ? "ready" : "idle"}><span>03 · PASS 1</span><b>{summary.doubleReviewed}/{passes.first.length}</b><h2>{summary.doubleReviewed >= passes.first.length && passes.first.length > 0 ? "Pass complete" : "Blind judgment"}</h2><p>{labels.length} saved label events · disagreement stays unresolved, never forced.</p></article>
    </section>

    <section className="local-owner-actions">
      <div><span>NEXT MOVE</span><h2>{activeReviewers.length < 2 ? "Bring in two real reviewers." : "Open the blind queue."}</h2><p>{activeReviewers.length < 2
        ? "Each reviewer signs in with the separate reviewer code. Their request appears below; verify real Rocket League experience before activation."
        : "Both reviewers should complete Pass 1 in separate browser profiles without discussing individual moments."}</p></div>
      <div className="local-owner-action-links">
        <Link className="primary" href="/admin/rl-review">{activeReviewers.length < 2 ? "REGISTER THIS IDENTITY" : "OPEN PASS 1"}<b>→</b></Link>
        <Link href="/local-review-access">REVIEWER SIGN-IN PAGE</Link>
      </div>
    </section>

    {!latestImport && <section className="local-owner-import"><ReviewQueueImport /></section>}

    <section className="local-owner-reviewers">
      <header><div><span>REVIEWER ACCESS</span><h2>{reviewers.length ? "Verify the humans." : "No reviewer requests yet."}</h2></div><p>Real qualification only. Test identities and owner-control labels remain excluded from detector evidence.</p></header>
      {reviewers.length === 0
        ? <div className="local-owner-empty"><b>Waiting for the first sign-in.</b><p>Open the reviewer sign-in page in another browser profile and use the reviewer code printed in the local terminal.</p></div>
        : <div className="local-owner-reviewer-grid">{reviewers.map(reviewer => <article key={reviewer.id}><div className="local-owner-reviewer-head"><div><b>{reviewer.displayName || reviewer.email}</b><span>{reviewer.email}</span></div><i className={reviewer.status}>{reviewer.status}</i></div><small>{reviewer.publicId.slice(0, 10).toUpperCase()} · {reviewer.platform ?? "platform unverified"}</small><ReviewerAccessForm reviewer={{ id: reviewer.id, status: reviewer.status, qualification: reviewer.qualification, playlistQualificationsJson: reviewer.playlistQualificationsJson, platform: reviewer.platform, qualificationNotes: reviewer.qualificationNotes }} /></article>)}</div>}
    </section>

    <footer className="local-owner-footer"><div><b>Holdout closed.</b><span>{summary.candidates} candidates · agreement {percentage(summary.agreement, 1)} · no public coaching changes</span></div><LocalReviewLogoutButton /></footer>
  </main>;
}
