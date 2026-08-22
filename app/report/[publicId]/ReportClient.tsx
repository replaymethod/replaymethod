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

export default function ReportClient({ initial, accessToken, delivery, checkoutOpen }: { initial: PublicReportData; accessToken: string; delivery: "email" | "link"; checkoutOpen: boolean }) {
  const [data, setData] = useState(initial);
  const [feedbackScore, setFeedbackScore] = useState(initial.feedbackScore || 0);
  const [feedbackText, setFeedbackText] = useState("");
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
  }, [accessToken, data.game, data.processing?.errorCode, data.processing?.replayContext.mode, data.publicId, data.status]);

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

  const saveFeedback = async () => {
    if (!feedbackScore) return;
    setFeedbackState("saving");
    const response = await fetch(`/api/analyses/${data.publicId}/feedback`, { method: "POST", headers: { "Content-Type": "application/json", ...(accessToken ? { "X-Report-Access": accessToken } : {}) }, body: JSON.stringify({ score: feedbackScore, text: feedbackText, caseStudyConsent }) });
    setFeedbackState(response.ok ? "saved" : "error");
    if (response.ok) {
      trackProductEvent("feedback", data.game as "league" | "valorant" | "rocket-league", `score_${feedbackScore}`);
    }
  };

  const trackUpgradeInterest = () => {
    trackProductEvent("upgrade_intent", data.game as "league" | "valorant" | "rocket-league", "report_improvement_loop", "report");
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
  const confidence = data.report?.confidence == null ? null : Math.round(data.report.confidence * 100);

  return <main className="report-page">
    <nav className="tool-nav shell"><Link className="brand" href="/"><span className="logo" aria-hidden="true" /><span>replay<span>method</span></span></Link><div><Link href="/reports">My reports</Link><button type="button" onClick={copyLink}>{copied ? "Copied ✓" : "Copy private link"}</button></div></nav>
    <section className="report-shell shell">
      <header className="report-top"><div><span>PRIVATE PLAYER REPORT</span><h1>{data.gameLabel}</h1><p>{data.currentRank.startsWith("Pending") ? (data.processing?.replayContext.mode || "Playlist reading") : data.currentRank}{data.targetRank ? ` → ${data.targetRank}` : ""} · Submitted {new Date(`${data.createdAt}Z`).toLocaleDateString("en-GB", { dateStyle: "medium", timeZone: "UTC" })}</p></div><i className={data.status}>{data.status === "ready" ? "READY" : stopped ? "PAUSED" : "PROCESSING"}</i></header>

      {data.status !== "ready" ? <div className={`report-pending ${stopped ? "stopped" : ""}`}><div className="scan-orb"><i /><b>{stopped ? "!" : "↻"}</b></div><span>{stoppedCopy?.kicker || (data.processing?.stageLabel ? "AUTOMATED MATCH ANALYSIS" : "MATCH SECURED")}</span><h2>{stoppedCopy?.title || data.processing?.stageLabel || "Your match is queued."}</h2><p>{stoppedCopy?.body || "Replay Method is reading the submitted match, measuring repeated patterns and selecting one evidence-backed coaching focus."}</p>{identityResolvable && <section className="player-resolution" aria-labelledby="player-resolution-title"><div><span>{data.processing?.replayContext.mode ? `${data.processing.replayContext.mode.toUpperCase()} · PLAYERS FOUND` : "PLAYERS FOUND IN THIS REPLAY"}</span><h3 id="player-resolution-title">Which one is you?</h3><p>Choose your player and your current rank in this playlist. The original private replay is reused automatically.</p></div><div className="player-resolution-options" role="radiogroup" aria-label="Players identified in the replay">{data.processing?.candidatePlayers.map(player => <button type="button" role="radio" disabled={!interactive} aria-checked={selectedPlayer === player} className={selectedPlayer === player ? "active" : ""} key={player} onClick={() => { setSelectedPlayer(player); setIdentityRetryState("idle"); }}>{player}</button>)}</div><label className="player-resolution-rank"><span>Your current {data.processing?.replayContext.mode || "playlist"} rank</span><select value={selectedRank} onChange={event => { setSelectedRank(event.target.value); setIdentityRetryState("idle"); }}><option value="">Choose rank</option>{rocketLeagueRanks.map(rank => <option value={rank} key={rank}>{rank}</option>)}</select></label><button className="player-resolution-submit" type="button" disabled={!interactive || !selectedPlayer || !selectedRank || identityRetryState === "saving"} onClick={retryWithPlayer}>{identityRetryState === "saving" ? "Starting…" : identityRetryState === "queued" ? "Analysis queued ✓" : "Analyze this saved replay →"}</button>{identityRetryState === "error" && <p role="alert">The replay could not be queued. Refresh this private report and try again.</p>}</section>}<div className="status-track">{stages.map((stage, index) => <div className={index <= statusIndex && !stopped ? "active" : index < statusIndex ? "complete" : ""} key={stage.key}><i>{index < statusIndex ? "✓" : index + 1}</i><span>{stage.label}</span></div>)}</div><aside>{stopped ? <><b>No fake certainty.</b><span>We stop when the available data cannot support a reliable report.</span></> : delivery === "email" ? <><b>Confirmation sent.</b><span>We’ll send another email when the report is ready.</span></> : <><b>Keep this private link.</b><span>Your report will appear here automatically when it is ready.</span></>}</aside></div> : data.report && <>
        <div className="report-hero"><div><span>YOUR PRIMARY LEAK</span><h2>{data.report.highestImpactMistake}</h2><div className="report-cost"><small>WHY IT COSTS</small><p>{data.report.whyItCosts}</p></div></div><aside><small>CONFIDENCE</small><b>{data.report.confidenceLabel ? `${data.report.confidenceLabel.toUpperCase()} CONFIDENCE` : "QUALITY REVIEWED"}</b><span>{confidence == null ? "Evidence checked before publishing" : `${confidence}% detector confidence · ${data.report.analysisSource === "automated" ? "automated" : "reviewed"}`}</span><em>Confidence in this finding for this match—not a rank-up probability.</em></aside></div>

        <section className="report-evidence"><header><span>01 · EVIDENCE</span><h2>Why Replay Method thinks this.</h2><p>Specific observations from the submitted match—not a generic personality score.</p></header><div>{evidence.map((moment, index) => <article key={`${moment.text}-${index}`}><b>{moment.label}</b><p>{moment.text}</p></article>)}</div></section>

        <section className="queue-rule"><div><span>02 · NEXT-QUEUE RULE</span><h2>{data.report.nextQueueRule}</h2><p>Do not try to fix everything at once. Carry this single rule into the next match and mark the moments when it applies.</p></div><i>ONE<br />FOCUS</i></section>

        <section className="practice-plan"><header><span>03 · PRACTICE</span><h2>Your focused plan.</h2></header><div>{data.report.practicePlan.map((item, index) => <article key={`${item}-${index}`}><i>{String(index + 1).padStart(2, "0")}</i><div><small>{index === 0 ? "START HERE" : `STEP ${index + 1}`}</small><b>{item}</b></div></article>)}</div>{data.report.coachNote && <aside><span>COACH NOTE</span><p>{data.report.coachNote}</p></aside>}</section>

        <section className="verify-next"><div><span>04 · VERIFY</span><h2>Check the same decision again—not your rank overnight.</h2><p>Later analyses can add evidence to this focus only when the same supported detector observes it again. If that signal is absent or evidence is insufficient, Replay Method stays inconclusive.</p><ol><li><b>QUEUE</b><span>Carry only the next-queue rule into a representative match.</span></li><li><b>SUBMIT</b><span>Send the next supported match without cherry-picking a highlight.</span></li><li><b>COMPARE</b><span>Use another real observation of this same focus before calling it progress.</span></li></ol></div>{checkoutOpen ? <aside><span>CONTINUE THE IMPROVEMENT LOOP</span><b>Choose your cadence</b><ul><li>Four analyses every 30 days</li><li>Longitudinal focus history</li><li>Evidence standards never change</li></ul><Link href="/#pricing" onClick={trackUpgradeInterest}>Compare available plans →</Link><small>Payment changes cadence—not the quality gate.</small></aside> : <aside><span>BETA FOLLOW-UP · NO PAYMENT</span><b>Prove the focus before buying anything.</b><ul><li>Carry one rule into a representative match</li><li>Keep this private report in your history</li><li>Submit again only when the beta lane is open</li></ul><Link href="/reports">Open my report history →</Link><small>Checkout remains closed until product and operational gates pass.</small></aside>}</section>

        <section className="report-method"><div><span>CONFIDENCE + LIMITATIONS</span><h2>Traceable coaching, not a black box.</h2><p>{data.report.analysisSource === "automated" ? "This report was generated from versioned structured findings. The language layer can explain and prioritize them, but it cannot create new gameplay facts." : "This beta report was quality-reviewed. Automated engine metadata will appear here for reports produced by the structured pipeline."}</p></div><aside><b>{data.processing?.versions.detector || "Quality-reviewed beta"}</b><span>Detector</span><b>{data.processing?.versions.schema || "Legacy report schema"}</b><span>Schema</span></aside><div className="report-limitations"><b>KNOWN LIMITATIONS</b>{data.report.limitations.length > 0 ? <ul>{data.report.limitations.map(item => <li key={item}>{item}</li>)}</ul> : <p>No additional detector-specific limitations were recorded for this finding.</p>}</div></section>

        <section className="report-feedback"><span>VERIFIED BETA FEEDBACK</span><h2>Did this show you something useful?</h2>{feedbackState === "saved" ? <div className="feedback-saved" role="status"><i>✓</i><b>Feedback saved. Thank you for helping build the method.</b></div> : <><div className="score-row" role="group" aria-label="Rate this report from 1 to 5">{[1,2,3,4,5].map(score => <button type="button" className={feedbackScore === score ? "active" : ""} aria-pressed={feedbackScore === score} aria-label={`${score} out of 5${score === 1 ? ", not useful" : score === 5 ? ", very useful" : ""}`} key={score} onClick={() => setFeedbackScore(score)}>{score}<small aria-hidden="true">{score === 1 ? "Not useful" : score === 5 ? "Very useful" : ""}</small></button>)}</div><textarea aria-label="Optional report feedback" value={feedbackText} onChange={e => setFeedbackText(e.target.value)} placeholder="What was useful—or what was missing?" maxLength={1000} /><label><input type="checkbox" checked={caseStudyConsent} onChange={e => setCaseStudyConsent(e.target.checked)} /><span>You may quote this feedback anonymously as a verified beta review.</span></label><button type="button" className="save-feedback" disabled={!feedbackScore || feedbackState === "saving"} onClick={saveFeedback}>{feedbackState === "saving" ? "Saving…" : "Save feedback"}</button>{feedbackState === "error" && <p role="alert">Could not save feedback. Try again.</p>}</>}</section>
      </>}
    </section>
  </main>;
}
