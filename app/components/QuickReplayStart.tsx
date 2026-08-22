"use client";

import { DragEvent, FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { trackProductEvent, type ProductEvent } from "../../lib/client-analytics";
import { readApiResponse, uploadReplayInChunks, type StagedReplay } from "../../lib/client-replay-upload";
import { desktopHandoffUrl } from "../../lib/desktop-handoff.mjs";

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
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const stagedReplayRef = useRef<StagedReplay | null>(null);
  const [platform, setPlatform] = useState<Platform>("pc");
  const [replay, setReplay] = useState<File | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const notes = "";
  const [email, setEmail] = useState("");
  const [dataConsent, setDataConsent] = useState(false);
  const updatesConsent = false;
  const [handoffCopied, setHandoffCopied] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => formRef.current?.setAttribute("data-hydrated", "true"), []);

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
    stagedReplayRef.current = null;
    setReplay(file);
    setDetailsOpen(true);
    setStatus("idle");
    track("replay_selected", placement);
    track("analysis_start", `${placement}_details`);
    window.setTimeout(() => document.getElementById("quick-replay-email")?.focus(), 0);
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

  async function copyPcLink() {
    const link = desktopHandoffUrl(location.href);
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setHandoffCopied(true);
      track("cta_click", `${placement}_pc_handoff`);
      window.setTimeout(() => setHandoffCopied(false), 1800);
    } catch {
      setMessage("Copy this page’s address from your browser to continue on your PC.");
    }
  }

  function drop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    selectFile(event.dataTransfer.files?.[0] || null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!replay) return setMessage("Choose a Rocket League replay first.");
    if (!dataConsent) return setMessage("Confirm that we may process this replay and deliver the private report.");

    setStatus("loading");
    setMessage("");
    const data = new FormData();
    data.set("game", "rocket-league");
    data.set("platform", "pc");
    data.set("currentRank", "");
    data.set("targetRank", "");
    data.set("playerContext", "");
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

    let replaySaved = Boolean(stagedReplayRef.current);
    try {
      track("upload_started", placement);
      const staged = stagedReplayRef.current || await uploadReplayInChunks(replay, email, dataConsent, percent => {
        setMessage(`Saving replay securely… ${percent}%`);
      });
      stagedReplayRef.current = staged;
      replaySaved = true;
      data.set("uploadId", staged.uploadId);
      data.set("uploadToken", staged.uploadToken);
      setMessage("Replay saved securely. Starting the private analysis…");
      const response = await fetch("/api/analyses", { method: "POST", body: data });
      const result = await readApiResponse(response) as { publicId?: string; accessToken?: string; url?: string; emailSent?: boolean; error?: string };
      if (!response.ok || !result.publicId) throw new Error(result.error || "We couldn’t start the analysis.");
      track("upload_complete", placement);
      track("identity_captured", `${placement}_private_delivery`);
      track("processing_started", placement);
      try {
        const stored = JSON.parse(localStorage.getItem("replaymethod-report-ids") || "[]") as string[];
        localStorage.setItem("replaymethod-report-ids", JSON.stringify([result.publicId, ...stored.filter(id => id !== result.publicId)].slice(0, 20)));
        if (result.accessToken) {
          const access = JSON.parse(localStorage.getItem("replaymethod-report-access") || "{}") as Record<string, string>;
          localStorage.setItem("replaymethod-report-access", JSON.stringify({ ...access, [result.publicId]: result.accessToken }));
        }
      } catch { /* the private link still works if storage is unavailable */ }
      track("analysis_submit", placement);
      location.href = result.url ? `${result.url}&delivery=${result.emailSent ? "email" : "link"}` : `/report/${result.publicId}`;
    } catch (error) {
      setStatus("error");
      const detail = error instanceof Error ? error.message : "We couldn’t start the analysis.";
      setMessage(replaySaved ? `Your replay was saved securely, but the analysis did not start. Retry to reuse the saved file. ${detail}` : detail);
      track("analysis_failed", placement);
    }
  }

  return <form ref={formRef} id="replay-upload" data-hydrated="false" className={`quick-replay ${replay ? "has-file" : ""}`} aria-busy={status === "loading"} onSubmit={submit}>
    <div className="quick-replay-head"><div><span>ROCKET LEAGUE · FREE BETA</span><b>Drop a replay. Let the match fill in the rest.</b></div><i>FREE</i></div>
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
    {!replay && <div className="quick-upload-help"><p className="quick-promise">Upload first. Email only when your private result has somewhere to go.</p><details><summary>Where is my .replay file? <span>30-second guide</span></summary><ol><li><b>1</b><span>Press <strong>Windows + R</strong></span></li><li><b>2</b><span>Paste <code>%USERPROFILE%\Documents\My Games\Rocket League\TAGame\Demos</code></span></li><li><b>3</b><span>Choose your latest <strong>.replay</strong> file above</span></li></ol><Link href="/replay-upload">Open the full visual guide →</Link></details><details className="quick-other-device"><summary>On console—or browsing on your phone?</summary><div><button type="button" onClick={copyPcLink}>{handoffCopied ? "PC link copied ✓" : "Copy this page for your PC"}</button>{([["ps5", "PS5"], ["xbox", "Xbox"], ["switch", "Switch"]] as const).map(item => <button type="button" onClick={() => choosePlatform(item[0])} key={item[0]}>{item[1]} video path →</button>)}</div></details></div>}

    {replay && <div className="replay-value quick-replay-value" role="status" aria-live="polite">
      <div className="replay-value-head"><span>REPLAY VALIDATED</span><strong>Supported match file recognized.</strong><p>No gameplay claim has been made. This confirms the file is ready for secure parser checks.</p></div>
      <div className="replay-value-facts"><div><span>FORMAT</span><b>.replay</b><small>recognized</small></div><div><span>FILE SIZE</span><b>{fileSizeLabel(replay.size)}</b><small>non-empty</small></div><div><span>UPLOAD LIMIT</span><b>PASS</b><small>16 MB maximum</small></div></div>
      <div className="replay-value-plan"><span>NEXT: MATCH READ</span><p>The replay identifies the playlist and players. You choose yourself with one tap after parsing; Replay Method asks for the relevant rank only because the file does not contain it.</p></div>
    </div>}

    {replay && detailsOpen && <div className="quick-details" id="quick-replay-details">
      <label className="quick-email"><span>Where should we send your result?</span><input id="quick-replay-email" type="email" autoComplete="email" inputMode="email" value={email} onChange={event => { setEmail(event.target.value); stagedReplayRef.current = null; }} placeholder="you@email.com" required /></label>
      <p className="quick-email-note">Private delivery and recovery only. Marketing stays off unless you choose it below.</p>
      <label className="quick-check"><input type="checkbox" checked={dataConsent} onChange={event => setDataConsent(event.target.checked)} required /><span>Process this replay and email to deliver my private beta analysis. <a href="/privacy" target="_blank">Privacy</a></span></label>
      <button className="quick-submit" disabled={status === "loading"}><span aria-live="polite">{status === "loading" ? "SECURING AND READING YOUR MATCH…" : "ANALYZE THIS REPLAY — FREE →"}</span></button>
      <small>No card · 1v1, 2v2 and 3v3 · The engine stops instead of guessing</small>
    </div>}

    </> : <div className="console-path">
      <div className="console-path-top"><i>{platform === "ps5" ? "△○×□" : platform === "xbox" ? "X" : "◫"}</i><div><span>{consolePaths[platform].label.toUpperCase()} PATH</span><b>Capture research—not a live analysis.</b></div><em>NOT LIVE</em></div>
      <ol><li><i>1</i><div><b>Save the clearest clip or match</b><span>{consolePaths[platform].capture}</span></div></li><li><i>2</i><div><b>Keep the HUD visible</b><span>Do not crop the scoreboard, clock, boost meter or player view.</span></div></li><li><i>3</i><div><b>Keep the file for now</b><span>Replay Method will not collect it until the video lane can return a validated result.</span></div></li></ol>
      <p>{consolePaths[platform].limitation}</p>
      <div><Link className="console-primary" href={`/analyze?game=rocket-league&platform=${platform}`} onClick={() => track("cta_click", `${placement}_console_status`)}>CHECK CONSOLE STATUS <span>→</span></Link><a className="console-guide" href={consolePaths[platform].guide} target="_blank" rel="noreferrer">Official capture guide ↗</a></div><button className="console-back" type="button" onClick={() => choosePlatform("pc")}>← Use an original PC replay instead</button>
    </div>}

    {message && platform === "pc" && <p className={`quick-message ${status}`} role="alert">{message}</p>}
  </form>;
}
