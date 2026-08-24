"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PublicReportData } from "../../../lib/report-data";
import { trackProductEvent } from "../../../lib/client-analytics";

const stages = [
  { key: "queued", label: "Received" },
  { key: "ingesting", label: "Read match" },
  { key: "normalizing", label: "Build timeline" },
  { key: "detecting", label: "Find patterns" },
  { key: "coaching", label: "Prioritize" },
  { key: "completed", label: "Report ready" }
] as const;

const stageOrder: Record<string, number> = {
  queued: 0,
  validating: 1,
  ingesting: 1,
  normalizing: 2,
  detecting: 3,
  coaching: 4,
  persisting: 4,
  completed: 5
};

const rocketLeagueRanks = [
  "Gold I", "Gold II", "Gold III",
  "Platinum I", "Platinum II", "Platinum III",
  "Diamond I", "Diamond II", "Diamond III",
  "Champion I", "Champion II", "Champion III",
  "Grand Champion I", "Grand Champion II", "Grand Champion III",
];

function utcTimestamp(value: string) {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  return new Date(/[zZ]$|[+-]\d{2}:?\d{2}$/.test(normalized) ? normalized : `${normalized}Z`).getTime();
}

function stopCopy(data: PublicReportData) {
  const code = data.processing?.errorCode;
  if (["rl_engine_unavailable", "rl_engine_timeout", "rl_engine_unreachable", "stale_running_lease"].includes(code || "")) return {
    kicker: data.processing?.status === "retry" ? "AUTOMATIC RETRY SCHEDULED" : "REPLAY WORKER TEMPORARILY UNAVAILABLE",
    title: "Your original replay is preserved for an automatic retry.",
    body: "No new upload, allowance or duplicate analysis is needed. Keep this private report link; the same job will resume automatically when the worker responds."
  };
  if (code === "rl_engine_not_configured") return {
    kicker: "AUTOMATION ACCESS PENDING",
    title: "Your replay is safe. The dedicated replay engine is not online yet.",
    body: "We preserved the original file and did not guess from incomplete data. This report can be reprocessed when the deterministic replay worker is connected."
  };
  if (["riot_production_access_required", "riot_rso_required", "riot_account_connection_required", "riot_match_ingestion_not_activated"].includes(code || "")) return {
    kicker: "RIOT CONNECTION PENDING",
    title: "This match needs an approved Riot account connection.",
    body: "Replay Method will not infer private match behavior from an unverified profile link. Your submission is preserved until the official opt-in integration is available."
  };
  if (["unsupported_or_invalid_replay", "invalid_replay", "empty_replay", "file_too_large", "raw_input_missing"].includes(code || "")) return {
    kicker: "MATCH COULD NOT BE READ",
    title: "We could not verify enough evidence to coach this match safely.",
    body: "Nothing was invented. Try a fresh replay from a completed match, or contact us if the file should be supported."
  };
  if (code === "detectors_not_calibrated" || code === "public_output_disabled") return {
    kicker: "REAL REPLAY VERIFIED · COACHING GATED",
    title: "The replay engine worked. It stopped before inventing advice.",
    body: `${data.processing?.stageLabel || "The player and match data were identified successfully."} This submission can be reprocessed when a validated detector set is enabled.`
  };
  if (code === "subject_player_required" || code === "subject_player_not_found" || code === "subject_player_ambiguous" || code === "replay_players_missing") return {
    kicker: "PLAYER IDENTITY NEEDED",
    title: "Replay read. Now choose yourself.",
    body: data.processing?.candidatePlayers.length
      ? "Choose your exact in-game name below. Your original private replay is preserved and will be retried without another upload."
      : "Use the exact in-game player name shown in that replay. Your original file is preserved, so support can retry it without another upload."
  };
  return data.status === "failed" ? {
    kicker: "ANALYSIS NEEDS ATTENTION",
    title: "We could not complete this analysis safely.",
    body: "Your submission is preserved. The failure is visible to Replay Method operations and can be retried without uploading the match again."
  } : {
    kicker: "ANALYSIS PAUSED",
    title: data.processing?.stageLabel || "This analysis needs another attempt.",
    body: "Your submission is preserved and no unsupported coaching has been generated."
  };
}

type ReportMoment = { label: string; text: string };

const performanceCategoryLabels: Record<string, string> = {
  offense_defense: "Offense & defense",
  kickoff: "Kickoffs",
  boost_economy: "Boost economy",
  movement_recovery: "Movement & recovery",
  possession_touches: "Possession & touches",
  positioning: "Positioning",
  positioning_teamplay: "Positioning & teamplay",
};

function gameClock(value: number | null | undefined) {
  if (!Number.isFinite(value)) return null;
  const seconds = Math.max(0, Math.floor(Number(value)));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function compressMoments(moments: ReportMoment[]) {
  const grouped = new Map<string, ReportMoment & { count: number }>();
  for (const moment of moments) {
    const key = moment.text.trim().toLocaleLowerCase("en-US");
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }
    grouped.set(key, { ...moment, count: 1 });
  }
  return [...grouped.values()];
}

export default function ReportClient({ initial, accessToken, delivery }: { initial: PublicReportData; accessToken: string; delivery: "email" | "link"; checkoutOpen: boolean }) {
  const [data, setData] = useState(initial);
  const [feedbackScore] = useState(initial.feedbackScore || 0);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSignals, setFeedbackSignals] = useState({ observation: "", moment: "", advice: "", plan: "" });
  const [caseStudyConsent, setCaseStudyConsent] = useState(false);
  const [feedbackState, setFeedbackState] = useState<"idle" | "saving" | "saved" | "error">(initial.feedbackScore ? "saved" : "idle");
  const [copied, setCopied] = useState(false);
  const [clock, setClock] = useState<number | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [selectedRank, setSelectedRank] = useState("");
  const [identityRetryState, setIdentityRetryState] = useState<"idle" | "saving" | "queued" | "error">("idle");
  const [interactive, setInteractive] = useState(false);

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => setInteractive(true), 0);
    const updateClock = () => setClock(Date.now());
    updateClock();
    const timer = window.setInterval(updateClock, 10000);
    return () => {
      window.clearTimeout(hydrationTimer);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("replaymethod-report-ids") || "[]") as string[];
    localStorage.setItem("replaymethod-report-ids", JSON.stringify([data.publicId, ...stored.filter(id => id !== data.publicId)].slice(0, 20)));
    if (accessToken) {
      const access = JSON.parse(localStorage.getItem("replaymethod-report-access") || "{}") as Record<string, string>;
      localStorage.setItem("replaymethod-report-access", JSON.stringify({ ...access, [data.publicId]: accessToken }));
    }
    const eventKey = `replaymethod-report-view-${data.publicId}`;
    if (!sessionStorage.getItem(eventKey)) {
      sessionStorage.setItem(eventKey, "1");
      trackProductEvent("report_view", data.game as "league" | "valorant" | "rocket-league", data.status);
    }
    if (data.status === "ready") {
      const completionKey = `replaymethod-analysis-completed-${data.publicId}`;
      if (!sessionStorage.getItem(completionKey)) {
        sessionStorage.setItem(completionKey, "1");
        trackProductEvent("analysis_completed", data.game as "league" | "valorant" | "rocket-league", "report_ready");
        trackProductEvent("evidence_viewed", data.game as "league" | "valorant" | "rocket-league", "report_reveal");
      }
    }
    const stopCode = data.processing?.errorCode || "";
    if (["subject_player_required", "subject_player_not_found", "subject_player_ambiguous", "detectors_not_calibrated", "public_output_disabled"].includes(stopCode)) {
      const parseKey = `replaymethod-parse-complete-${data.publicId}`;
      if (!sessionStorage.getItem(parseKey)) {
        sessionStorage.setItem(parseKey, "1");
        trackProductEvent("parse_complete", data.game as "league" | "valorant" | "rocket-league", "replay_verified");
        if (data.processing?.replayContext.mode) trackProductEvent("mode_detected", data.game as "league" | "valorant" | "rocket-league", data.processing.replayContext.mode);
      }
    }
    if (["detectors_not_calibrated", "public_output_disabled"].includes(stopCode)) {
      const abstentionKey = `replaymethod-abstention-${data.publicId}`;
      if (!sessionStorage.getItem(abstentionKey)) {
        sessionStorage.setItem(abstentionKey, "1");
        trackProductEvent("abstention", data.game as "league" | "valorant" | "rocket-league", stopCode);
      }
    }
    if (data.earlyAccess?.coachingStatus === "abstained") {
      const abstentionKey = `replaymethod-early-access-abstention-${data.publicId}`;
      if (!sessionStorage.getItem(abstentionKey)) {
        sessionStorage.setItem(abstentionKey, "1");
        trackProductEvent("abstention", data.game as "league" | "valorant" | "rocket-league", "early_access_no_supported_finding");
      }
    }
  }, [accessToken, data.earlyAccess?.coachingStatus, data.game, data.processing?.errorCode, data.processing?.replayContext.mode, data.publicId, data.status]);

  useEffect(() => {
    if (["ready", "blocked", "failed"].includes(data.status)) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const response = await fetch(`/api/analyses/${data.publicId}`, { cache: "no-store", headers: accessToken ? { "X-Report-Access": accessToken } : undefined });
        if (response.ok && !cancelled) setData(await response.json() as PublicReportData);
      } catch { /* next poll retries */ }
    };
    void refresh();
    const timer = window.setInterval(refresh, 10000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [accessToken, data.publicId, data.status]);

  const copyLink = async () => {
    trackProductEvent("share_started", data.game as "league" | "valorant" | "rocket-league", "private_link");
    await navigator.clipboard.writeText(location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const scrollToFocusPlan = () => {
    const target = document.getElementById("action-plan");
    if (!target) return;
    target.tabIndex = -1;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    target.focus({ preventScroll: true });
  };

  const saveFeedback = async () => {
    const score = feedbackScore || (feedbackSignals.observation === "yes" ? 5 : feedbackSignals.observation === "not_sure" ? 3 : feedbackSignals.observation === "no" ? 1 : 0);
    if (!score) return;
    setFeedbackState("saving");
    const structuredFeedback = [
      `Observation matched: ${feedbackSignals.observation || "not answered"}`,
      `Moment was correct: ${feedbackSignals.moment || "not answered"}`,
      `Advice was clear: ${feedbackSignals.advice || "not answered"}`,
      `Will test the rule: ${feedbackSignals.plan || "not answered"}`,
      feedbackText.trim() ? `Comment: ${feedbackText.trim()}` : "",
    ].filter(Boolean).join("\n");
    const response = await fetch(`/api/analyses/${data.publicId}/feedback`, { method: "POST", headers: { "Content-Type": "application/json", ...(accessToken ? { "X-Report-Access": accessToken } : {}) }, body: JSON.stringify({ score, text: structuredFeedback, caseStudyConsent }) });
    setFeedbackState(response.ok ? "saved" : "error");
    if (response.ok) {
      trackProductEvent("feedback", data.game as "league" | "valorant" | "rocket-league", `score_${score}`);
    }
  };

  const retryWithPlayer = async () => {
    if (!selectedPlayer) return;
    setIdentityRetryState("saving");
    try {
      trackProductEvent("player_pick", data.game as "league" | "valorant" | "rocket-league", data.processing?.replayContext.mode || "unknown_mode");
      const response = await fetch(`/api/analyses/${data.publicId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(accessToken ? { "X-Report-Access": accessToken } : {}) },
        body: JSON.stringify({ player: selectedPlayer, rank: selectedRank }),
      });
      if (!response.ok) {
        setIdentityRetryState("error");
        return;
      }
      setIdentityRetryState("queued");
      setData(previous => ({
        ...previous,
        status: "received",
        processing: previous.processing ? {
          ...previous.processing,
          status: "queued",
          stage: "queued",
          stageLabel: "Player selected · replay preserved",
          attempts: 0,
          errorCode: null,
          nextRetryAt: null,
          updatedAt: new Date().toISOString(),
          candidatePlayers: [],
        } : null,
      }));
    } catch {
      setIdentityRetryState("error");
    }
  };

  const statusIndex = data.status === "ready" ? stages.length - 1 : stageOrder[data.processing?.stage || "queued"] ?? 0;
  const processingTime = data.processing?.updatedAt ? utcTimestamp(data.processing.updatedAt) : 0;
  const stale = clock !== null && processingTime > 0 && !["ready", "blocked", "failed"].includes(data.status) && clock - processingTime >= 180_000;
  const stopped = data.status === "blocked" || data.status === "failed" || stale;
  const stoppedCopy = stale ? {
    kicker: "AUTOMATIC RECOVERY STARTED",
    title: "This analysis took too long. We are restarting it safely.",
    body: "You do not need to upload the replay again. Keep this private link open; the next status check will either continue the analysis or show a concrete reason it stopped."
  } : stopped ? stopCopy(data) : null;
  const identityResolvable = stopped && ["subject_player_required", "subject_player_not_found", "subject_player_ambiguous"].includes(data.processing?.errorCode || "") && Boolean(data.processing?.candidatePlayers.length);
  const evidence = data.report?.evidenceDetails.length
    ? data.report.evidenceDetails.map(item => ({
      label: item.round != null ? `ROUND · ${item.round}` : item.timestamp != null ? `MATCH TIME · ${Math.floor(item.timestamp / 60)}:${String(Math.floor(item.timestamp % 60)).padStart(2, "0")}` : item.label,
      text: item.description
    }))
    : (data.report?.evidenceMoments || []).map((text, index) => ({ label: `Evidence ${index + 1}`, text }));
  const groupedEvidence = compressMoments(evidence);
  const experimental = data.earlyAccess?.coachingStatus === "experimental_insight";
  const playlist = data.verifiedFacts?.mode || data.processing?.replayContext.mode || "the same playlist";
  const performanceGroups = Object.entries((data.performance?.metrics || []).reduce<Record<string, NonNullable<typeof data.performance>["metrics"]>>((groups, metric) => {
    (groups[metric.category] ||= []).push(metric);
    return groups;
  }, {}));
  const momentFeed = [
    ...groupedEvidence.map((moment, index) => ({
      id: `coaching-${index}`,
      title: data.report?.highestImpactMistake || "Coaching evidence",
      timing: moment.label,
      context: experimental ? "Experimental coaching window" : "Supported coaching window",
      observation: moment.text,
      consequence: data.report?.whyItCosts || "This window contributed to the selected match-specific focus.",
      betterAlternative: data.report?.nextQueueRule || null,
      limitation: data.report?.limitations[0] || "This moment describes one match and cannot establish a stable habit.",
      kind: experimental ? "EXPERIMENTAL INTERPRETATION" : "CONTEXTUAL DETECTOR",
    })),
    ...(data.performance?.moments || []).map(moment => ({
      id: moment.id,
      title: moment.title,
      timing: gameClock(moment.gameClockSeconds) ? `GAME CLOCK · ${gameClock(moment.gameClockSeconds)}` : `ELAPSED · ${gameClock(moment.timestampSeconds)}`,
      context: moment.context,
      observation: moment.observation,
      consequence: moment.consequence,
      betterAlternative: moment.betterAlternative,
      limitation: moment.limitation,
      kind: moment.evidenceKind === "verified_telemetry" ? "VERIFIED TELEMETRY" : "DERIVED METRIC",
    })),
  ].filter((moment, index, moments) => moments.findIndex(candidate => candidate.id === moment.id) === index).slice(0, 5);
  const strongestMoments = momentFeed.slice(0, 3);
  const matchScore = data.performance?.match.teamScore != null && data.performance.match.opponentScore != null
    ? `${data.performance.match.teamScore}–${data.performance.match.opponentScore}` : "Score unavailable";
  const matchResult = data.performance?.match.result === "win" ? "WIN" : data.performance?.match.result === "loss" ? "LOSS" : data.performance?.match.result === "draw" ? "DRAW" : "MATCH";
  const factEntries = data.verifiedFacts ? [
    ["PLAYER", data.verifiedFacts.subjectDisplayName],
    ["PLAYLIST", data.verifiedFacts.mode],
    [data.verifiedFacts.rankProvenance === "verified_replay" ? "VERIFIED REPLAY RANK" : "PLAYER-SUBMITTED RANK", data.verifiedFacts.rank],
    ["PLAYERS", data.verifiedFacts.playerCount == null ? null : String(data.verifiedFacts.playerCount)],
    ["SAMPLED FRAMES", data.verifiedFacts.sampledFrames == null ? null : data.verifiedFacts.sampledFrames.toLocaleString("en-US")],
    ["DECISION EVENTS", data.verifiedFacts.decisionEvents == null ? null : data.verifiedFacts.decisionEvents.toLocaleString("en-US")],
    ["GAME VERSION", data.verifiedFacts.gameVersion],
    ["PARSER", data.verifiedFacts.parserVersion],
  ].filter((entry): entry is [string, string] => Boolean(entry[1])) : [];

  return <main className="report-page">
    <nav className="tool-nav shell"><Link className="brand" href="/"><span className="logo" aria-hidden="true" /><span>replay<span>method</span></span></Link><div><Link href="/reports">My reports</Link><button type="button" onClick={copyLink}>{copied ? "Copied ✓" : "Copy private link"}</button></div></nav>
    <section className="report-shell shell">
      <header className="report-top"><div><span>PRIVATE · OWNER-VERIFIED REPORT ACCESS</span><h1>{data.verifiedFacts?.subjectDisplayName || data.gameLabel}</h1><p>{data.verifiedFacts?.mode || data.processing?.replayContext.mode || "Playlist reading"}{data.verifiedFacts?.rank ? ` · ${data.verifiedFacts.rank} (${data.verifiedFacts.rankProvenance === "verified_replay" ? "verified" : "player-submitted"})` : ""} · {new Date(`${data.verifiedFacts?.occurredAt || data.createdAt}Z`).toLocaleDateString("en-GB", { dateStyle: "medium", timeZone: "UTC" })}</p></div><i className={data.status}>{data.status === "ready" ? "READY" : stopped ? "PAUSED" : "PROCESSING"}</i></header>

      {data.status !== "ready" ? <div className={`report-pending ${stopped ? "stopped" : ""}`}><div className="scan-orb"><i /><b>{stopped ? "!" : "↻"}</b></div><span>{stoppedCopy?.kicker || (data.processing?.stageLabel ? "AUTOMATED MATCH ANALYSIS" : "MATCH SECURED")}</span><h2>{stoppedCopy?.title || data.processing?.stageLabel || "Your match is queued."}</h2><p>{stoppedCopy?.body || "Replay Method is reading the submitted match, measuring repeated patterns and selecting one evidence-backed coaching focus."}</p>{identityResolvable && <section className="player-resolution" aria-labelledby="player-resolution-title"><div><span>{data.processing?.replayContext.mode ? `${data.processing.replayContext.mode.toUpperCase()} · PLAYERS FOUND` : "PLAYERS FOUND IN THIS REPLAY"}</span><h3 id="player-resolution-title">Which one is you?</h3><p>Choose your exact player and current playlist rank. The original private replay is reused automatically.</p></div><div className="player-resolution-options" role="radiogroup" aria-label="Players identified in the replay">{data.processing?.candidatePlayers.map(player => <button type="button" role="radio" disabled={!interactive} aria-checked={selectedPlayer === player} className={selectedPlayer === player ? "active" : ""} key={player} onClick={() => { setSelectedPlayer(player); setIdentityRetryState("idle"); }}>{player}</button>)}</div><label className="player-resolution-rank"><span>Your current {data.processing?.replayContext.mode || "playlist"} rank</span><select value={selectedRank} onChange={event => { setSelectedRank(event.target.value); setIdentityRetryState("idle"); }}><option value="">Choose rank</option>{rocketLeagueRanks.map(rank => <option value={rank} key={rank}>{rank}</option>)}</select></label><button className="player-resolution-submit" type="button" disabled={!interactive || !selectedPlayer || !selectedRank || identityRetryState === "saving"} onClick={retryWithPlayer}>{identityRetryState === "saving" ? "Starting…" : identityRetryState === "queued" ? "Analysis queued ✓" : "Analyze this saved replay →"}</button>{identityRetryState === "error" && <p role="alert">The replay could not be queued. Refresh this private report and try again.</p>}</section>}<div className="status-track">{stages.map((stage, index) => <div className={index <= statusIndex && !stopped ? "active" : index < statusIndex ? "complete" : ""} key={stage.key}><i>{index < statusIndex ? "✓" : index + 1}</i><span>{stage.label}</span></div>)}</div><aside>{stopped ? <><b>No fake certainty.</b><span>We stop when the available data cannot support a reliable report.</span></> : delivery === "email" ? <><b>Confirmation sent.</b><span>We’ll send another email when the report is ready.</span></> : <><b>Keep this private link.</b><span>Your report will appear here automatically when it is ready.</span></>}</aside></div> : (data.report || data.earlyAccess || data.performance) && <>
        <section className={`match-in-20 ${data.report ? "has-focus" : "facts-only"}`} aria-labelledby="report-reveal-title">
          <div className="match-in-20-main">
            <div className="marcel-badges"><span>ONE REPLAY · PRIVATE ANALYSIS</span>{data.earlyAccess && <em>{data.earlyAccess.badge}</em>}</div>
            <h2 id="report-reveal-title">Your match in 20 seconds.</h2>
            <p className="match-result"><b>{matchResult} · {matchScore}</b>{data.performance?.match.overtime && <em>OVERTIME</em>}<span>{playlist}</span></p>
            <div className="match-in-20-grid">
              <article><small>WHAT WORKED</small><b>{data.performance?.strength?.title || "No positive claim was strong enough"}</b><p>{data.performance?.strength?.detail || "The replay was measured, but Replay Method will not manufacture praise from incomplete evidence."}</p></article>
              <article><small>BIGGEST SUPPORTED OPPORTUNITY</small><b>{data.report?.highestImpactMistake || "No coaching focus cleared the evidence gate"}</b><p>{data.report?.whyItCosts || "You still receive the verified match and performance review below; unsupported coaching stays withheld."}</p></article>
              <article><small>NEXT-MATCH RULE</small><b>{data.report?.nextQueueRule || "Do not turn one inconclusive replay into a habit claim."}</b><p>{data.report ? "Use this one if–then cue in your next three representative matches." : "Review the verified moments and use a new representative replay for another independent reading."}</p></article>
            </div>
            <button className="baseline-primary" type="button" onClick={scrollToFocusPlan}><span>{data.report ? "SHOW MY ONE-FOCUS PLAN" : "REVIEW MY VERIFIED PERFORMANCE"}</span><b>↓</b></button>
          </div>
          <aside className="marcel-strength" aria-label="Evidence status and sample size"><small>EVIDENCE STATUS</small><b>{data.report ? (experimental ? "EXPERIMENTAL COACHING" : "SUPPORTED COACHING") : "FACTS ONLY"}</b><span>One replay · within-match evidence</span><div><strong>1</strong><small>REPLAY</small></div><p>No rank benchmark, stable-habit claim or calibrated precision is inferred from this single match.</p></aside>
        </section>

        {data.performance && <section className="performance-review" id="performance"><header><span>VERIFIED PERFORMANCE</span><h2>What happened—and what each measure can tell you.</h2><p>{data.performance.metrics.length} explained measures across {performanceGroups.length} applicable categories. Every value keeps its source, version and limitation.</p></header><div className="performance-groups">{performanceGroups.map(([category, metrics]) => <article className="performance-category" key={category}><h3>{performanceCategoryLabels[category] || category.replaceAll("_", " ")}</h3><div>{metrics.map(metric => <details className={`performance-metric ${metric.status}`} key={metric.id}><summary><span><small>{metric.kind.replaceAll("_", " ")}</small><b>{metric.label}</b></span><strong>{metric.displayValue}</strong></summary><div><p><b>What happened:</b> {metric.whatHappened}</p><p><b>Why it matters:</b> {metric.whyItMatters}</p><p><b>Limit:</b> {metric.limitation}</p><small>SOURCE · {metric.source} · {metric.version}{metric.sampleCount != null ? ` · N=${metric.sampleCount}` : ""}</small></div></details>)}</div></article>)}</div></section>}

        {momentFeed.length > 0 && <section className="report-evidence" id="moments"><header><span>ACTUAL MATCH MOMENTS</span><h2>Moments that changed the match.</h2><p>Replay-linked timestamps first. Interpretation stays marked and limitations remain visible.</p></header><div className="moment-list">{strongestMoments.map((moment, index) => <article key={moment.id}><i>{String(index + 1).padStart(2, "0")}</i><div><small>{moment.kind} · {moment.timing}</small><b>{moment.title}</b><p><strong>Context:</strong> {moment.context}</p><p><strong>Evidence:</strong> {moment.observation}</p><p><strong>Likely consequence:</strong> {moment.consequence}</p>{moment.betterAlternative && <p><strong>Better alternative:</strong> {moment.betterAlternative}</p>}<em>{moment.limitation}</em></div></article>)}</div>{momentFeed.length > 3 && <details className="moment-disclosure"><summary>Show all {momentFeed.length} moments</summary><div>{momentFeed.map(moment => <article key={`${moment.id}-all`}><small>{moment.kind} · {moment.timing}</small><b>{moment.title}</b><p><strong>Context:</strong> {moment.context}</p><p><strong>Evidence:</strong> {moment.observation}</p><p><strong>Likely consequence:</strong> {moment.consequence}</p>{moment.betterAlternative && <p><strong>Better alternative:</strong> {moment.betterAlternative}</p>}<em>{moment.limitation}</em></article>)}</div></details>}</section>}

        {data.report && <section className="report-deep-dive"><header><span>DEEP DIVE · ONE AREA</span><h2>{data.report.highestImpactMistake}</h2></header><div><article><small>WHY THIS AREA</small><p>{data.report.whyItCosts}</p></article><article><small>WHEN THE BEHAVIOR CAN BE CORRECT</small><p>{data.report.limitations[0] || "The same visible behavior can be correct in another game state; this finding applies only to the replay-linked evidence above."}</p></article></div><aside>{experimental ? "Experimental interpretation—not expert ground truth." : "Supported within this match—not a stable player profile."}</aside></section>}

        <section className="report-strength"><span>WHAT YOU DID WELL</span><h2>{data.performance?.strength?.title || "No claim released without support."}</h2><p>{data.performance?.strength?.detail || "An honest analysis can withhold a strength claim when this replay does not provide enough direct evidence."}</p>{data.performance?.strength?.limitation && <small>{data.performance.strength.limitation}</small>}</section>

        {data.report ? <section className="one-focus-plan" id="action-plan"><header><span>ONE-FOCUS PLAN</span><h2>{data.report.nextQueueRule}</h2><p>Apply one cue for the next three representative {playlist} matches. Do not optimize five things at once.</p></header><div className="one-focus-grid"><article><small>IF–THEN RULE</small><b>{data.report.nextQueueRule}</b></article><article><small>5–10 MINUTE DRILL</small><b>{data.report.practicePlan[0] || "No drill was defensibly linked to this finding."}</b></article><article><small>WHAT TO NOTICE</small><b>{data.report.practicePlan[1] || "Notice the same game state before the decision—not only the final outcome."}</b></article><article><small>WHAT THE NEXT REPLAY CHECKS</small><b>{data.report.practicePlan[2] || data.report.coachNote || "Whether the same replay-linked decision appears again under comparable conditions."}</b></article></div>{data.report.coachNote && <aside><span>COACH NOTE</span><p>{data.report.coachNote}</p></aside>}</section> : <section className="one-focus-plan abstained" id="action-plan"><header><span>LOCAL ABSTENTION</span><h2>No coaching plan was released from this replay.</h2><p>The verified review above remains the complete result. Replay Method did not turn neutral measurements into a fake mistake or generic drill.</p></header></section>}

        {factEntries.length > 0 && <section className="verified-match-facts"><header><span>REPORT STATUS &amp; VERIFIED FACTS</span><h2>What the replay itself established.</h2><p>Parser-backed facts, submitted context and coaching interpretation remain visibly separate.</p></header><div>{factEntries.map(([label, value]) => <article key={label}><small>{label}</small><b title={value}>{value}</b></article>)}</div></section>}

        <details className="report-method"><summary><span>Evidence &amp; methodology</span><small>Parser, detector decisions and limitations</small></summary><div className="report-method-grid"><div><span>METHOD</span><h2>Traceable coaching, not a black box.</h2><p>{data.earlyAccess ? "Verified facts come from the replay parser. Any coaching insight is a separately marked deterministic Early Access interpretation; no language model may add gameplay facts, and expert validation is still in progress." : data.report?.analysisSource === "automated" ? "This report was generated from versioned structured findings. The language layer can explain and prioritize them, but it cannot create new gameplay facts." : "This beta report was quality-reviewed. Automated engine metadata appears for reports produced by the structured pipeline."}</p></div><aside><b>{data.processing?.versions.parser || "Parser unavailable"}</b><span>Parser</span><b>{data.processing?.versions.detector || "Quality-reviewed beta"}</b><span>Detector</span><b>{data.processing?.versions.schema || "Legacy report schema"}</b><span>Schema</span></aside>{data.earlyAccess && <div className="method-decisions"><b>LOCAL DETECTOR DECISIONS</b>{data.earlyAccess.assessments.map(item => <article className={item.status} key={item.detectorId}><strong>{item.detectorId}</strong><span>{item.status === "experimental_insight" ? `EXPERIMENTAL · ${item.reason}` : `ABSTAINED · ${item.reason}`}</span></article>)}</div>}<div className="report-limitations"><b>KNOWN LIMITATIONS</b>{data.report?.limitations.length ? <ul>{data.report.limitations.map(item => <li key={item}>{item}</li>)}</ul> : <p>{data.earlyAccess ? "No coaching finding passed for this replay. Formal detector validation remains pending." : "No additional detector-specific limitations were recorded for this finding."}</p>}</div></div></details>

        {data.earlyAccess && <aside className="early-access-compact"><span>{data.earlyAccess.badge}</span><p>{data.earlyAccess.body}</p><small>Formal detector status: not validated · This individual report has not been human-reviewed.</small></aside>}

        <section className="report-feedback"><span>{data.earlyAccess ? "EARLY ACCESS PRODUCT FEEDBACK" : "REPORT FEEDBACK"}</span><h2>Help us test the experience—not certify the detector.</h2><p className="feedback-boundary">These answers are product feedback only. They are never treated as replay ground truth, detector labels or expert validation.</p>{feedbackState === "saved" ? <div className="feedback-saved" role="status"><i>✓</i><b>Feedback saved separately from detector evidence.</b></div> : <><div className="feedback-questions">{([
          ["observation", "Did the main observation fit what happened?"],
          ["moment", "Were the highlighted moments correct?"],
          ["advice", "Was the advice clear?"],
          ["plan", "Will you try the next-match rule?"],
        ] as const).map(([key, question]) => <fieldset key={key}><legend>{question}</legend><div>{[["yes", "Yes"], ["not_sure", "Not sure"], ["no", "No"]].map(([value, label]) => <button type="button" aria-pressed={feedbackSignals[key] === value} className={feedbackSignals[key] === value ? "active" : ""} key={value} onClick={() => setFeedbackSignals(previous => ({ ...previous, [key]: value }))}>{label}</button>)}</div></fieldset>)}</div><textarea aria-label="Optional report feedback" value={feedbackText} onChange={e => setFeedbackText(e.target.value)} placeholder="What fit, what was wrong, or what was unclear?" maxLength={1000} /><label><input type="checkbox" checked={caseStudyConsent} onChange={e => setCaseStudyConsent(e.target.checked)} /><span>You may quote this feedback anonymously as an Early Access product review.</span></label><button type="button" className="save-feedback" disabled={!Object.values(feedbackSignals).some(Boolean) || feedbackState === "saving"} onClick={saveFeedback}>{feedbackState === "saving" ? "Saving…" : "Save feedback"}</button>{feedbackState === "error" && <p role="alert">Could not save feedback. Try again.</p>}</>}</section>

        <aside className="premium-bridge"><span>COMING LATER · NOT FOR SALE</span><h2>This match showed one signal. Premium shows whether it is your pattern — and whether it improves.</h2><p>The future concept compares representative replays over time. This free product remains one complete replay analysis; there is no checkout or locked evidence here.</p></aside>
      </>}
    </section>
  </main>;
}
