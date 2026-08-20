"use client";

import { DragEvent, FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { trackProductEvent, type ProductEvent } from "../../lib/client-analytics";

const MAX_REPLAY_BYTES = 16 * 1024 * 1024;
const DEFAULT_GOAL = "Find the highest-impact recurring mistake in this match.";
type Platform = "pc" | "ps5" | "xbox" | "switch";

const consolePaths: Record<Exclude<Platform, "pc">, { label: string; capture: string; limitation: string; guide: string }> = {
  ps5: {
    label: "PlayStation 5",
    capture: "Press Create → Save Recent Gameplay. PS5 can preserve up to one hour.",
    limitation: "PlayStation stores Rocket League replays inside console save data, so the parser cannot receive the original .replay file.",
    guide: "https://www.playstation.com/en-us/support/games/capture-ps5-gameplay-screenshots/",
  },
  xbox: {
    label: "Xbox",
    capture: "Use Capture & share to record the match or keep a full-session stream.",
    limitation: "Xbox does not expose the original Rocket League .replay file to this web upload.",
    guide: "https://support.xbox.com/en-US/help/games-apps/troubleshooting/troubleshoot-recording-game-clips",
  },
  switch: {
    label: "Nintendo Switch",
    capture: "Hold Capture to save a supported gameplay clip.",
    limitation: "Switch clips are currently limited to 30 seconds—too short for the deep full-match evidence engine.",
    guide: "https://en-americas-support.nintendo.com/app/answers/detail/a_id/27540/",
  },
};

function getAttribution() {
  const params = new URLSearchParams(location.search);
  let source = params.get("utm_source") || "direct";
  if (source === "direct" && document.referrer) {
    try { source = new URL(document.referrer).hostname.replace(/^www\./, ""); } catch { /* keep direct */ }
  }
  return { source: source.slice(0, 80), campaign: (params.get("utm_campaign") || "").slice(0, 120) };
}

function track(event: ProductEvent, placement: string) {
  trackProductEvent(event, "rocket-league", placement);
}

function replayProblemCode(file: File) {
  if (!file.name.toLowerCase().endsWith(".replay")) return "invalid_type";
  if (file.size === 0) return "empty_file";
  if (file.size > MAX_REPLAY_BYTES) return "file_too_large";
  return "unknown";
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
  const [platform, setPlatform] = useState<Platform>("pc");
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
      track("validation_failed", replayProblemCode(file));
      setStatus("error");
      setReplay(null);
      setDetailsOpen(false);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setReplay(file);
    setDetailsOpen(false);
    setStatus("idle");
    track("replay_selected", placement);
    track("analysis_start", `${placement}_details`);
  }

  function choosePlatform(next: Platform) {
    setPlatform(next);
    setReplay(null);
    setDetailsOpen(false);
    setMessage("");
    setStatus("idle");
    if (inputRef.current) inputRef.current.value = "";
    track("cta_click", `${placement}_platform_${next}`);
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
      track("upload_started", placement);
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

  return <form id="replay-upload" className={`quick-replay ${replay ? "has-file" : ""}`} aria-busy={status === "loading"} onSubmit={submit}>
    <div className="quick-replay-head"><div><span>ROCKET LEAGUE · QUALITY BETA</span><b>Choose your platform. Start with real evidence.</b></div><i>$0</i></div>
    <div className="platform-picker" role="group" aria-label="Choose Rocket League platform">
      {([["pc", "PC"], ["ps5", "PS5"], ["xbox", "XBOX"], ["switch", "SWITCH"]] as const).map(item => <button type="button" className={platform === item[0] ? "active" : ""} aria-pressed={platform === item[0]} onClick={() => choosePlatform(item[0])} key={item[0]}><i>{item[0] === "pc" ? "⌨" : item[0] === "ps5" ? "△" : item[0] === "xbox" ? "X" : "◫"}</i><span>{item[1]}</span></button>)}
    </div>
    {platform === "pc" ? <><label
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
    {!replay && <div className="quick-upload-help"><p className="quick-promise">Upload first, email last. No account or card.</p><details><summary>Where is my .replay file? <span>30-second guide</span></summary><ol><li><b>1</b><span>Press <strong>Windows + R</strong></span></li><li><b>2</b><span>Paste <code>%USERPROFILE%\Documents\My Games\Rocket League\TAGame\Demos</code></span></li><li><b>3</b><span>Choose your latest <strong>.replay</strong> file above</span></li></ol><Link href="/replay-upload">Open the full visual guide →</Link></details></div>}

    {replay && <div className="replay-value quick-replay-value" role="status" aria-live="polite">
      <div className="replay-value-head"><span>REPLAY VALIDATED</span><strong>Supported match file recognized.</strong><p>No gameplay claim has been made. This confirms the file is ready for secure parser checks.</p></div>
      <div className="replay-value-facts"><div><span>FORMAT</span><b>.replay</b><small>recognized</small></div><div><span>FILE SIZE</span><b>{fileSizeLabel(replay.size)}</b><small>non-empty</small></div><div><span>UPLOAD LIMIT</span><b>PASS</b><small>16 MB maximum</small></div></div>
      <div className="replay-value-plan"><span>NEXT: EVIDENCE CHECKS</span><p>Replay Method will verify the player and match structure, then test recurring decisions against real match evidence. It stops when evidence is insufficient.</p></div>
      {!detailsOpen && <button className="quick-value-continue" type="button" aria-expanded="false" aria-controls="quick-replay-details" onClick={continueToDetails}>CONTINUE TO PRIVATE STATUS SETUP <span>→</span></button>}
    </div>}

    {replay && detailsOpen && <div className="quick-details" id="quick-replay-details">
      <div className="quick-field-row">
        <label><span>Current rank *</span><input ref={rankRef} value={currentRank} onChange={event => setCurrentRank(event.target.value)} placeholder="e.g. Diamond 2" maxLength={80} required /></label>
        <label><span>Exact player name *</span><input value={playerContext} onChange={event => setPlayerContext(event.target.value)} placeholder="as shown in the replay" maxLength={160} required /></label>
      </div>
      <label className="quick-notes"><span>What felt wrong? <i>optional</i></span><input value={notes} onChange={event => setNotes(event.target.value)} placeholder="We still scan the whole match." maxLength={500} /></label>
      <label className="quick-email"><span>Private status email *</span><input type="email" autoComplete="email" inputMode="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@email.com" required /></label>
      <p className="quick-email-note">Upload first, email last. Used to deliver and recover this private analysis—not for marketing unless you choose it below.</p>
      <label className="quick-check"><input type="checkbox" checked={dataConsent} onChange={event => setDataConsent(event.target.checked)} required /><span>Process this replay and email to deliver my private beta analysis. <a href="/privacy" target="_blank">Privacy</a></span></label>
      <label className="quick-check optional"><input type="checkbox" checked={updatesConsent} onChange={event => setUpdatesConsent(event.target.checked)} /><span>Also send product updates and beta-access news. Optional.</span></label>
      <button className="quick-submit" disabled={status === "loading"}><span aria-live="polite">{status === "loading" ? "SECURING AND READING YOUR MATCH…" : "START FREE EVIDENCE CHECK →"}</span></button>
      <small>No card · Private status link appears immediately · The engine stops instead of guessing</small>
    </div>}

    </> : <div className="console-path">
      <div className="console-path-top"><i>{platform === "ps5" ? "△○×□" : platform === "xbox" ? "X" : "◫"}</i><div><span>{consolePaths[platform].label.toUpperCase()} PATH</span><b>Video lane—not a fake PC upload.</b></div><em>COMING NEXT</em></div>
      <ol><li><i>1</i><div><b>Save the whole match</b><span>{consolePaths[platform].capture}</span></div></li><li><i>2</i><div><b>Keep the original clip</b><span>Do not crop the scoreboard, clock or player view.</span></div></li><li><i>3</i><div><b>Join console priority</b><span>We will invite this platform when the video evidence adapter is honest enough to ship.</span></div></li></ol>
      <p>{consolePaths[platform].limitation}</p>
      <div><a className="console-primary" href="#join-beta" onClick={() => track("cta_click", `${placement}_console_beta`)}>JOIN CONSOLE VIDEO BETA <span>→</span></a><a className="console-guide" href={consolePaths[platform].guide} target="_blank" rel="noreferrer">Official capture guide ↗</a></div>
    </div>}

    {message && platform === "pc" && <p className={`quick-message ${status}`} role="alert">{message}</p>}
  </form>;
}
