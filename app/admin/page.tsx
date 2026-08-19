import { desc } from "drizzle-orm";
import Link from "next/link";
import { requireChatGPTUser, chatGPTSignOutPath } from "../chatgpt-auth";
import { getDb } from "../../db";
import { analysisJobs, analysisRequests, analysisUsage, billingEvents, billingSubscriptions, emailDeliveries, funnelEvents, playerFocuses, rlReviewCandidates, waitlist } from "../../db/schema";
import DeleteLeadButton from "./DeleteLeadButton";

export const dynamic = "force-dynamic";

const gameLabels: Record<string, string> = { general: "General", league: "League of Legends", valorant: "VALORANT", "rocket-league": "Rocket League" };
const placementLabels: Record<string, string> = { launch_bar: "Launch bar", nav: "Navigation", hero_form: "Hero form", final_form: "Final form", mobile_sticky: "Mobile sticky", pricing_card: "Pricing card", climb_plan: "Climb plan", hero_free_check: "Hero free check", hero_product_preview: "Hero sample report", hero_beta_link: "Hero beta link", nav_free_check: "Navigation free check", mobile_free_check: "Mobile free check", pricing_free: "Pricing free check", demo_beta: "Sample report beta CTA", climb_check_result_form: "Climb Check result form", free_layer: "Free value section", free_layer_beta: "Free section beta CTA" };
const percent = (part: number, total: number) => total ? `${((part / total) * 100).toFixed(1)}%` : "—";

export default async function AdminPage() {
  const user = await requireChatGPTUser("/admin");
  const { env } = await import("cloudflare:workers");
  const adminEmail = (env as unknown as { ADMIN_EMAIL?: string }).ADMIN_EMAIL?.toLowerCase();

  if (!adminEmail || user.email.toLowerCase() !== adminEmail) {
    return <main className="admin-denied"><div><span>REPLAY METHOD ADMIN</span><h1>Access denied.</h1><p>This dashboard is restricted to the site owner.</p><Link href="/">Return to Replay Method</Link></div></main>;
  }

  const db = await getDb();
  const [leads, events, analyses, jobs, subscriptions, usage, deliveries, focuses, billingEventRows, reviewCandidates] = await Promise.all([
    db.select().from(waitlist).orderBy(desc(waitlist.createdAt), desc(waitlist.id)).limit(5000),
    db.select().from(funnelEvents).orderBy(desc(funnelEvents.createdAt), desc(funnelEvents.id)).limit(20000),
    db.select().from(analysisRequests).orderBy(desc(analysisRequests.createdAt), desc(analysisRequests.id)).limit(1000),
    db.select().from(analysisJobs).orderBy(desc(analysisJobs.createdAt), desc(analysisJobs.id)).limit(1000),
    db.select().from(billingSubscriptions).orderBy(desc(billingSubscriptions.updatedAt), desc(billingSubscriptions.id)).limit(5000),
    db.select().from(analysisUsage).orderBy(desc(analysisUsage.updatedAt), desc(analysisUsage.id)).limit(5000),
    db.select().from(emailDeliveries).orderBy(desc(emailDeliveries.updatedAt), desc(emailDeliveries.id)).limit(5000),
    db.select().from(playerFocuses).orderBy(desc(playerFocuses.updatedAt), desc(playerFocuses.id)).limit(5000),
    db.select().from(billingEvents).orderBy(desc(billingEvents.updatedAt), desc(billingEvents.id)).limit(5000),
    db.select().from(rlReviewCandidates).orderBy(desc(rlReviewCandidates.updatedAt), desc(rlReviewCandidates.id)).limit(5000)
  ]);

  const uniqueFor = (event: string, game?: string) => new Set(events.filter(row => row.event === event && (!game || row.game === game)).map(row => row.visitorId)).size;
  const visitors = uniqueFor("page_view");
  const uniqueEmails = new Set(leads.map(row => row.email.toLowerCase())).size;
  const readyAnalyses = analyses.filter(row => row.status === "ready").length;
  const runningAnalyses = jobs.filter(row => ["queued", "running", "retry"].includes(row.status)).length;
  const blockedAnalyses = analyses.filter(row => row.status === "blocked").length;
  const failedAnalyses = analyses.filter(row => row.status === "failed").length;
  const completedJobs = jobs.filter(row => row.status === "completed" && row.durationMs != null);
  const averageDuration = completedJobs.length ? `${(completedJobs.reduce((sum, row) => sum + (row.durationMs || 0), 0) / completedJobs.length / 1000).toFixed(1)}s` : "—";
  const estimatedCost = jobs.reduce((sum, row) => sum + row.estimatedCostMicros, 0) / 1_000_000;
  const jobByRequest = new Map(jobs.map(job => [job.analysisRequestId, job]));
  const ratedAnalyses = analyses.filter(row => row.feedbackScore);
  const averageRating = ratedAnalyses.length ? (ratedAnalyses.reduce((sum, row) => sum + (row.feedbackScore || 0), 0) / ratedAnalyses.length).toFixed(1) : "—";
  const paidActive = subscriptions.filter(row => ["active", "trialing"].includes(row.status)).length;
  const pastDue = subscriptions.filter(row => row.status === "past_due").length;
  const canceling = subscriptions.filter(row => row.cancelAtPeriodEnd).length;
  const billingAttention = billingEventRows.filter(row => row.status === "failed").length;
  const consumedUsage = usage.filter(row => row.status === "consumed").length;
  const reservedUsage = usage.filter(row => row.status === "reserved").length;
  const acceptedEmails = deliveries.filter(row => row.status === "accepted").length;
  const emailAttention = deliveries.filter(row => row.status !== "accepted" && Boolean(row.lastErrorCode)).length;
  const activeFocuses = focuses.filter(row => row.status === "active").length;
  const completedFocuses = focuses.filter(row => row.status === "completed").length;
  const unreviewedCandidates = reviewCandidates.filter(row => row.verdict === "unreviewed").length;
  const games = ["general", "league", "valorant", "rocket-league"];
  const gameStats = games.map(game => ({ game, views: uniqueFor("page_view", game), signups: uniqueFor("signup", game), leads: leads.filter(row => row.game === game).length }));

  const placementVisitors = events.filter(row => row.event === "cta_click").reduce<Record<string, Set<string>>>((acc, row) => {
    (acc[row.placement] ??= new Set()).add(row.visitorId);
    return acc;
  }, {});
  const topPlacements = Object.entries(placementVisitors).map(([name, ids]) => ({ name, count: ids.size })).sort((a, b) => b.count - a.count).slice(0, 8);
  const sourceCounts = leads.reduce<Record<string, number>>((acc, row) => { acc[row.source] = (acc[row.source] ?? 0) + 1; return acc; }, {});
  const topSources = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

  return <main className="admin-shell">
    <header className="admin-top"><div><span>↻</span><b>Replay Method operations</b></div><div><span>{user.email}</span><a href={chatGPTSignOutPath("/")}>Sign out</a></div></header>
    <section className="admin-heading"><div><span>MISSION CONTROL</span><h1>{analyses.length} match analyses</h1><p>Monitor automated ingestion, failures, coaching quality and the real improvement funnel from one place.</p></div><div className="admin-heading-actions"><Link className="export-button" href="/admin/rl-review">RL review lab →</Link><Link className="export-button" href="/api/admin/waitlist">Waitlist CSV ↓</Link></div></section>
    <section className="admin-launch"><div><span>READY-TO-POST LINKS</span><b>Send TikTok traffic to a real free analysis—not only the waitlist.</b></div><Link href="/analyze?utm_source=tiktok&utm_campaign=free-analysis-01">Free analysis ↗</Link><Link href="/league?utm_source=tiktok&utm_campaign=league-01">League ↗</Link><Link href="/valorant?utm_source=tiktok&utm_campaign=valorant-01">VALORANT ↗</Link><Link href="/rocket-league?utm_source=tiktok&utm_campaign=rocketleague-01">Rocket League ↗</Link></section>
    <section className="admin-stats"><article><span>Running / queued</span><b>{runningAnalyses}</b></article><article><span>Reports ready</span><b>{readyAnalyses}</b></article><article><span>Blocked</span><b>{blockedAnalyses}</b></article><article><span>Failed</span><b>{failedAnalyses}</b></article><article><span>Avg. processing</span><b>{averageDuration}</b></article><article><span>Estimated engine cost</span><b>${estimatedCost.toFixed(4)}</b></article><article><span>Avg. report rating</span><b>{averageRating}</b></article><article><span>Unique visits</span><b>{visitors}</b></article><article><span>Analysis submitted</span><b>{uniqueFor("analysis_submit")}</b></article></section>

    <section className="admin-operations"><div className="admin-section-title"><div><span>SYSTEM STATE</span><h2>Operational truth</h2></div><small>Persisted records only. Counts are not forecasts or synthetic health scores.</small></div><div className="admin-operation-grid"><article><span>BILLING</span><b>{paidActive} active / trialing</b><small>{pastDue} past due · {canceling} canceling · {billingAttention} failed events</small></article><article><span>ENTITLEMENTS</span><b>{consumedUsage} consumed</b><small>{reservedUsage} reservations in flight</small></article><article><span>TRANSACTIONAL EMAIL</span><b>{acceptedEmails} accepted</b><small>{emailAttention} blocked, retrying or failed</small></article><article><span>PLAYER FOCUS</span><b>{activeFocuses} active</b><small>{completedFocuses} completed focuses retained</small></article><article><span>RL CALIBRATION</span><b>{unreviewedCandidates} unreviewed</b><small>{reviewCandidates.length - unreviewedCandidates} expert decisions saved</small><Link href="/admin/rl-review">Open review queue →</Link></article></div></section>

    <section className="admin-analysis-wrap"><div className="admin-section-title"><div><span>AUTOMATED ANALYSIS QUEUE</span><h2>Jobs and quality review</h2></div><small>Open an item to inspect evidence, engine versions, retry safely or apply a quality override.</small></div>{analyses.length === 0 ? <div className="admin-empty"><b>No match submissions yet.</b><p>Send someone to the free analysis link above.</p></div> : <div className="admin-analysis-list">{analyses.map(row => { const job = jobByRequest.get(row.id); return <Link href={`/admin/analyses/${row.id}`} key={row.id}><i className={row.status}>{row.status === "ready" ? "✓" : row.status === "failed" || row.status === "blocked" ? "!" : row.status === "analyzing" ? "↻" : "↓"}</i><div><span>{gameLabels[row.game] ?? row.game} · {row.currentRank}{row.targetRank ? ` → ${row.targetRank}` : ""}</span><b>{row.goal}</b><small>{job?.stageLabel || "Legacy quality-review workflow"} · {row.email} · {new Date(`${row.createdAt}Z`).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</small></div><em className={row.status}>{row.status} →</em></Link>; })}</div>}</section>

    <section className="admin-funnel-grid">
      <article className="admin-panel"><h2>Conversion by game</h2><div className="admin-funnel-row"><span>Funnel</span><b>Views</b><b>Emails</b><b>CVR</b></div>{gameStats.map(row => <div className="admin-funnel-row" key={row.game}><span>{gameLabels[row.game]}</span><b>{row.views}</b><b>{row.leads}</b><b>{percent(row.signups, row.views)}</b></div>)}</article>
      <article className="admin-panel"><h2>CTA clicks by placement</h2>{topPlacements.length ? topPlacements.map(row => <div className="admin-funnel-row" key={row.name}><span>{placementLabels[row.name] ?? row.name}</span><b>{row.count}</b><b>people</b><b>{percent(row.count, visitors)}</b></div>) : <div className="admin-empty"><b>No click data yet.</b><p>It starts recording with this launch.</p></div>}</article>
    </section>

    <section className="admin-panel"><h2>Lead sources</h2><div className="admin-source-list">{topSources.length ? topSources.map(([source, count]) => <span key={source}>{source} <b>{count}</b></span>) : <span>No sources yet</span>}</div></section>

    <section className="admin-section-title waitlist-heading"><div><span>MARKETING LIST</span><h2>{uniqueEmails} unique emails</h2></div><small>{leads.length} game-specific registrations.</small></section>
    <section className="admin-table-wrap"><div className="admin-table-head analytics"><span>Subscriber</span><span>Funnel</span><span>Source</span><span>Joined</span><span>Control</span></div>{leads.length === 0 ? <div className="admin-empty"><b>No signups yet.</b><p>Optional product-update consent from beta submissions will also appear here.</p></div> : leads.map(row => <div className="admin-row analytics" key={row.id}><span><a className="admin-email" href={`mailto:${row.email}`}>{row.email}</a></span><span><i>{gameLabels[row.game] ?? row.game}</i></span><span>{row.source}<br />{row.campaign && <em>{row.campaign}</em>}</span><span>{new Date(`${row.createdAt}Z`).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span><span><DeleteLeadButton id={row.id} email={row.email} /></span></div>)}</section>
  </main>;
}
