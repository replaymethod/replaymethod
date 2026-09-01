"use client";

import { DragEvent, FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CustomerFooter, CustomerHeader } from "../components/CustomerChrome";
import { readApiResponse } from "../../lib/client-api-response.mjs";
import FreeAnalysisUsed, { FREE_ANALYSIS_USED_MESSAGE } from "../components/FreeAnalysisUsed";
import OwnerVerificationRequired, { OWNER_VERIFICATION_REQUIRED_MESSAGE } from "../components/OwnerVerificationRequired";
import { trackProductEvent } from "../../lib/client-analytics";

const TARGET = 10;
const MAX_REPLAY_BYTES = 16 * 1024 * 1024;
const RANKS = ["Gold I", "Gold II", "Gold III", "Platinum I", "Platinum II", "Platinum III", "Diamond I", "Diamond II", "Diamond III", "Champion I", "Champion II", "Champion III", "Grand Champion I", "Grand Champion II", "Grand Champion III", "Supersonic Legend"];
type BatchSession = { batchId: string; batchToken: string; reportUrl: string; validCount: number; targetCount: number; status: string; subjectDisplayName?: string | null; playlist?: string | null };
type FileRow = { key: string; file: File; status: "ready" | "uploading" | "processing" | "valid" | "excluded" | "error"; message: string };
type PendingUpload = { batchId: string; fileKey: string; uploadId: string; uploadToken: string; chunkSize: number; expectedParts: number; expiresAt: string };

const wait = (milliseconds: number) => new Promise(resolve => window.setTimeout(resolve, milliseconds));
const fileKey = (file: File) => `${file.name}:${file.size}:${file.lastModified}`;

function replayProblem(file: File) {
  if (!file.name.toLowerCase().endsWith(".replay")) return "Choose original Rocket League .replay files.";
  if (!file.size) return "An empty replay cannot be counted.";
  if (file.size > MAX_REPLAY_BYTES) return "Each replay must be no larger than 16 MB.";
  return "";
}

function storedSession(): BatchSession | null {
  try {
    const parsed = JSON.parse(localStorage.getItem("replaymethod-ten-replay-batch") || "null");
    return parsed?.batchId && parsed?.batchToken ? parsed : null;
  } catch { return null; }
}

function storedUpload(): PendingUpload | null {
  try { return JSON.parse(localStorage.getItem("replaymethod-ten-replay-upload") || "null"); } catch { return null; }
}

async function apiError(response: Response, fallback: string) {
  const payload = await readApiResponse(response) as { error?: unknown };
  return typeof payload.error === "string" ? payload.error : fallback;
}

type BatchAnalyzeFlowProps = {
  engineOpen: boolean;
  initialFreeAnalysisUsed?: boolean;
  variant?: "page" | "hero";
};

export default function BatchAnalyzeFlow({ engineOpen, initialFreeAnalysisUsed = false, variant = "page" }: BatchAnalyzeFlowProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const playerResolver = useRef<(() => void) | null>(null);
  const [ownerQa, setOwnerQa] = useState(false);
  const [email, setEmail] = useState("");
  const [rank, setRank] = useState("");
  const [goal, setGoal] = useState("");
  const [consent, setConsent] = useState(false);
  const [rows, setRows] = useState<FileRow[]>([]);
  const [session, setSession] = useState<BatchSession | null>(null);
  const [validCount, setValidCount] = useState(0);
  const [excludedCount, setExcludedCount] = useState(0);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [message, setMessage] = useState("");
  const [freeUsed, setFreeUsed] = useState(initialFreeAnalysisUsed);
  const [ownerVerificationRequired, setOwnerVerificationRequired] = useState(false);
  const pageRef = useRef<HTMLElement>(null);

  useEffect(() => {
    pageRef.current?.setAttribute("data-hydrated", "true");
    if (variant === "page") trackProductEvent("analysis_start", "rocket-league", "ten_replay_intake");
    fetch("/api/player/access", { cache: "no-store" }).then(response => response.json())
      .then((access: { ownerQa?: boolean }) => setOwnerQa(access.ownerQa === true)).catch(() => {});
    const saved = storedSession();
    if (!saved) return;
    if (variant === "hero" && saved.status === "ready") {
      localStorage.removeItem("replaymethod-ten-replay-batch");
      localStorage.removeItem("replaymethod-ten-replay-upload");
      return;
    }
    fetch("/api/replay-batches", {
      method: "POST", headers: { "Content-Type": "application/json", "X-Batch-Access": saved.batchToken },
      body: JSON.stringify({ resumeBatchId: saved.batchId }),
    }).then(async response => {
      if (!response.ok) return;
      const resumed = await response.json() as BatchSession;
      const merged = { ...saved, ...resumed, reportUrl: saved.reportUrl };
      if (variant === "hero" && merged.status === "ready") {
        localStorage.removeItem("replaymethod-ten-replay-batch");
        localStorage.removeItem("replaymethod-ten-replay-upload");
        return;
      }
      setSession(merged); setValidCount(Number(merged.validCount || 0));
      localStorage.setItem("replaymethod-ten-replay-batch", JSON.stringify(merged));
      setMessage(merged.status === "ready" ? "Your ten-match report is ready." : `Saved batch resumed at ${merged.validCount}/10.`);
    }).catch(() => {});
  }, [variant]);

  const updateRow = (key: string, status: FileRow["status"], rowMessage = "") => setRows(current => current.map(row => row.key === key ? { ...row, status, message: rowMessage } : row));

  const chooseFiles = (list: FileList | null) => {
    if (!list?.length || busy) return;
    const files = [...list];
    const queued = rows.filter(row => ["ready", "error"].includes(row.status));
    const knownKeys = new Set(rows.filter(row => row.status !== "excluded").map(row => row.key));
    let openSlots = Math.max(0, TARGET - validCount - queued.length);
    let accepted = 0;
    let rejected = 0;
    const additions: FileRow[] = [];

    for (const file of files) {
      const key = fileKey(file);
      const problem = replayProblem(file);
      if (problem) {
        additions.push({ key: `${key}:rejected:${rows.length + additions.length}`, file, status: "excluded", message: problem });
        rejected += 1;
        continue;
      }
      if (knownKeys.has(key)) {
        additions.push({ key: `${key}:duplicate:${rows.length + additions.length}`, file, status: "excluded", message: "Duplicate selection — choose a different match." });
        rejected += 1;
        continue;
      }
      if (openSlots === 0) {
        additions.push({ key: `${key}:extra:${rows.length + additions.length}`, file, status: "excluded", message: "Not added — all ten selection slots are already filled." });
        rejected += 1;
        continue;
      }
      additions.push({ key, file, status: "ready", message: "Ready to verify" });
      knownKeys.add(key);
      openSlots -= 1;
      accepted += 1;
    }

    setRows(current => [...current, ...additions]);
    trackProductEvent("replay_selected", "rocket-league", `ten_replay_${accepted}`);
    const stillNeeded = Math.max(0, openSlots);
    setMessage(rejected
      ? `${accepted} file${accepted === 1 ? "" : "s"} kept. ${rejected} need${rejected === 1 ? "s" : ""} replacing${stillNeeded ? `; add ${stillNeeded} more` : ""}.`
      : stillNeeded
        ? `${accepted} file${accepted === 1 ? "" : "s"} kept. Add ${stillNeeded} more to reach ten.`
        : "10 files ready. Each replay will be verified separately; a rejected file will not remove the others.");
    if (inputRef.current) inputRef.current.value = "";
  };

  const dropFiles = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragActive(false);
    chooseFiles(event.dataTransfer.files);
  };

  async function createBatch() {
    if (session) return session;
    const response = await fetch("/api/replay-batches", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, currentRank: rank, goal, dataConsent: consent }),
    });
    const result = await readApiResponse(response) as BatchSession & { error?: string; code?: string };
    if (!response.ok || !result.batchId || !result.batchToken) throw new Error(result.error || "The batch could not be started.");
    setSession(result);
    trackProductEvent("analysis_submit", "rocket-league", "ten_replay_batch_created");
    localStorage.setItem("replaymethod-ten-replay-batch", JSON.stringify(result));
    return result;
  }

  async function upload(file: File, batch: BatchSession) {
    let pending = storedUpload();
    if (!pending || pending.batchId !== batch.batchId || pending.fileKey !== fileKey(file) || new Date(pending.expiresAt) <= new Date()) {
      const startResponse = await fetch(`/api/replay-batches/${batch.batchId}/uploads`, {
        method: "POST", headers: { "Content-Type": "application/json", "X-Batch-Access": batch.batchToken },
        body: JSON.stringify({ fileName: file.name, fileSize: file.size }),
      });
      const start = await readApiResponse(startResponse) as PendingUpload & { error?: string };
      if (!startResponse.ok || !start.uploadId || !start.uploadToken) throw new Error(start.error || "The replay upload could not start.");
      pending = { ...start, batchId: batch.batchId, fileKey: fileKey(file) };
      localStorage.setItem("replaymethod-ten-replay-upload", JSON.stringify(pending));
    }
    for (let part = 0; part < pending.expectedParts; part += 1) {
      const offset = part * pending.chunkSize;
      let confirmed = false;
      for (let attempt = 0; attempt < 3 && !confirmed; attempt += 1) {
        const response = await fetch(`/api/replay-uploads/${pending.uploadId}/parts/${part}`, {
          method: "PUT", headers: { Authorization: `Bearer ${pending.uploadToken}`, "Content-Type": "application/octet-stream" },
          body: file.slice(offset, offset + pending.chunkSize),
        });
        confirmed = response.ok;
        if (!confirmed && attempt === 2) throw new Error(await apiError(response, "A replay part could not be saved."));
      }
    }
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const response = await fetch(`/api/replay-uploads/${pending.uploadId}/complete`, {
        method: "POST", headers: { Authorization: `Bearer ${pending.uploadToken}`, "Content-Type": "application/json" }, body: "{}",
      });
      if (response.ok) { localStorage.removeItem("replaymethod-ten-replay-upload"); return; }
      if (attempt === 7) throw new Error(await apiError(response, "The saved replay could not be assembled."));
      await wait(750 + attempt * 750);
    }
  }

  async function processSaved(batch: BatchSession) {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      const response = await fetch(`/api/replay-batches/${batch.batchId}/process`, { method: "POST", headers: { "X-Batch-Access": batch.batchToken } });
      const result = await readApiResponse(response) as {
        status?: string; validCount?: number; targetCount?: number; excludedCount?: number;
        candidatePlayers?: string[]; error?: string; accepted?: boolean; reportUrl?: string;
      };
      if (typeof result.validCount === "number") setValidCount(result.validCount);
      if (typeof result.excludedCount === "number") setExcludedCount(result.excludedCount);
      if (result.status === "awaiting_player") {
        setCandidates(Array.isArray(result.candidatePlayers) ? result.candidatePlayers : []);
        setMessage("Replay 1 is verified. Choose your exact player once; every later replay must match it.");
        await new Promise<void>(resolve => { playerResolver.current = resolve; });
        continue;
      }
      if (result.status === "excluded") return { status: "excluded", validCount: Number(result.validCount || 0), message: String(result.error || "This file needs a replacement.") };
      if (result.status === "ready") return { status: "ready", validCount: 10, reportUrl: batch.reportUrl };
      if (result.accepted || result.status === "collecting") return { status: "valid", validCount: Number(result.validCount || 0) };
      if (!response.ok && response.status < 500) throw new Error(String(result.error || "The replay could not be verified."));
      await wait(Number(response.headers.get("Retry-After") || 3) * 1000);
    }
    throw new Error("Replay verification is taking longer than expected. Retry to continue the same saved file.");
  }

  const lockPlayer = async () => {
    if (!session || !selectedPlayer || !rank) return;
    const response = await fetch(`/api/replay-batches/${session.batchId}`, {
      method: "POST", headers: { "Content-Type": "application/json", "X-Batch-Access": session.batchToken },
      body: JSON.stringify({ action: "choose_player", player: selectedPlayer, rank }),
    });
    if (!response.ok) { setMessage(await apiError(response, "The player could not be locked.")); return; }
    setCandidates([]);
    setMessage(`${selectedPlayer} is locked for all ten .replay files.`);
    playerResolver.current?.();
    playerResolver.current = null;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFreeUsed(false); setOwnerVerificationRequired(false);
    if (!engineOpen) return setMessage("Replay processing is temporarily paused.");
    if (session?.status === "ready" && validCount === TARGET) {
      location.href = session.reportUrl;
      return;
    }
    if (!ownerQa && !/^\S+@\S+\.\S+$/.test(email)) return setMessage("Enter a valid email for the private report.");
    if (!rank) return setMessage("Choose the rank for this playlist.");
    if (!consent) return setMessage("Confirm private processing of these ten .replay files.");
    const pendingRows = rows.filter(row => ["ready", "error"].includes(row.status));
    const required = TARGET - validCount;
    if (pendingRows.length !== required) return setMessage(`Choose exactly ${required} replay${required === 1 ? "" : "s"} for the remaining valid slots.`);
    setBusy(true);
    try {
      const batch = await createBatch();
      let latestValidCount = validCount;
      for (const row of pendingRows) {
        updateRow(row.key, "uploading", "Saving byte-verified original…");
        await upload(row.file, batch);
        updateRow(row.key, "processing", "Verifying player, playlist and match…");
        const result = await processSaved(batch);
        latestValidCount = result.validCount;
        if (result.status === "excluded") {
          updateRow(row.key, "excluded", result.message || "Replacement required");
          trackProductEvent("validation_failed", "rocket-league", "ten_replay_excluded");
          continue;
        }
        updateRow(row.key, "valid", "Verified and counted");
        trackProductEvent("upload_complete", "rocket-league", "ten_replay_valid");
        if (result.status === "ready") {
          const saved = { ...batch, validCount: 10, status: "ready" };
          localStorage.setItem("replaymethod-ten-replay-batch", JSON.stringify(saved));
          const ids = JSON.parse(localStorage.getItem("replaymethod-report-ids") || "[]") as string[];
          localStorage.setItem("replaymethod-report-ids", JSON.stringify([batch.batchId, ...ids.filter(id => id !== batch.batchId)].slice(0, 20)));
          const access = JSON.parse(localStorage.getItem("replaymethod-report-access") || "{}") as Record<string, string>;
          localStorage.setItem("replaymethod-report-access", JSON.stringify({ ...access, [batch.batchId]: batch.batchToken }));
          trackProductEvent("analysis_completed", "rocket-league", "ten_replay_report_ready");
          location.href = batch.reportUrl;
          return;
        }
      }
      const remaining = TARGET - latestValidCount;
      setMessage(remaining > 0 ? `Batch saved. Replace ${remaining} excluded replay${remaining === 1 ? "" : "s"}; invalid files did not consume a slot.` : "Building your ten-match report…");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "The saved batch could not continue.";
      setFreeUsed(detail === FREE_ANALYSIS_USED_MESSAGE);
      setOwnerVerificationRequired(detail === OWNER_VERIFICATION_REQUIRED_MESSAGE);
      setMessage(detail === FREE_ANALYSIS_USED_MESSAGE || detail === OWNER_VERIFICATION_REQUIRED_MESSAGE ? "" : detail);
      const active = rows.find(row => ["uploading", "processing"].includes(row.status));
      if (active) updateRow(active.key, "error", "Saved — retry to continue");
    } finally { setBusy(false); }
  };

  const remaining = TARGET - validCount;
  const queuedCount = rows.filter(row => ["ready", "error"].includes(row.status)).length;
  const selectionRemaining = Math.max(0, remaining - queuedCount);
  const displayedExcluded = Math.max(excludedCount, rows.filter(row => row.status === "excluded").length);
  const reportReady = session?.status === "ready" && validCount === TARGET;
  const hasStarted = rows.length > 0 || session !== null;
  const readyToSubmit = reportReady || (queuedCount === remaining && queuedCount > 0);

  if (variant === "hero") return <section ref={pageRef} className="reveal-home-intake" id="ten-replay-start" data-hydrated="false" tabIndex={-1} aria-label="Upload ten .replay files from the home page">
    <form onSubmit={submit} aria-busy={busy}>
      <header>
        <div><small className="rm-section-prompt">Ready to find what repeats?</small><strong>{reportReady ? "Your private report is ready" : hasStarted ? "Finish adding your .replay files" : "Upload your 10 PC .replay files"}</strong></div>
        <p>PC .replay files only. One player, one ranked mode.</p>
      </header>
      {selectionRemaining > 0 && <label className={`reveal-home-drop ${queuedCount ? "has-files" : ""} ${dragActive ? "drag-active" : ""}`} onDragEnter={event => { event.preventDefault(); setDragActive(true); }} onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setDragActive(true); }} onDragLeave={event => { if (event.currentTarget === event.target) setDragActive(false); }} onDrop={dropFiles}>
        <input ref={inputRef} type="file" multiple accept=".replay,application/octet-stream" onChange={event => chooseFiles(event.target.files)} disabled={busy} />
        <i aria-hidden="true">↑</i>
        <b>{selectionRemaining === 10 ? "Drop 10 Rocket League .replay files" : `Add ${selectionRemaining} more .replay file${selectionRemaining === 1 ? "" : "s"}`}</b>
        <small>Choose all 10 from your PC replay folder.</small>
      </label>}
      {hasStarted && <>
        <div className="reveal-home-progress-copy" aria-live="polite"><span>{queuedCount + validCount} of 10 added</span><small>{validCount} verified</small></div>
        <div className="reveal-report-progress" aria-label={`${queuedCount + validCount} of 10 added .replay files`}><i style={{ width: `${(queuedCount + validCount) * 10}%` }} /></div>
        {rows.length > 0 && <div className="reveal-home-files" aria-label="Replay verification list" aria-live="polite">{rows.map((row, index) => <article className={row.status} key={row.key}><i>{row.status === "valid" ? "✓" : row.status === "excluded" ? "×" : String(index + 1).padStart(2, "0")}</i><div><b>{row.file.name}</b><small>{row.message}</small></div></article>)}</div>}
        {!reportReady && <div className="reveal-home-fields">
          {!ownerQa && <label className="wide"><span>Email for your private report</span><input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required /></label>}
          {ownerQa && <div className="quick-owner-verified wide" role="status"><i>✓</i><div><b>OWNER QA VERIFIED</b><span>Unlimited QA · excluded from product metrics and calibration</span></div></div>}
          <label><span>Current playlist rank</span><select value={rank} onChange={event => setRank(event.target.value)} required><option value="">Choose rank</option>{RANKS.map(item => <option value={item} key={item}>{item}</option>)}</select></label>
          <label className="wide"><span>What do you want to stop repeating? <small>Optional</small></span><textarea value={goal} onChange={event => setGoal(event.target.value)} maxLength={500} placeholder="Replay evidence still decides what is supported." /></label>
          <label className="check wide"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} required /><span>I agree to private processing of these ten .replay files. <a href="/privacy" target="_blank">Privacy</a></span></label>
        </div>}
        {candidates.length > 0 && <section className="reveal-home-player" aria-labelledby="home-player-title"><span>PLAYER IDENTITY · LOCK ONCE</span><h3 id="home-player-title">Which player is you?</h3><p>Every accepted .replay file must contain this exact verified player.</p><div role="radiogroup" aria-label="Players found in .replay file 1">{candidates.map(player => <button type="button" role="radio" aria-checked={selectedPlayer === player} className={selectedPlayer === player ? "active" : ""} onClick={() => setSelectedPlayer(player)} key={player}>{player}</button>)}</div><button type="button" disabled={!selectedPlayer || !rank} onClick={lockPlayer}>Lock this player for all 10 →</button></section>}
        <button className="reveal-primary reveal-home-submit" formNoValidate={reportReady} disabled={busy || !readyToSubmit || candidates.length > 0}><span>{busy ? candidates.length ? "Waiting for player…" : `Verifying ${validCount}/10…` : reportReady ? "Open my private report →" : selectionRemaining ? `Add ${selectionRemaining} more .replay file${selectionRemaining === 1 ? "" : "s"}` : "Verify my 10 .replay files →"}</span></button>
      </>}
      <div className="reveal-home-help"><Link href="/replay-upload" target="_blank" rel="noreferrer">Can&apos;t find your .replay files?</Link><Link href="/analyze">Use the full upload page</Link></div>
      {freeUsed && <FreeAnalysisUsed />}{ownerVerificationRequired && <OwnerVerificationRequired />}{message && <p className="reveal-home-message" role="alert">{message}</p>}
    </form>
  </section>;

  return <main ref={pageRef} className="intake-page batch-intake-page" data-hydrated="false">
    <CustomerHeader current="product" right={<><Link href="/reports">My reports</Link><Link className="rm-header-cta" href="/">Home <span aria-hidden="true">↗</span></Link></>} />
    <section className="intake-shell shell">
      <header className="intake-header"><div><span>Private Rocket League analysis</span><h1>Find the decision that keeps repeating.</h1></div><aside><p>Drop ten ranked PC .replay files from one player and playlist. Get one supported focus—not a stat dump.</p><div><a href="#replay-batch">Analyze my replays</a><Link href="/replay-upload">Find the files</Link></div><small>PC only · Private · No card · Resumable</small></aside></header>
      {hasStarted && <div className="intake-progress" aria-label={`${validCount} of 10 verified replays`}><i style={{ width: `${validCount * 10}%` }} /><span>{validCount} of 10 verified</span></div>}
      <form className="intake-card batch-intake" id="replay-batch" onSubmit={submit} aria-busy={busy}>
        <div className="batch-sandbox-tabs" aria-label="Private replay workspace"><span className="active">Private replay workspace</span><small>{hasStarted ? `${validCount} of 10 verified${displayedExcluded ? ` · ${displayedExcluded} replaced` : ""}` : "Same player · Same playlist"}</small></div>
        <section><span className="intake-kicker">Step 1 · Your replays</span><h2>{remaining === 10 && selectionRemaining === 10 ? "Choose ten ranked matches." : remaining ? `Add ${selectionRemaining} more replay${selectionRemaining === 1 ? "" : "s"}.` : "All ten matches are verified."}</h2><p className="intake-explain">Same player. Same ranked 1v1, 2v2 or 3v3 playlist. We keep every valid file and explain every exclusion.</p>
          {selectionRemaining > 0 && <label className={`file-drop ${rows.some(row => row.status === "ready") ? "has-file" : ""} ${dragActive ? "drag-active" : ""}`} onDragEnter={event => { event.preventDefault(); setDragActive(true); }} onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setDragActive(true); }} onDragLeave={event => { if (event.currentTarget === event.target) setDragActive(false); }} onDrop={dropFiles}><input ref={inputRef} type="file" multiple accept=".replay,application/octet-stream" onChange={event => chooseFiles(event.target.files)} disabled={busy} /><i>↥</i><b>{selectionRemaining === 10 ? "Choose or drop 10 .replay files" : `Choose or drop ${selectionRemaining} replacement file${selectionRemaining === 1 ? "" : "s"}`}</b><small>Original PC files · pick all ten at once · 16 MB max each · resumable</small></label>}
          <Link className="replay-file-help" href="/replay-upload" target="_blank" rel="noreferrer">Can’t find the files? <span>Open the guide →</span></Link>
          {rows.length > 0 && <div className="batch-file-list" aria-label="Replay verification list" aria-live="polite">{rows.map((row, index) => <article className={row.status} key={row.key}><i>{row.status === "valid" ? "✓" : row.status === "excluded" ? "×" : String(index + 1).padStart(2, "0")}</i><div><b>{row.file.name}</b><small>{row.message}</small></div></article>)}</div>}
        </section>
        <section><span className="intake-kicker">Step 2 · Your context</span><h2>Where should we send the result?</h2><p className="intake-explain">Rank and playlist context help us read the same player consistently across all ten matches.</p><div className="field-grid">
          {!ownerQa && <label className="wide"><span>Email for the private report *</span><input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required /></label>}
          {ownerQa && <div className="quick-owner-verified wide" role="status"><i>✓</i><div><b>OWNER QA VERIFIED</b><span>Unlimited QA · excluded from product metrics and calibration</span></div></div>}
          <label><span>Current playlist rank *</span><select value={rank} onChange={event => setRank(event.target.value)} required><option value="">Choose rank</option>{RANKS.map(item => <option value={item} key={item}>{item}</option>)}</select></label>
          <label className="wide"><span>What do you want to stop repeating?</span><textarea value={goal} onChange={event => setGoal(event.target.value)} maxLength={500} placeholder="Optional. Replay evidence still decides what is supported." /></label>
          <label className="check wide"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} required /><span>I agree that Replay Method may privately process these ten original replay files to deliver my report. <a href="/privacy" target="_blank">Privacy</a></span></label>
        </div></section>
        {candidates.length > 0 && <section className="player-resolution" aria-labelledby="batch-player-title"><div><span>PLAYER IDENTITY · LOCK ONCE</span><h3 id="batch-player-title">Which player is you?</h3><p>Every accepted replay must contain this exact verified player.</p></div><div className="player-resolution-options" role="radiogroup" aria-label="Players found in replay 1">{candidates.map(player => <button type="button" role="radio" aria-checked={selectedPlayer === player} className={selectedPlayer === player ? "active" : ""} onClick={() => setSelectedPlayer(player)} key={player}>{player}</button>)}</div><button className="player-resolution-submit" type="button" disabled={!selectedPlayer || !rank} onClick={lockPlayer}>Lock this player for all 10 →</button></section>}
        <button className="submit-analysis" formNoValidate={reportReady} disabled={busy || (remaining === 0 && !reportReady) || candidates.length > 0}><span>{busy ? candidates.length ? "WAITING FOR PLAYER…" : `VERIFYING ${validCount}/10…` : session ? `CONTINUE SAVED REVIEW · ${validCount}/10 →` : "START MY PRIVATE ANALYSIS →"}</span></button>
        <small className="submission-note">One free ten-replay batch · No card · Invalid replacements do not consume valid slots.</small>
        {freeUsed && <FreeAnalysisUsed />}{ownerVerificationRequired && <OwnerVerificationRequired />}{message && <p className="intake-message" role="alert">{message}</p>}
      </form>

      <section className="rm-analysis-after" aria-labelledby="analysis-after-title">
        <header><span>After the upload</span><h2 id="analysis-after-title">The complexity stays inside the engine.</h2><p>Your report opens with the answer. The evidence is there when you want to inspect it.</p></header>
        <div>
          <article><i>01</i><h3>Verify the set</h3><p>Same player, same ranked playlist, ten valid original replays.</p></article>
          <article><i>02</i><h3>Compare decisions</h3><p>Similar opportunities are read with possession, pressure, access and coverage.</p></article>
          <article><i>03</i><h3>Release one focus</h3><p>Only a supported repeated pattern becomes your next-session plan.</p></article>
        </div>
      </section>
    </section>
    <CustomerFooter />
  </main>;
}
