"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
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

export default function BatchAnalyzeFlow({ engineOpen, initialFreeAnalysisUsed = false }: { engineOpen: boolean; initialFreeAnalysisUsed?: boolean }) {
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
  const [message, setMessage] = useState("");
  const [freeUsed, setFreeUsed] = useState(initialFreeAnalysisUsed);
  const [ownerVerificationRequired, setOwnerVerificationRequired] = useState(false);
  const pageRef = useRef<HTMLElement>(null);

  useEffect(() => {
    pageRef.current?.setAttribute("data-hydrated", "true");
    trackProductEvent("analysis_start", "rocket-league", "ten_replay_intake");
    fetch("/api/player/access", { cache: "no-store" }).then(response => response.json())
      .then((access: { ownerQa?: boolean }) => setOwnerQa(access.ownerQa === true)).catch(() => {});
    const saved = storedSession();
    if (!saved) return;
    fetch("/api/replay-batches", {
      method: "POST", headers: { "Content-Type": "application/json", "X-Batch-Access": saved.batchToken },
      body: JSON.stringify({ resumeBatchId: saved.batchId }),
    }).then(async response => {
      if (!response.ok) return;
      const resumed = await response.json() as BatchSession;
      const merged = { ...saved, ...resumed, reportUrl: saved.reportUrl };
      setSession(merged); setValidCount(Number(merged.validCount || 0));
      localStorage.setItem("replaymethod-ten-replay-batch", JSON.stringify(merged));
      setMessage(merged.status === "ready" ? "Your ten-match report is ready." : `Saved batch resumed at ${merged.validCount}/10.`);
    }).catch(() => {});
  }, []);

  const updateRow = (key: string, status: FileRow["status"], rowMessage = "") => setRows(current => current.map(row => row.key === key ? { ...row, status, message: rowMessage } : row));

  const chooseFiles = (list: FileList | null) => {
    if (!list) return;
    const files = [...list];
    const problem = files.map(replayProblem).find(Boolean);
    if (problem) { setMessage(problem); if (inputRef.current) inputRef.current.value = ""; return; }
    const unique = files.filter((file, index) => files.findIndex(candidate => fileKey(candidate) === fileKey(file)) === index);
    const required = TARGET - validCount;
    if (unique.length !== required) {
      setMessage(`Choose exactly ${required} replay${required === 1 ? "" : "s"} to fill the remaining ${required} valid slot${required === 1 ? "" : "s"}.`);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setRows(current => [...current.filter(row => ["valid", "excluded"].includes(row.status)), ...unique.map(file => ({ key: fileKey(file), file, status: "ready" as const, message: "Ready" }))]);
    trackProductEvent("replay_selected", "rocket-league", `ten_replay_${unique.length}`);
    setMessage(`${unique.length} replay${unique.length === 1 ? "" : "s"} ready. Files are verified one at a time; invalid files can be replaced.`);
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
      if (result.status === "excluded") return { status: "excluded", message: String(result.error || "This file needs a replacement.") };
      if (result.status === "ready") return { status: "ready", reportUrl: batch.reportUrl };
      if (result.accepted || result.status === "collecting") return { status: "valid" };
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
    setMessage(`${selectedPlayer} is locked for all ten replays.`);
    playerResolver.current?.();
    playerResolver.current = null;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFreeUsed(false); setOwnerVerificationRequired(false);
    if (!engineOpen) return setMessage("Replay processing is temporarily paused.");
    if (!ownerQa && !/^\S+@\S+\.\S+$/.test(email)) return setMessage("Enter a valid email for the private report.");
    if (!rank) return setMessage("Choose the rank for this playlist.");
    if (!consent) return setMessage("Confirm private processing of these ten replays.");
    const pendingRows = rows.filter(row => ["ready", "error"].includes(row.status));
    const required = TARGET - validCount;
    if (pendingRows.length !== required) return setMessage(`Choose exactly ${required} replay${required === 1 ? "" : "s"} for the remaining valid slots.`);
    setBusy(true);
    try {
      const batch = await createBatch();
      for (const row of pendingRows) {
        updateRow(row.key, "uploading", "Saving byte-verified original…");
        await upload(row.file, batch);
        updateRow(row.key, "processing", "Verifying player, playlist and match…");
        const result = await processSaved(batch);
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
      const remaining = TARGET - validCount;
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
  return <main ref={pageRef} className="intake-page batch-intake-page" data-hydrated="false">
    <nav className="tool-nav shell"><Link className="brand" href="/"><span className="logo" aria-hidden="true" /><span>replay<span>method</span></span></Link><div><Link href="/reports">My reports</Link><Link href="/">Exit</Link></div></nav>
    <section className="intake-shell shell">
      <header className="intake-header"><div><span>FREE TEN-MATCH BASELINE</span><h1>10 games in.<br /><em>One clear plan out.</em></h1><p>Upload ten original ranked PC replays from the same player and playlist. We separate recurring patterns from one-off moments.</p></div><aside><b>{validCount}/10</b><span>VERIFIED REPLAYS</span><small>{excludedCount ? `${excludedCount} excluded · ` : ""}Private · No card · Resumable</small></aside></header>
      <div className="intake-progress" aria-label={`${validCount} of 10 verified replays`}><i style={{ width: `${validCount * 10}%` }} /><span>{validCount} / 10</span></div>
      <form className="intake-card batch-intake" onSubmit={submit} aria-busy={busy}>
        <section><span className="intake-kicker">EXACTLY TEN VALID MATCHES</span><h2>{remaining === 10 ? "Choose your ten representative replays." : remaining ? `Add ${remaining} replacement replay${remaining === 1 ? "" : "s"}.` : "All ten matches are verified."}</h2><p className="intake-explain">Same player · same ranked 1v1, 2v2 or 3v3 playlist. Duplicate, unreadable, wrong-player and wrong-playlist files are excluded and replaced without using another free batch.</p>
          {remaining > 0 && <label className={`file-drop ${rows.some(row => row.status === "ready") ? "has-file" : ""}`}><input ref={inputRef} type="file" multiple accept=".replay,application/octet-stream" onChange={event => chooseFiles(event.target.files)} disabled={busy} /><i>↥</i><b>{remaining === 10 ? "Choose exactly 10 original .replay files" : `Choose exactly ${remaining} replacement file${remaining === 1 ? "" : "s"}`}</b><small>Maximum 16 MB each · originals stay private · uploads resume safely</small></label>}
          <Link className="replay-file-help" href="/replay-upload" target="_blank" rel="noreferrer">Can’t find the files? <span>Open the guide →</span></Link>
          {rows.length > 0 && <div className="batch-file-list" aria-label="Replay verification list">{rows.map((row, index) => <article className={row.status} key={row.key}><i>{row.status === "valid" ? "✓" : row.status === "excluded" ? "×" : String(index + 1).padStart(2, "0")}</i><div><b>{row.file.name}</b><small>{row.message}</small></div></article>)}</div>}
        </section>
        <section><span className="intake-kicker">PLAYER CONTEXT &amp; PRIVATE DELIVERY</span><h2>One context, used consistently across the batch.</h2><div className="field-grid">
          {!ownerQa && <label className="wide"><span>Email for the private report *</span><input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required /></label>}
          {ownerQa && <div className="quick-owner-verified wide" role="status"><i>✓</i><div><b>OWNER QA VERIFIED</b><span>Unlimited QA · excluded from product metrics and calibration</span></div></div>}
          <label><span>Current playlist rank *</span><select value={rank} onChange={event => setRank(event.target.value)} required><option value="">Choose rank</option>{RANKS.map(item => <option value={item} key={item}>{item}</option>)}</select></label>
          <label className="wide"><span>What do you want to stop repeating?</span><textarea value={goal} onChange={event => setGoal(event.target.value)} maxLength={500} placeholder="Optional. Replay evidence still decides what is supported." /></label>
          <label className="check wide"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} required /><span>I agree that Replay Method may privately process these ten original replay files to deliver my report. <a href="/privacy" target="_blank">Privacy</a></span></label>
        </div></section>
        {candidates.length > 0 && <section className="player-resolution" aria-labelledby="batch-player-title"><div><span>PLAYER IDENTITY · LOCK ONCE</span><h3 id="batch-player-title">Which player is you?</h3><p>Every accepted replay must contain this exact verified player.</p></div><div className="player-resolution-options" role="radiogroup" aria-label="Players found in replay 1">{candidates.map(player => <button type="button" role="radio" aria-checked={selectedPlayer === player} className={selectedPlayer === player ? "active" : ""} onClick={() => setSelectedPlayer(player)} key={player}>{player}</button>)}</div><button className="player-resolution-submit" type="button" disabled={!selectedPlayer || !rank} onClick={lockPlayer}>Lock this player for all 10 →</button></section>}
        <button className="submit-analysis" disabled={busy || remaining === 0 || candidates.length > 0}><span>{busy ? candidates.length ? "WAITING FOR PLAYER…" : `VERIFYING ${validCount}/10…` : session ? `CONTINUE SAVED BATCH · ${validCount}/10 →` : "START MY FREE 10-REPLAY BASELINE →"}</span></button>
        <small className="submission-note">One free ten-replay batch · No card · Invalid replacements do not consume valid slots.</small>
        {freeUsed && <FreeAnalysisUsed />}{ownerVerificationRequired && <OwnerVerificationRequired />}{message && <p className="intake-message" role="alert">{message}</p>}
      </form>
      <footer className="intake-footer"><span>Ten matches. Recurrence first. One plan.</span><div><Link href="/privacy">Privacy</Link><Link href="/beta-terms">Beta terms</Link><a href="mailto:contact@replaymethod.xyz">Contact</a></div></footer>
    </section>
  </main>;
}
