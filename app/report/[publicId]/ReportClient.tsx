"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PublicReportData } from "../../../lib/report-data";

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
  if (code === "detectors_not_calibrated") return {
    kicker: "PARSER VERIFIED · COACHING GATED",
    title: "We read the replay, but the coaching evidence has not passed the beta precision gate.",
    body: "The player and match data were identified successfully. We stopped before turning uncalibrated heuristics into advice. This submission can be reprocessed when the validated detector set is enabled."
  };
  if (code === "subject_player_not_found" || code === "subject_player_ambiguous" || code === "replay_players_missing") return {
    kicker: "PLAYER IDENTITY NEEDED",
    title: "The replay parsed, but we could not safely identify which player is you.",
    body: "Use the exact in-game player name shown in that replay. Your original file is preserved, so operations can retry it without another upload."
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

export default function ReportClient({ initial, delivery }: { initial: PublicReportData; delivery: "email" | "link" }) {
  const [data, setData] = useState(initial);
  const [feedbackScore, setFeedbackScore] = useState(initial.feedbackScore || 0);
  const [feedbackText, setFeedbackText] = useState("");
  const [caseStudyConsent, setCaseStudyConsent] = useState(false);
  const [feedbackState, setFeedbackState] = useState<"idle" | "saving" | "saved" | "error">(initial.feedbackScore ? "saved" : "idle");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("replaymethod-report-ids") || "[]") as string[];
    localStorage.setItem("replaymethod-report-ids", JSON.stringify([data.publicId, ...stored.filter(id => id !== data.publicId)].slice(0, 20)));
    const eventKey = `replaymethod-report-view-${data.publicId}`;
    if (!sessionStorage.getItem(eventKey)) {
      let visitorId = sessionStorage.getItem("replaymethod-session-id");
      if (!visitorId) { visitorId = crypto.randomUUID(); sessionStorage.setItem("replaymethod-session-id", visitorId); }
      sessionStorage.setItem(eventKey, "1");
      const params = new URLSearchParams(location.search);
      void fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({ visitorId, event: "report_view", game: data.game, placement: data.status, path: location.pathname, source: params.get("utm_source") || "direct", campaign: params.get("utm_campaign") || "" })
      });
    }
  }, [data.game, data.publicId, data.status]);

  useEffect(() => {
    if (["ready", "blocked", "failed"].includes(data.status)) return;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/analyses/${data.publicId}`, { cache: "no-store" });
        if (response.ok) setData(await response.json() as PublicReportData);
      } catch { /* next poll retries */ }
    }, 15000);
    return () => window.clearInterval(timer);
  }, [data.publicId, data.status]);

  const copyLink = async () => {
    let visitorId = sessionStorage.getItem("replaymethod-session-id");
    if (!visitorId) { visitorId = crypto.randomUUID(); sessionStorage.setItem("replaymethod-session-id", visitorId); }
    void fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true, body: JSON.stringify({ visitorId, event: "share_started", game: data.game, placement: "private_link", path: location.pathname, source: "direct" }) });
    await navigator.clipboard.writeText(location.href.split("?")[0]);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const saveFeedback = async () => {
    if (!feedbackScore) return;
    setFeedbackState("saving");
    const response = await fetch(`/api/analyses/${data.publicId}/feedback`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ score: feedbackScore, text: feedbackText, caseStudyConsent }) });
    setFeedbackState(response.ok ? "saved" : "error");
    if (response.ok) {
      let visitorId = sessionStorage.getItem("replaymethod-session-id");
      if (!visitorId) { visitorId = crypto.randomUUID(); sessionStorage.setItem("replaymethod-session-id", visitorId); }
      void fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true, body: JSON.stringify({ visitorId, event: "feedback", game: data.game, placement: `score_${feedbackScore}`, path: location.pathname, source: "direct" }) });
    }
  };

  const trackUpgradeInterest = () => {
    let visitorId = sessionStorage.getItem("replaymethod-session-id");
    if (!visitorId) { visitorId = crypto.randomUUID(); sessionStorage.setItem("replaymethod-session-id", visitorId); }
    void fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true, body: JSON.stringify({ visitorId, event: "cta_click", game: data.game, placement: "report_improvement_loop", path: location.pathname, source: "report" }) });
  };

  const statusIndex = data.status === "ready" ? stages.length - 1 : stageOrder[data.processing?.stage || "queued"] ?? 0;
  const stopped = data.status === "blocked" || data.status === "failed";
  const stoppedCopy = stopped ? stopCopy(data) : null;
  const evidence = data.report?.evidenceDetails.length
    ? data.report.evidenceDetails.map(item => ({
      label: item.round != null ? `ROUND · ${item.round}` : item.timestamp != null ? `MATCH TIME · ${Math.floor(item.timestamp / 60)}:${String(Math.floor(item.timestamp % 60)).padStart(2, "0")}` : item.label,
      text: item.description
    }))
    : (data.report?.evidenceMoments || []).map((text, index) => ({ label: `Evidence ${index + 1}`, text }));
  const confidence = data.report?.confidence == null ? null : Math.round(data.report.confidence * 100);

  return <main className="report-page">
    <nav className="tool-nav shell"><Link className="brand" href="/"><span className="logo">↻</span><span>replay<span>method</span></span></Link><div><Link href="/reports">My reports</Link><button type="button" onClick={copyLink}>{copied ? "Copied ✓" : "Copy private link"}</button></div></nav>
    <section className="report-shell shell">
      <header className="report-top"><div><span>PRIVATE PLAYER REPORT</span><h1>{data.gameLabel}</h1><p>{data.currentRank}{data.targetRank ? ` → ${data.targetRank}` : ""} · Submitted {new Date(`${data.createdAt}Z`).toLocaleDateString("en-GB", { dateStyle: "medium" })}</p></div><i className={data.status}>{data.status === "ready" ? "READY" : stopped ? "PAUSED" : "PROCESSING"}</i></header>

      {data.status !== "ready" ? <div className={`report-pending ${stopped ? "stopped" : ""}`}><div className="scan-orb"><i /><b>{stopped ? "!" : "↻"}</b></div><span>{stoppedCopy?.kicker || (data.processing?.stageLabel ? "AUTOMATED MATCH ANALYSIS" : "MATCH SECURED")}</span><h2>{stoppedCopy?.title || data.processing?.stageLabel || "Your match is queued."}</h2><p>{stoppedCopy?.body || "Replay Method is reading the submitted match, measuring repeated patterns and selecting one evidence-backed coaching focus."}</p><div className="status-track">{stages.map((stage, index) => <div className={index <= statusIndex && !stopped ? "active" : index < statusIndex ? "complete" : ""} key={stage.key}><i>{index < statusIndex ? "✓" : index + 1}</i><span>{stage.label}</span></div>)}</div><aside>{stopped ? <><b>No fake certainty.</b><span>We stop when the available data cannot support a reliable report.</span></> : delivery === "email" ? <><b>Confirmation sent.</b><span>We’ll send another email when the report is ready.</span></> : <><b>Keep this private link.</b><span>Your report will appear here automatically when it is ready.</span></>}</aside></div> : data.report && <>
        <div className="report-hero"><div><span>YOUR PRIMARY LEAK</span><h2>{data.report.highestImpactMistake}</h2><div className="report-cost"><small>WHY IT COSTS</small><p>{data.report.whyItCosts}</p></div></div><aside><small>CONFIDENCE</small><b>{data.report.confidenceLabel ? `${data.report.confidenceLabel.toUpperCase()} CONFIDENCE` : "QUALITY REVIEWED"}</b><span>{confidence == null ? "Evidence checked before publishing" : `${confidence}% detector confidence · ${data.report.analysisSource === "automated" ? "automated" : "reviewed"}`}</span><em>Confidence in this finding for this match—not a rank-up probability.</em></aside></div>

        <section className="report-evidence"><header><span>01 · EVIDENCE</span><h2>Why Replay Method thinks this.</h2><p>Specific observations from the submitted match—not a generic personality score.</p></header><div>{evidence.map((moment, index) => <article key={`${moment.text}-${index}`}><b>{moment.label}</b><p>{moment.text}</p></article>)}</div></section>

        <section className="queue-rule"><div><span>02 · NEXT-QUEUE RULE</span><h2>{data.report.nextQueueRule}</h2><p>Do not try to fix everything at once. Carry this single rule into the next match and mark the moments when it applies.</p></div><i>ONE<br />FOCUS</i></section>

        <section className="practice-plan"><header><span>03 · PRACTICE</span><h2>Your focused plan.</h2></header><div>{data.report.practicePlan.map((item, index) => <article key={`${item}-${index}`}><i>{String(index + 1).padStart(2, "0")}</i><div><small>{index === 0 ? "START HERE" : `STEP ${index + 1}`}</small><b>{item}</b></div></article>)}</div>{data.report.coachNote && <aside><span>COACH NOTE</span><p>{data.report.coachNote}</p></aside>}</section>

        <section className="verify-next"><div><span>04 · VERIFY</span><h2>Check the same decision again—not your rank overnight.</h2><p>Later analyses can add evidence to this focus only when the same supported detector observes it again. If that signal is absent or evidence is insufficient, Replay Method stays inconclusive.</p><ol><li><b>QUEUE</b><span>Carry only the next-queue rule into a representative match.</span></li><li><b>SUBMIT</b><span>Send the next supported match without cherry-picking a highlight.</span></li><li><b>COMPARE</b><span>Use another real observation of this same focus before calling it progress.</span></li></ol></div><aside><span>RECOMMENDED · 3-MONTH CYCLE</span><b>$27<small>/3 months</small></b><ul><li>$9/month effective</li><li>4 analyses every 30 days</li><li>History remains readable</li></ul><Link href="/#pricing" onClick={trackUpgradeInterest}>Compare paid plans →</Link><small>Cadence changes with payment. Evidence standards do not.</small></aside></section>

        <section className="report-method"><div><span>CONFIDENCE + LIMITATIONS</span><h2>Traceable coaching, not a black box.</h2><p>{data.report.analysisSource === "automated" ? "This report was generated from versioned structured findings. The language layer can explain and prioritize them, but it cannot create new gameplay facts." : "This beta report was quality-reviewed. Automated engine metadata will appear here for reports produced by the structured pipeline."}</p></div><aside><b>{data.processing?.versions.detector || "Quality-reviewed beta"}</b><span>Detector</span><b>{data.processing?.versions.schema || "Legacy report schema"}</b><span>Schema</span></aside><div className="report-limitations"><b>KNOWN LIMITATIONS</b>{data.report.limitations.length > 0 ? <ul>{data.report.limitations.map(item => <li key={item}>{item}</li>)}</ul> : <p>No additional detector-specific limitations were recorded for this finding.</p>}</div></section>

        <section className="report-feedback"><span>VERIFIED BETA FEEDBACK</span><h2>Did this show you something useful?</h2>{feedbackState === "saved" ? <div className="feedback-saved" role="status"><i>✓</i><b>Feedback saved. Thank you for helping build the method.</b></div> : <><div className="score-row" role="group" aria-label="Rate this report from 1 to 5">{[1,2,3,4,5].map(score => <button type="button" className={feedbackScore === score ? "active" : ""} aria-pressed={feedbackScore === score} aria-label={`${score} out of 5${score === 1 ? ", not useful" : score === 5 ? ", very useful" : ""}`} key={score} onClick={() => setFeedbackScore(score)}>{score}<small aria-hidden="true">{score === 1 ? "Not useful" : score === 5 ? "Very useful" : ""}</small></button>)}</div><textarea aria-label="Optional report feedback" value={feedbackText} onChange={e => setFeedbackText(e.target.value)} placeholder="What was useful—or what was missing?" maxLength={1000} /><label><input type="checkbox" checked={caseStudyConsent} onChange={e => setCaseStudyConsent(e.target.checked)} /><span>You may quote this feedback anonymously as a verified beta review.</span></label><button type="button" className="save-feedback" disabled={!feedbackScore || feedbackState === "saving"} onClick={saveFeedback}>{feedbackState === "saving" ? "Saving…" : "Save feedback"}</button>{feedbackState === "error" && <p role="alert">Could not save feedback. Try again.</p>}</>}</section>
      </>}
    </section>
  </main>;
}
