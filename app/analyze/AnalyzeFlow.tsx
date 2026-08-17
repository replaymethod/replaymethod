"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { AnalysisGame } from "../../lib/analysis";

const games: { key: AnalysisGame; mark: string; name: string; proof: string; input: string }[] = [
  { key: "league", mark: "L", name: "League of Legends", proof: "Official Riot connection in approval", input: "Riot ID and a representative match link" },
  { key: "valorant", mark: "V", name: "VALORANT", proof: "Official Riot connection in approval", input: "Riot ID and a representative match link" },
  { key: "rocket-league", mark: "RL", name: "Rocket League", proof: "Deterministic .replay analysis", input: "Original PC .replay file" }
];

const contextLabels: Record<AnalysisGame, { label: string; placeholder: string }> = {
  league: { label: "Riot ID + role/champion", placeholder: "Player#EUW · Jungle · Lee Sin" },
  valorant: { label: "Riot ID + role/agent", placeholder: "Player#EU · Controller · Omen" },
  "rocket-league": { label: "Exact in-game player name", placeholder: "PlayerName — exactly as shown in the replay" }
};

function attribution() {
  const params = new URLSearchParams(location.search);
  return { source: (params.get("utm_source") || "direct").slice(0, 80), campaign: (params.get("utm_campaign") || "").slice(0, 120) };
}

function track(event: string, game: AnalysisGame | null, placement: string) {
  try {
    let visitorId = sessionStorage.getItem("replaymethod-session-id");
    if (!visitorId) { visitorId = crypto.randomUUID(); sessionStorage.setItem("replaymethod-session-id", visitorId); }
    void fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true, body: JSON.stringify({ visitorId, event, game: game || "general", placement, path: location.pathname, ...attribution() }) });
  } catch { /* measurement never blocks submission */ }
}

export default function AnalyzeFlow({ initialGame }: { initialGame: AnalysisGame | null }) {
  const [step, setStep] = useState(initialGame ? 1 : 0);
  const [game, setGame] = useState<AnalysisGame | null>(initialGame);
  const [currentRank, setCurrentRank] = useState("");
  const [targetRank, setTargetRank] = useState("");
  const [playerContext, setPlayerContext] = useState("");
  const [goal, setGoal] = useState("");
  const [notes, setNotes] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [replay, setReplay] = useState<File | null>(null);
  const [email, setEmail] = useState("");
  const [dataConsent, setDataConsent] = useState(false);
  const [updatesConsent, setUpdatesConsent] = useState(true);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => { track("analysis_start", initialGame, "analysis_page"); }, [initialGame]);
  const selected = useMemo(() => games.find(item => item.key === game), [game]);

  const chooseGame = (value: AnalysisGame) => {
    setGame(value);
    setReplay(null);
    setEvidenceUrl("");
    track("game_select", value, "analysis_intake");
    setStep(1);
  };

  const next = () => {
    setMessage("");
    if (step === 1 && (!currentRank.trim() || !playerContext.trim() || goal.trim().length < 8)) return setMessage("Add your rank, player identity and what you want to improve.");
    if (step === 2 && game === "rocket-league" && !replay) return setMessage("Upload the original Rocket League .replay file so the match can be parsed safely.");
    if (step === 2 && game !== "rocket-league" && !evidenceUrl.trim()) return setMessage("Add one representative match link for the Riot access beta.");
    if (step === 2 && replay && replay.size > 16 * 1024 * 1024) return setMessage("That replay is larger than 16 MB. Choose the original replay file from a completed match.");
    setStep(value => Math.min(3, value + 1));
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!game) return;
    setStatus("loading");
    setMessage("");
    const data = new FormData();
    data.set("game", game);
    data.set("currentRank", currentRank);
    data.set("targetRank", targetRank);
    data.set("playerContext", playerContext);
    data.set("goal", goal);
    data.set("notes", notes);
    data.set("evidenceUrl", evidenceUrl);
    data.set("email", email);
    data.set("dataConsent", String(dataConsent));
    data.set("updatesConsent", String(updatesConsent));
    data.set("company", "");
    const attr = attribution();
    data.set("source", attr.source);
    data.set("campaign", attr.campaign);
    if (replay) data.set("replay", replay);

    try {
      const response = await fetch("/api/analyses", { method: "POST", body: data });
      const result = await response.json() as { publicId?: string; emailSent?: boolean; error?: string };
      if (!response.ok || !result.publicId) throw new Error(result.error || "Try again.");
      const stored = JSON.parse(localStorage.getItem("replaymethod-report-ids") || "[]") as string[];
      localStorage.setItem("replaymethod-report-ids", JSON.stringify([result.publicId, ...stored.filter(id => id !== result.publicId)].slice(0, 20)));
      track("analysis_submit", game, replay ? "replay_upload" : "evidence_link");
      location.href = `/report/${result.publicId}?delivery=${result.emailSent ? "email" : "link"}`;
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "We couldn’t create the analysis.");
    }
  }

  return <main className="intake-page">
    <nav className="tool-nav shell"><Link className="brand" href="/"><span className="logo">↻</span><span>replay<span>method</span></span></Link><div><Link href="/reports">My reports</Link><Link href="/">Exit</Link></div></nav>
    <section className="intake-shell shell">
      <header className="intake-header"><div><span>FREE FOUNDING BETA</span><h1>Let’s find the decision<br /><em>costing you games.</em></h1><p>Submit one real match. We’ll return one evidence-backed diagnosis and a focused plan—not another wall of generic advice.</p></div><aside><b>$0</b><span>FIRST ANALYSIS</span><small>No card · Private report</small></aside></header>
      <div className="intake-progress" aria-label={`Step ${step + 1} of 4`}><i style={{ width: `${((step + 1) / 4) * 100}%` }} /><span>0{step + 1} / 04</span></div>

      <form className="intake-card" onSubmit={submit}>
        {step === 0 && <section><span className="intake-kicker">CHOOSE THE EVIDENCE SYSTEM</span><h2>What are we reviewing?</h2><div className="intake-games">{games.map(item => <button type="button" key={item.key} onClick={() => chooseGame(item.key)}><i>{item.mark}</i><div><b>{item.name}</b><small>{item.proof}</small></div><span>→</span></button>)}</div></section>}

        {step === 1 && game && <section><button className="intake-back" type="button" onClick={() => setStep(0)}>← CHANGE GAME</button><span className="intake-kicker">PLAYER CONTEXT · {selected?.name.toUpperCase()}</span><h2>Where are you now?</h2><div className="field-grid"><label><span>Current rank *</span><input value={currentRank} onChange={e => setCurrentRank(e.target.value)} placeholder="e.g. Gold 2" maxLength={80} /></label><label><span>Target rank</span><input value={targetRank} onChange={e => setTargetRank(e.target.value)} placeholder="e.g. Diamond" maxLength={80} /></label><label className="wide"><span>{contextLabels[game].label} *</span><input value={playerContext} onChange={e => setPlayerContext(e.target.value)} placeholder={contextLabels[game].placeholder} maxLength={160} /></label><label className="wide"><span>What do you want to stop repeating? *</span><textarea value={goal} onChange={e => setGoal(e.target.value)} placeholder="Example: I keep winning early and throwing the lead in mid game." maxLength={500} /></label></div></section>}

        {step === 2 && game && <section><button className="intake-back" type="button" onClick={() => setStep(1)}>← PLAYER CONTEXT</button><span className="intake-kicker">REAL MATCH EVIDENCE</span><h2>Give us something we can prove.</h2><p className="intake-explain">{selected?.input}. Pick the match that best represents the problem—not your best game.</p>{game !== "rocket-league" && <div className="integration-notice"><b>RIOT ACCESS STATUS</b><p>Official opt-in ingestion is awaiting Riot production approval. You may preserve a beta request now, but no automated coaching will be invented from an unverified public profile.</p></div>}<div className="evidence-grid">{game !== "rocket-league" && <label><span>Representative match or profile link</span><input type="url" inputMode="url" value={evidenceUrl} onChange={e => setEvidenceUrl(e.target.value)} placeholder="https://tracker.gg/... or official match page" maxLength={1000} /></label>}{game === "rocket-league" && <label className="file-drop"><input type="file" accept=".replay,application/octet-stream" onChange={e => setReplay(e.target.files?.[0] || null)} /><i>↥</i><b>{replay ? replay.name : "Upload the original .replay file"}</b><small>{replay ? `${(replay.size / 1024).toFixed(0)} KB selected` : "Maximum 16 MB · Private · Parsed automatically"}</small></label>}<label><span>Anything we should watch for?</span><textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional context: controller settings, role, recent change, timestamps or what felt wrong." maxLength={1600} /></label></div></section>}

        {step === 3 && game && <section><button className="intake-back" type="button" onClick={() => setStep(2)}>← MATCH EVIDENCE</button><span className="intake-kicker">PRIVATE DELIVERY</span><h2>Where should the report go?</h2><div className="delivery-summary"><div><span>GAME</span><b>{selected?.name}</b></div><div><span>RANK</span><b>{currentRank}{targetRank ? ` → ${targetRank}` : ""}</b></div><div><span>EVIDENCE</span><b>{replay ? replay.name : "Private link added"}</b></div></div><div className="field-grid delivery-fields"><label className="wide"><span>Email for report updates *</span><input type="email" autoComplete="email" inputMode="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" /></label><label className="check wide"><input type="checkbox" required checked={dataConsent} onChange={e => setDataConsent(e.target.checked)} /><span>I agree that Replay Method may process this match, replay/VOD and my email to deliver the private beta analysis. <a href="/privacy" target="_blank">Privacy</a></span></label><label className="check wide"><input type="checkbox" checked={updatesConsent} onChange={e => setUpdatesConsent(e.target.checked)} /><span>Also send me product updates and founding access. Optional.</span></label></div><div className="honesty-box"><i>{game === "rocket-league" ? "AUTOMATION QUALITY BETA" : "RIOT ACCESS PREVIEW"}</i><p>{game === "rocket-league" ? "The pipeline parses structured match data, preserves versioned evidence and stops instead of guessing when confidence is insufficient. Beta findings may be reviewed to calibrate detector quality." : "Your request and match reference will be preserved, but automated coaching cannot start until the official opt-in Riot integration is approved. No unsupported report will be generated."}</p></div><button className="submit-analysis" disabled={status === "loading"}>{status === "loading" ? "SECURING YOUR MATCH…" : game === "rocket-league" ? "START AUTOMATED ANALYSIS — FREE →" : "SAVE MY RIOT BETA REQUEST →"}</button><small className="submission-note">Your private status link appears immediately. No card or payment details.</small></section>}

        {step > 0 && step < 3 && <div className="intake-actions"><button type="button" onClick={next}>CONTINUE <span>→</span></button></div>}
        {message && <p className="intake-message" role="alert">{message}</p>}
      </form>
      <footer className="intake-footer"><span>One match. One pattern. One plan.</span><div><Link href="/privacy">Privacy</Link><Link href="/beta-terms">Beta terms</Link><a href="mailto:contact@replaymethod.xyz">Contact</a></div></footer>
    </section>
  </main>;
}
