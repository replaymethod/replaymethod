"use client";

import { ChangeEvent, DragEvent, FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { analyticsAttribution, trackProductEvent } from "../../lib/client-analytics";

const MAX_REPLAY_BYTES = 16 * 1024 * 1024;

type Status = "idle" | "submitting" | "success" | "error";

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function validateReplay(file: File | null) {
  if (!file) return "Choose an original Rocket League .replay file.";
  if (!file.name.toLowerCase().endsWith(".replay")) return "That is not an original .replay file.";
  if (file.size === 0) return "That replay is empty.";
  if (file.size > MAX_REPLAY_BYTES) return "That replay is larger than 16 MB.";
  return "";
}

export default function ReplayContribution({ intakeOpen, compact = false }: { intakeOpen: boolean; compact?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [replay, setReplay] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [reference, setReference] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  function acceptFile(file: File | null) {
    const problem = validateReplay(file);
    setFileError(problem);
    setReplay(problem ? null : file);
    setStatus("idle");
    setMessage("");
    if (!problem && file) {
      trackProductEvent("replay_selected", "rocket-league", "marcel_native_picker");
      trackProductEvent("calibration_start", "rocket-league", "beta_replay_selected");
    }
  }

  function choose(event: ChangeEvent<HTMLInputElement>) {
    acceptFile(event.target.files?.[0] ?? null);
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    acceptFile(event.dataTransfer.files?.[0] ?? null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!replay) {
      setFileError(validateReplay(replay));
      return;
    }
    setStatus("submitting");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const attribution = analyticsAttribution();
    form.set("replay", replay);
    form.set("source", attribution.source);
    form.set("campaign", attribution.campaign);
    form.set("calibrationConsent", String(form.get("calibrationConsent") === "on"));
    form.set("rightsConfirmed", String(form.get("rightsConfirmed") === "on"));
    form.set("updatesConsent", String(form.get("updatesConsent") === "on"));

    try {
      const response = await fetch("/api/rl-beta-submissions", { method: "POST", body: form });
      const result = await response.json() as { received?: boolean; publicId?: string; error?: string };
      if (!response.ok || !result.received || !result.publicId) throw new Error(result.error || "We couldn’t secure that replay.");
      setReference(result.publicId.slice(0, 10).toUpperCase());
      setStatus("success");
      trackProductEvent("calibration_submit", "rocket-league", "beta_replay_secured");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "We couldn’t secure that replay. Try again.");
    }
  }

  async function copyPcLink() {
    try {
      await navigator.clipboard.writeText(location.href);
      setCopyStatus("Link copied");
    } catch {
      setCopyStatus("Copy this page’s address");
    }
  }

  if (!intakeOpen) {
    return <section className={`rl-intake-closed ${compact ? "compact" : ""}`} id="beta-intake" aria-labelledby="rl-intake-title">
      <span>ROCKET LEAGUE BETA · PAUSED</span>
      <h1 id="rl-intake-title">Replay uploads are closed right now.</h1>
      <p>The secure intake is ready, but no file is accepted while the collection switch is off.</p>
      <Link href="/rocket-league#join-beta">Get the opening email <b>→</b></Link>
    </section>;
  }

  if (status === "success") {
    return <section className={`rl-intake-success ${compact ? "compact" : ""}`} id="beta-intake" aria-live="polite">
      <i>✓</i>
      <span>REPLAY SECURED</span>
      <h1>Your replay made it.</h1>
      <p>Reference <b>{reference}</b>. The file and consent are stored privately. It is now waiting for a real parser and reviewer check—this is not a generated analysis.</p>
      <div><b>What happens next?</b><ol><li>The replay is checked for usable match evidence.</li><li>Qualified reviewers label detector moments independently.</li><li>Only validated patterns may later enter player reports.</li></ol></div>
      <button type="button" onClick={() => { setReplay(null); setReference(""); setStatus("idle"); }}>Send another replay</button>
    </section>;
  }

  return <form className={`rl-intake ${compact ? "compact" : ""}`} id="beta-intake" onSubmit={submit} aria-labelledby="rl-intake-title">
    <header>
      <span>START HERE</span>
      <h1 id="rl-intake-title">{compact ? "Drop your replay." : "Your replay is the starting point."}</h1>
      <p>{compact ? "Choose the original PC file. The next step appears instantly." : "Choose one original PC replay. We ask only for the context required to keep the evidence honest."}</p>
    </header>

    <div
      className={`rl-replay-drop ${dragging ? "dragging" : ""} ${replay ? "accepted" : ""}`}
      onDragEnter={event => { event.preventDefault(); setDragging(true); }}
      onDragOver={event => event.preventDefault()}
      onDragLeave={() => setDragging(false)}
      onDrop={drop}
    >
      <input ref={inputRef} id="replay" name="replay" type="file" accept=".replay" onChange={choose} />
      <button type="button" onClick={() => inputRef.current?.click()}>
        <i>{replay ? "✓" : "↓"}</i>
        <span>{replay ? replay.name : "Choose your .replay"}<small>{replay ? `${formatBytes(replay.size)} · file accepted` : "or drop it here · max 16 MB"}</small></span>
        <b>{replay ? "Change" : "Choose"}</b>
      </button>
    </div>
    <p className="rl-file-error" role="alert">{fileError}</p>
    {!replay && <div className="rl-pc-handoff"><span>Your replay is on your PC.</span><button type="button" onClick={copyPcLink}>{copyStatus || "Copy this page for later"}</button></div>}

    {replay && <section className="rl-intake-context">
      <div className="rl-intake-steps" aria-label="Replay intake progress"><span className="done"><i>✓</i> File</span><span className="active"><i>2</i> Context</span><span><i>3</i> Secured</span></div>
      <div className="rl-context-heading"><span>LAST STEP</span><h2>Who are you in this match?</h2><p>Three details keep the replay attributable and useful.</p></div>
      <div className="rl-context-grid">
        <label><span>Exact in-game name</span><input name="playerName" type="text" autoComplete="off" required minLength={1} maxLength={80} placeholder="Your name in this replay" /></label>
        <label><span>Current 2v2 rank</span><select name="rankCohort" required defaultValue=""><option value="" disabled>Choose rank group</option><option value="bronze-silver">Bronze–Silver</option><option value="gold-platinum">Gold–Platinum</option><option value="diamond-champion">Diamond–Champion</option><option value="grand-champion-ssl">Grand Champion–SSL</option></select></label>
        <label><span>Email for your receipt</span><input name="email" type="email" autoComplete="email" inputMode="email" required placeholder="you@email.com" /></label>
      </div>
      <input className="hp-field" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <div className="rl-intake-consents">
        <label><input name="calibrationConsent" type="checkbox" required /><span>I allow Replay Method to privately store and review this replay to validate the Rocket League analysis.</span></label>
        <label><input name="rightsConfirmed" type="checkbox" required /><span>I am permitted to share this replay.</span></label>
        <label><input name="updatesConsent" type="checkbox" /><span>Email me when the private beta opens. Optional.</span></label>
      </div>
      <p className="rl-consent-links"><Link href="/privacy">Privacy</Link> · <Link href="/beta-terms">Beta terms</Link> · No public profile · No automatic coaching claim</p>
      <button className="rl-submit" disabled={status === "submitting"}>{status === "submitting" ? "Securing your replay…" : "Secure my replay"}<b>→</b></button>
      <p className={`rl-submit-message ${status}`} role="alert">{message}</p>
    </section>}
  </form>;
}
