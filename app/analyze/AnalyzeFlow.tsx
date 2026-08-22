"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { AnalysisGame } from "../../lib/analysis";
import { trackProductEvent, type ProductEvent } from "../../lib/client-analytics";

const games: { key: AnalysisGame; mark: string; name: string; proof: string; input: string }[] = [
  { key: "league", mark: "L", name: "League of Legends", proof: "Official Riot connection in approval", input: "Riot ID and a representative match link" },
  { key: "valorant", mark: "V", name: "VALORANT", proof: "Official Riot connection in approval", input: "Riot ID and a representative match link" },
  { key: "rocket-league", mark: "RL", name: "Rocket League", proof: "PC parser validating · console waitlist", input: "Original PC .replay file when the public quality gate opens" }
];

const MAX_REPLAY_BYTES = 16 * 1024 * 1024;
const MAX_VIDEO_BYTES = 95 * 1024 * 1024;
type RocketLeaguePlatform = "pc" | "ps5" | "xbox" | "switch";
const platforms: { key: RocketLeaguePlatform; name: string; evidence: string }[] = [
  { key: "pc", name: "PC", evidence: "Original .replay file" },
  { key: "ps5", name: "PS5", evidence: "Video analysis waitlist" },
  { key: "xbox", name: "Xbox", evidence: "Video analysis waitlist" },
  { key: "switch", name: "Switch", evidence: "Video analysis waitlist" },
];

function replayProblem(file: File) {
  if (!file.name.toLowerCase().endsWith(".replay")) return "Choose the original Rocket League .replay file.";
  if (file.size === 0) return "That replay is empty. Choose a completed match replay.";
  if (file.size > MAX_REPLAY_BYTES) return "That replay is larger than 16 MB. Choose the original replay file from a completed match.";
  return "";
}

function fileSizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function videoProblem(file: File) {
  const validExtension = /\.(mp4|mov|webm|mpeg|mpg|m4v)$/i.test(file.name);
  if (!validExtension) return "Choose an MP4, MOV, WebM or MPEG gameplay video.";
  if (file.size === 0) return "That video is empty. Choose a completed gameplay clip.";
  if (file.size > MAX_VIDEO_BYTES) return "That video is larger than 95 MB. Paste a VOD link instead.";
  return "";
}

const contextLabels: Record<AnalysisGame, { label: string; placeholder: string }> = {
  league: { label: "Riot ID + role/champion", placeholder: "Player#EUW · Jungle · Lee Sin" },
  valorant: { label: "Riot ID + role/agent", placeholder: "Player#EU · Controller · Omen" },
  "rocket-league": { label: "Exact in-game player name", placeholder: "PlayerName — exactly as shown in the replay" }
};

function attribution() {
  const params = new URLSearchParams(location.search);
  return { source: (params.get("utm_source") || "direct").slice(0, 80), campaign: (params.get("utm_campaign") || "").slice(0, 120) };
}

function track(event: ProductEvent, game: AnalysisGame | null, placement: string) {
  trackProductEvent(event, game || "general", placement);
}

function replayProblemCode(file: File) {
  if (!file.name.toLowerCase().endsWith(".replay")) return "invalid_type";
  if (file.size === 0) return "empty_file";
  if (file.size > MAX_REPLAY_BYTES) return "file_too_large";
  return "unknown";
}

export default function AnalyzeFlow({ initialGame, initialHypothesis, initialPlatform, engineOpen, videoOpen }: { initialGame: AnalysisGame | null; initialHypothesis: string; initialPlatform: RocketLeaguePlatform | null; engineOpen: boolean; videoOpen: boolean }) {
  const replayInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(initialGame ? 1 : 0);
  const [game, setGame] = useState<AnalysisGame | null>(initialGame);
  const [platform, setPlatform] = useState<RocketLeaguePlatform>(initialPlatform || "pc");
  const [currentRank, setCurrentRank] = useState("");
  const [targetRank, setTargetRank] = useState("");
  const [playerContext, setPlayerContext] = useState("");
  const [goal, setGoal] = useState(initialHypothesis);
  const [notes, setNotes] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [replay, setReplay] = useState<File | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [email, setEmail] = useState("");
  const [dataConsent, setDataConsent] = useState(false);
  const [updatesConsent, setUpdatesConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");
  const replayFirst = game === "rocket-league" && platform === "pc";
  const visibleStep = replayFirst ? (step === 3 ? 2 : 1) : step + 1;
  const visibleStepTotal = replayFirst ? 2 : 4;

  useEffect(() => { track("analysis_start", initialGame, "analysis_page"); }, [initialGame]);
  const selected = useMemo(() => games.find(item => item.key === game), [game]);

  const chooseGame = (value: AnalysisGame) => {
    setGame(value);
    setReplay(null);
    setVideo(null);
    setEvidenceUrl("");
    track("game_select", value, "analysis_intake");
    setStep(1);
  };

  const selectReplay = (file: File | null) => {
    if (!file) return;
    const problem = replayProblem(file);
    setMessage(problem);
    if (problem) {
      track("validation_failed", "rocket-league", replayProblemCode(file));
      setStatus("error");
      setReplay(null);
      if (replayInputRef.current) replayInputRef.current.value = "";
      return;
    }
    setReplay(file);
    setStatus("idle");
    track("replay_selected", "rocket-league", "analysis_intake");
  };

  const selectVideo = (file: File | null) => {
    if (!file) return;
    const problem = videoProblem(file);
    setMessage(problem);
    if (problem) {
      track("validation_failed", "rocket-league", "video_invalid");
      setStatus("error");
      setVideo(null);
      if (videoInputRef.current) videoInputRef.current.value = "";
      return;
    }
    setVideo(file);
    setStatus("idle");
    track("replay_selected", "rocket-league", "console_video_intake");
  };

  const next = () => {
    setMessage("");
    if (step === 1 && game === "rocket-league" && platform === "pc" && !engineOpen) return setMessage("PC replay analysis is still in final quality validation. Join the waitlist for first access.");
    if (step === 1 && game === "rocket-league" && platform === "pc" && !replay) return setMessage("Upload the original Rocket League .replay file so the match can be parsed safely.");
    if (step === 1 && game === "rocket-league" && platform !== "pc" && !videoOpen) return setMessage("Console video analysis is not live yet. Join the console waitlist for first access.");
    if (step === 1 && game === "rocket-league" && platform !== "pc" && !video && !evidenceUrl.trim()) return setMessage("Upload gameplay video or paste a VOD link for the console video beta.");
    if (step === 1 && game !== "rocket-league" && !evidenceUrl.trim()) return setMessage("Add one representative match link for the Riot access beta.");
    if (step === 1 && replay) {
      const problem = replayProblem(replay);
      if (problem) return setMessage(problem);
    }
    if (step === 1 && replayFirst) {
      setStep(3);
      return;
    }
    if (step === 2 && (!currentRank.trim() || !playerContext.trim() || goal.trim().length < 8)) return setMessage("Add your rank, player identity and what you want to improve.");
    setStep(value => Math.min(3, value + 1));
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!game) return;
    setStatus("loading");
    setMessage("");
    const data = new FormData();
    data.set("game", game);
    data.set("platform", game === "rocket-league" ? platform : "pc");
    data.set("currentRank", replayFirst ? "" : currentRank);
    data.set("targetRank", targetRank);
    data.set("playerContext", replayFirst ? "" : playerContext);
    data.set("goal", replayFirst ? "Find the most useful evidence-backed focus in this replay." : goal);
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
    if (video) data.set("video", video);

    try {
      if (replay || video) track("upload_started", game, video ? "console_video_intake" : "analysis_intake");
      const response = await fetch("/api/analyses", { method: "POST", body: data });
      const result = await response.json() as { publicId?: string; emailSent?: boolean; error?: string };
      if (!response.ok || !result.publicId) throw new Error(result.error || "Try again.");
      const stored = JSON.parse(localStorage.getItem("replaymethod-report-ids") || "[]") as string[];
      localStorage.setItem("replaymethod-report-ids", JSON.stringify([result.publicId, ...stored.filter(id => id !== result.publicId)].slice(0, 20)));
      track("analysis_submit", game, replay ? "replay_upload" : video ? "video_upload" : "evidence_link");
      if (stored.length) track("second_match_submitted", game, "returning_player");
      location.href = `/report/${result.publicId}?delivery=${result.emailSent ? "email" : "link"}`;
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "We couldn’t create the analysis.");
      track("analysis_failed", game, replay ? "replay_upload" : video ? "video_upload" : "evidence_link");
    }
  }

  return <main className="intake-page">
    <nav className="tool-nav shell"><Link className="brand" href="/"><span className="logo" aria-hidden="true" /><span>replay<span>method</span></span></Link><div><Link href="/reports">My reports</Link><Link href="/">Exit</Link></div></nav>
    <section className="intake-shell shell">
      <header className="intake-header"><div><span>FREE PRODUCT BETA</span><h1>Know what is ready.<br /><em>Never submit into a dead end.</em></h1><p>{game === "league" || game === "valorant" ? "Join the official-access waitlist. Automated Riot match analysis is not live yet." : platform === "pc" ? engineOpen ? "Upload one original replay for an evidence check." : "The PC parser is online, but public coaching is still in quality validation." : videoOpen ? "Upload a gameplay video for the console beta." : "Console video analysis is not live yet. Join the waitlist for first access."}</p></div><aside><b>$0</b><span>{game === "league" || game === "valorant" || (game === "rocket-league" && (platform === "pc" ? !engineOpen : !videoOpen)) ? "WAITLIST" : "EVIDENCE CHECK"}</span><small>No card · Clear status</small></aside></header>
      <div className="intake-progress" aria-label={`Step ${visibleStep} of ${visibleStepTotal}`}><i style={{ width: `${(visibleStep / visibleStepTotal) * 100}%` }} /><span>0{visibleStep} / 0{visibleStepTotal}</span></div>

      <form className="intake-card" aria-busy={status === "loading"} onSubmit={submit}>
        {step === 0 && <section><span className="intake-kicker">CHOOSE THE EVIDENCE SYSTEM</span><h2>What are we reviewing?</h2><div className="intake-games">{games.map(item => <button type="button" key={item.key} onClick={() => chooseGame(item.key)}><i>{item.mark}</i><div><b>{item.name}</b><small>{item.proof}</small></div><span>→</span></button>)}</div></section>}

        {step === 2 && game && <section><button className="intake-back" type="button" onClick={() => setStep(1)}>← MATCH EVIDENCE</button><span className="intake-kicker">PLAYER CONTEXT · {selected?.name.toUpperCase()}</span><h2>Now add only the context that changes the review.</h2>{initialHypothesis && <div className="intake-hypothesis"><span>CLIMB CHECK HYPOTHESIS CARRIED FORWARD</span><b>{initialHypothesis}</b><small>You selected this as a hypothesis. The match still decides whether it is supported.</small></div>}<div className="field-grid"><label><span>Current rank *</span><input value={currentRank} onChange={e => setCurrentRank(e.target.value)} placeholder="e.g. Gold 2" maxLength={80} /></label><label><span>Target rank</span><input value={targetRank} onChange={e => setTargetRank(e.target.value)} placeholder="e.g. Diamond" maxLength={80} /></label><label className="wide"><span>{contextLabels[game].label} *</span><input value={playerContext} onChange={e => setPlayerContext(e.target.value)} placeholder={contextLabels[game].placeholder} maxLength={160} /></label><label className="wide"><span>What do you want to stop repeating? *</span><textarea value={goal} onChange={e => setGoal(e.target.value)} placeholder="Example: I keep winning early and throwing the lead in mid game." maxLength={500} /></label></div><p className="intake-explain">This context helps prioritize supported evidence. It cannot override what the match shows.</p></section>}

        {step === 1 && game && <section><button className="intake-back" type="button" onClick={() => setStep(0)}>← CHANGE GAME</button><span className="intake-kicker">MATCH EVIDENCE · {selected?.name.toUpperCase()}</span><h2>{game === "rocket-league" && (platform === "pc" ? !engineOpen : !videoOpen) ? "This evidence lane is not open yet." : "Start with something we can prove."}</h2>{game === "rocket-league" && <div className="intake-platforms" role="group" aria-label="Rocket League platform">{platforms.map(item => <button type="button" key={item.key} className={platform === item.key ? "active" : ""} aria-pressed={platform === item.key} onClick={() => { setPlatform(item.key); setReplay(null); setVideo(null); setEvidenceUrl(""); setMessage(""); }}><i>{item.key === "pc" ? "PC" : item.key === "ps5" ? "△" : item.key === "xbox" ? "X" : "◫"}</i><span><b>{item.name}</b><small>{item.evidence}{item.key === "pc" && !engineOpen ? " · quality gate closed" : ""}</small></span></button>)}</div>}<p className="intake-explain">{game === "rocket-league" && platform !== "pc" ? videoOpen ? `${platforms.find(item => item.key === platform)?.name} uses visible video evidence.` : "We are not collecting console footage until the video analysis can return a useful result." : `${selected?.input}. Pick the match that best represents the problem—not your best game.`}</p>{game !== "rocket-league" && <div className="integration-notice"><b>RIOT ACCESS STATUS</b><p>Automated League and VALORANT analysis is not live. This form only preserves an opt-in beta request while official access is pending.</p></div>}{game === "rocket-league" && platform === "pc" && !engineOpen && <div className="integration-notice"><b>PC QUALITY VALIDATION</b><p>The replay parser is online. Public findings stay closed until the coaching detectors pass their quality gate.</p><Link href="/#join-beta">Join PC first access →</Link></div>}{game === "rocket-league" && platform !== "pc" && !videoOpen && <div className="integration-notice"><b>CONSOLE VIDEO WAITLIST</b><p>PS5, Xbox and Switch clips cannot be analyzed yet. We will not collect footage that only ends in a queue.</p><Link href="/#join-beta">Join console first access →</Link></div>}<div className="evidence-grid">{game !== "rocket-league" && <label><span>Representative match or profile link</span><input type="url" inputMode="url" value={evidenceUrl} onChange={e => setEvidenceUrl(e.target.value)} placeholder="https://tracker.gg/... or official match page" maxLength={1000} /></label>}{game === "rocket-league" && platform === "pc" && engineOpen && <><label className={`file-drop ${replay ? "has-file" : ""}`}><input ref={replayInputRef} type="file" accept=".replay,application/octet-stream" onChange={e => selectReplay(e.target.files?.[0] || null)} /><i>{replay ? "✓" : "↥"}</i><b>{replay ? replay.name : "Upload the original .replay file"}</b><small>{replay ? `${fileSizeLabel(replay.size)} · validated` : "Maximum 16 MB · Private · Frame-exact evidence"}</small></label>{!replay && <Link className="replay-file-help" href="/replay-upload" target="_blank" rel="noreferrer">Can’t find the file? <span>Open guide · keep this form →</span></Link>}</>}{game === "rocket-league" && platform !== "pc" && videoOpen && <><label className={`file-drop video-drop ${video ? "has-file" : ""}`}><input ref={videoInputRef} type="file" accept="video/mp4,video/quicktime,video/webm,video/mpeg,.m4v" onChange={e => selectVideo(e.target.files?.[0] || null)} /><i>{video ? "✓" : "▶"}</i><b>{video ? video.name : "Upload gameplay video"}</b><small>{video ? `${fileSizeLabel(video.size)} · video ready` : "MP4, MOV, WebM or MPEG · max 95 MB"}</small></label><div className="evidence-divider"><span>OR</span></div><label><span>Full-match or gameplay VOD link</span><input type="url" inputMode="url" value={evidenceUrl} onChange={e => setEvidenceUrl(e.target.value)} placeholder="https://youtube.com/..." maxLength={1000} /></label></>}<label><span>Anything we should watch for?</span><textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional context" maxLength={1600} /></label></div></section>}

        {step === 3 && game && <section><button className="intake-back" type="button" onClick={() => setStep(replayFirst ? 1 : 2)}>← {replayFirst ? "REPLAY" : "PLAYER CONTEXT"}</button><span className="intake-kicker">PRIVATE DELIVERY</span><h2>Where should we send your {game === "rocket-league" ? "result" : "request"}?</h2><div className="delivery-summary"><div><span>GAME</span><b>{selected?.name}{game === "rocket-league" ? ` · ${platforms.find(item => item.key === platform)?.name}` : ""}</b></div><div><span>{replayFirst ? "CONTEXT" : "RANK"}</span><b>{replayFirst ? "Read from replay · confirm after parse" : `${currentRank}${targetRank ? ` → ${targetRank}` : ""}`}</b></div><div><span>EVIDENCE</span><b>{replay ? replay.name : video ? video.name : "Private link added"}</b></div></div><div className="field-grid delivery-fields"><label className="wide"><span>Email for private delivery *</span><input type="email" autoComplete="email" inputMode="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" /></label><label className="check wide"><input type="checkbox" required checked={dataConsent} onChange={e => setDataConsent(e.target.checked)} /><span>I agree that Replay Method may process this match, replay/VOD and my email to deliver the private beta status. <a href="/privacy" target="_blank">Privacy</a></span></label><label className="check wide"><input type="checkbox" checked={updatesConsent} onChange={e => setUpdatesConsent(e.target.checked)} /><span>Also send me product updates and beta-access news. Optional.</span></label></div><div className="honesty-box"><i>{game === "rocket-league" ? platform === "pc" ? "FRAME-EXACT QUALITY BETA" : "CONSOLE VIDEO BETA" : "RIOT ACCESS PREVIEW"}</i><p>{game === "rocket-league" ? platform === "pc" ? "The deterministic parser reads the playlist and players first. After one-tap identity and rank context, it returns coaching only where the exact evidence gate has passed." : "The video lane reviews only visible gameplay evidence and timestamps. It never presents video inference as hidden telemetry, and unsupported moments remain unscored." : "Your request and match reference will be preserved, but automated coaching cannot start until the official opt-in Riot integration is approved. No unsupported report will be generated."}</p></div><button className="submit-analysis" disabled={status === "loading"}><span aria-live="polite">{status === "loading" ? "SECURING YOUR MATCH…" : game === "rocket-league" ? platform === "pc" ? "ANALYZE THIS REPLAY — FREE →" : "SUBMIT CONSOLE VIDEO EVIDENCE — FREE →" : "SAVE MY RIOT BETA REQUEST →"}</span></button><small className="submission-note">Your private status link appears immediately. No card or payment details.</small></section>}

        {step > 0 && step < 3 && !(step === 1 && game === "rocket-league" && (platform === "pc" ? !engineOpen : !videoOpen)) && <div className="intake-actions"><button type="button" onClick={next}>CONTINUE <span>→</span></button></div>}
        {message && <p className="intake-message" role="alert">{message}</p>}
      </form>
      <footer className="intake-footer"><span>One match. One pattern. One plan.</span><div><Link href="/privacy">Privacy</Link><Link href="/beta-terms">Beta terms</Link><a href="mailto:contact@replaymethod.xyz">Contact</a></div></footer>
    </section>
  </main>;
}
