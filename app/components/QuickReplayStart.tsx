"use client";

import { DragEvent, FormEvent, useRef, useState } from "react";
import Link from "next/link";

const MAX_REPLAY_BYTES = 16 * 1024 * 1024;
const DEFAULT_GOAL = "Find the highest-impact recurring mistake in this match.";

function getAttribution() {
  const params = new URLSearchParams(location.search);
  let source = params.get("utm_source") || "direct";
  if (source === "direct" && document.referrer) {
    try { source = new URL(document.referrer).hostname.replace(/^www\./, ""); } catch { /* keep direct */ }
  }
  return { source: source.slice(0, 80), campaign: (params.get("utm_campaign") || "").slice(0, 120) };
}

function track(event: string, placement: string) {
  try {
    let visitorId = sessionStorage.getItem("replaymethod-session-id");
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      sessionStorage.setItem("replaymethod-session-id", visitorId);
    }
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        visitorId,
        event,
        game: "rocket-league",
        placement,
        path: location.pathname,
        ...getAttribution()
      })
    });
  } catch { /* measurement must never block an upload */ }
}

function fileProblem(file: File) {
  if (!file.name.toLowerCase().endsWith(".replay")) return "Choose the original Rocket League .replay file.";
  if (file.size === 0) return "That replay is empty. Choose a completed match replay.";
  if (file.size > MAX_REPLAY_BYTES) return "That replay is larger than 16 MB.";
  return "";
}

function fileSizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function QuickReplayStart({ placement }: { placement: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const rankRef = useRef<HTMLInputElement>(null);
  const [replay, setReplay] = useState<File | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [currentRank, setCurrentRank] = useState("");
  const [playerContext, setPlayerContext] = useState("");
  const [notes, setNotes] = useState("");
  const [email, setEmail] = useState("");
  const [dataConsent, setDataConsent] = useState(false);
  const [updatesConsent, setUpdatesConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  function selectFile(file: File | null) {
    if (!file) return;
    const problem = fileProblem(file);
    setMessage(problem);
    if (problem) {
      setReplay(null);
      setDetailsOpen(false);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setReplay(file);
    setDetailsOpen(false);
    setStatus("idle");
    track("upload_started", placement);
    track("analysis_start", `${placement}_details`);
  }

  function continueToDetails() {
    setDetailsOpen(true);
    window.setTimeout(() => rankRef.current?.focus(), 0);
  }

  function drop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    selectFile(event.dataTransfer.files?.[0] || null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!replay) return setMessage("Choose a Rocket League replay first.");
    if (currentRank.trim().length < 2) return setMessage("Add your current rank.");
    if (playerContext.trim().length < 1) return setMessage("Add your exact in-game player name.");
    if (!dataConsent) return setMessage("Confirm that we may process this replay and deliver the private report.");

    setStatus("loading");
    setMessage("");
    const data = new FormData();
    data.set("game", "rocket-league");
    data.set("currentRank", currentRank);
    data.set("targetRank", "");
    data.set("playerContext", playerContext);
    data.set("goal", DEFAULT_GOAL);
    data.set("notes", notes);
    data.set("evidenceUrl", "");
    data.set("email", email);
    data.set("dataConsent", String(dataConsent));
    data.set("updatesConsent", String(updatesConsent));
    data.set("company", "");
    const attribution = getAttribution();
    data.set("source", attribution.source);
    data.set("campaign", attribution.campaign);
    data.set("replay", replay);

    try {
      const response = await fetch("/api/analyses", { method: "POST", body: data });
      const result = await response.json() as { publicId?: string; emailSent?: boolean; error?: string };
      if (!response.ok || !result.publicId) throw new Error(result.error || "We couldn’t start the analysis.");
      try {
        const stored = JSON.parse(localStorage.getItem("replaymethod-report-ids") || "[]") as string[];
        localStorage.setItem("replaymethod-report-ids", JSON.stringify([result.publicId, ...stored.filter(id => id !== result.publicId)].slice(0, 20)));
      } catch { /* the private link still works if storage is unavailable */ }
      track("analysis_submit", placement);
      location.href = `/report/${result.publicId}?delivery=${result.emailSent ? "email" : "link"}`;
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "We couldn’t start the analysis.");
      track("analysis_failed", placement);
    }
  }

  return <form id="replay-upload" className={`quick-replay ${replay ? "has-file" : ""}`} onSubmit={submit}>
    <div className="quick-replay-head"><div><span>ROCKET LEAGUE · LIVE BETA</span><b>Drop one replay. Get one priority.</b></div><i>$0</i></div>
    <label
      className={`quick-drop ${dragging ? "dragging" : ""}`}
      onDragEnter={() => setDragging(true)}
      onDragLeave={() => setDragging(false)}
      onDragOver={event => event.preventDefault()}
      onDrop={drop}
    >
      <input ref={inputRef} type="file" accept=".replay,application/octet-stream" onChange={event => selectFile(event.target.files?.[0] || null)} />
      <i>{replay ? "✓" : "↥"}</i>
      <div><b>{replay ? replay.name : "DROP YOUR .REPLAY HERE"}</b><span>{replay ? `${Math.ceil(replay.size / 1024)} KB · Ready` : "or click to choose · original PC replay · max 16 MB"}</span></div>
      <strong>{replay ? "Change" : "Choose file"}</strong>
    </label>
    {!replay && <div className="quick-upload-help"><p className="quick-promise">Upload first, email last. No account or card.</p><Link href="/replay-upload">Can’t find the file? <span>3 quick steps →</span></Link></div>}

    {replay && <div className="replay-value quick-replay-value" role="status" aria-live="polite">
      <div className="replay-value-head"><span>REPLAY VALIDATED</span><strong>Supported match file recognized.</strong><p>No gameplay claim has been made. This confirms the file is ready for secure parser checks.</p></div>
      <div className="replay-value-facts"><div><span>FORMAT</span><b>.replay</b><small>recognized</small></div><div><span>FILE SIZE</span><b>{fileSizeLabel(replay.size)}</b><small>non-empty</small></div><div><span>UPLOAD LIMIT</span><b>PASS</b><small>16 MB maximum</small></div></div>
      <div className="replay-value-plan"><span>NEXT: EVIDENCE CHECKS</span><p>Replay Method will verify the player and match structure, then test recurring decisions against real match evidence. It stops when evidence is insufficient.</p></div>
      {!detailsOpen && <button className="quick-value-continue" type="button" aria-expanded="false" aria-controls="quick-replay-details" onClick={continueToDetails}>CONTINUE TO PRIVATE REPORT SETUP <span>→</span></button>}
    </div>}

    {replay && detailsOpen && <div className="quick-details" id="quick-replay-details">
      <div className="quick-field-row">
        <label><span>Current rank *</span><input ref={rankRef} value={currentRank} onChange={event => setCurrentRank(event.target.value)} placeholder="e.g. Diamond 2" maxLength={80} required /></label>
        <label><span>Exact player name *</span><input value={playerContext} onChange={event => setPlayerContext(event.target.value)} placeholder="as shown in the replay" maxLength={160} required /></label>
      </div>
      <label className="quick-notes"><span>What felt wrong? <i>optional</i></span><input value={notes} onChange={event => setNotes(event.target.value)} placeholder="We still scan the whole match." maxLength={500} /></label>
      <label className="quick-email"><span>Private report email *</span><input type="email" autoComplete="email" inputMode="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@email.com" required /></label>
      <p className="quick-email-note">Upload first, email last. Used to deliver and recover this private report—not for marketing unless you choose it below.</p>
      <label className="quick-check"><input type="checkbox" checked={dataConsent} onChange={event => setDataConsent(event.target.checked)} required /><span>Process this replay and email to deliver my private beta analysis. <a href="/privacy" target="_blank">Privacy</a></span></label>
      <label className="quick-check optional"><input type="checkbox" checked={updatesConsent} onChange={event => setUpdatesConsent(event.target.checked)} /><span>Also send product updates and founding access. Optional.</span></label>
      <button className="quick-submit" disabled={status === "loading"}>{status === "loading" ? "SECURING AND READING YOUR MATCH…" : "START FREE ANALYSIS →"}</button>
      <small>No card · Private status link appears immediately · The engine stops instead of guessing</small>
    </div>}

    {message && <p className={`quick-message ${status}`} role="alert">{message}</p>}
  </form>;
}
