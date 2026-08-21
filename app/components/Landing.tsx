"use client";
/* eslint-disable @next/next/no-html-link-for-pages */

import { FormEvent, useEffect, useState } from "react";
import { trackProductEvent, type ProductEvent } from "../../lib/client-analytics";
import PricingLadder from "./PricingLadder";
import QuickReplayStart from "./QuickReplayStart";
import ReplayContribution from "../rocket-league-beta/ReplayContribution";

export type GameKey = "general" | "league" | "valorant" | "rocket-league";

type Config = {
  label: string;
  eyebrow: string;
  title: string;
  accent: string;
  lead: string;
  cta: string;
  sampleContext: string;
  sampleFinding: string;
  sampleEvidence: string;
  sampleRule: string;
  sampleVerification: string;
};

const configs: Record<GameKey, Config> = {
  general: {
    label: "Competitive gaming",
    eyebrow: "EVIDENCE BEFORE ADVICE",
    title: "Stop guessing why you’re stuck.",
    accent: "Fix the decision that keeps repeating.",
    lead: "Replay Method turns match evidence into one clear focus, one cue for your next match and a way to check whether the behavior changed.",
    cta: "Join beta updates",
    sampleContext: "Illustrative Rocket League 2v2 scenario",
    sampleFinding: "Your spacing removes the safe option after a teammate commits.",
    sampleEvidence: "The second player follows the same channel while the goal is uncovered. The important decision happens before the shot.",
    sampleRule: "When your teammate crosses the ball line, protect the next safe layer until possession is clear.",
    sampleVerification: "Recheck the same spacing decision across later comparable matches."
  },
  league: {
    label: "League of Legends",
    eyebrow: "STOP GUESSING WHY THE LEAD DISAPPEARS",
    title: "Find the decision costing your LP.",
    accent: "Carry one correction into the next game.",
    lead: "Replay Method is designed to connect match evidence, one recurring decision and one playable rule. Official Riot ingestion is still awaiting production approval.",
    cta: "Join the League beta",
    sampleContext: "Illustrative objective-setup scenario",
    sampleFinding: "Your objective plan begins after the map has already closed.",
    sampleEvidence: "The example shows an unprepared wave and late vision before the contest—not a claim about a real player.",
    sampleRule: "One minute before the objective: wave, recall, route, vision, then position.",
    sampleVerification: "Compare later objective setups only after official, authorized match evidence is available."
  },
  valorant: {
    label: "VALORANT",
    eyebrow: "AIM IS NOT THE WHOLE ROUND",
    title: "Find the decision costing your RR.",
    accent: "Take one better rule into the next round.",
    lead: "Replay Method is designed to connect round evidence, one recurring decision and one playable cue. Official Riot ingestion is still awaiting production approval.",
    cta: "Join the VALORANT beta",
    sampleContext: "Illustrative opening-duel scenario",
    sampleFinding: "Your first contact begins before a trade is available.",
    sampleEvidence: "The example shows the entry moving beyond teammate support. It is a product-format demonstration, not a player diagnosis.",
    sampleRule: "Start contact only when the second player can trade or your utility creates a safe exit.",
    sampleVerification: "Compare first-contact quality across later authorized match evidence."
  },
  "rocket-league": {
    label: "Rocket League",
    eyebrow: "ONE REPLAY · ONE FOCUS · ONE NEXT-MATCH RULE",
    title: "Stop grinding blind.",
    accent: "See the decision before the goal.",
    lead: "Replay Method reads the match before it explains the loss. PC replay analysis is in final evidence validation; console video analysis remains a waitlist.",
    cta: "Join the replay beta",
    sampleContext: "Illustrative Rocket League 2v2 scenario",
    sampleFinding: "Your spacing removes the safe option after a teammate commits.",
    sampleEvidence: "The second player follows the same channel while the goal is uncovered. The important decision happens before the shot.",
    sampleRule: "When your teammate crosses the ball line, protect the next safe layer until possession is clear.",
    sampleVerification: "Recheck the same spacing decision across later comparable replays."
  }
};

const sentViews = new Set<string>();

function getAttribution() {
  const params = new URLSearchParams(window.location.search);
  let source = params.get("utm_source") || "direct";
  if (source === "direct" && document.referrer) {
    try { source = new URL(document.referrer).hostname.replace(/^www\./, ""); } catch { /* keep direct */ }
  }
  return { source: source.slice(0, 80), campaign: (params.get("utm_campaign") || "").slice(0, 120) };
}

function trackEvent(game: GameKey, event: ProductEvent, placement: string) {
  trackProductEvent(event, game, placement);
}

function WaitlistForm({ game, config, placement, id }: { game: GameKey; config: Config; placement: string; id?: string }) {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const website = String(new FormData(event.currentTarget).get("company") || "");
    setStatus("loading");
    setMessage("");
    trackEvent(game, "cta_click", placement);
    try {
      const attribution = getAttribution();
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, game, website, consent, ...attribution })
      });
      const result = await response.json() as { created?: boolean; message?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "Try again");
      setStatus("success");
      setMessage(result.message || "Your beta signup is confirmed.");
      if (result.created) trackEvent(game, "signup", placement);
      setEmail("");
      setConsent(false);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Try again");
    }
  }

  if (status === "success") {
    return <div className="signup-success" id={id} role="status"><span>✓</span><div><b>You’re on the beta list.</b><p>{message} We’ll email you when a suitable private beta spot opens. No charge today.</p></div></div>;
  }

  return <div className="form-wrap" id={id}>
    <form className="waitlist-form" onSubmit={submit}>
      <div className="waitlist">
        <label className="sr-only" htmlFor={"email-" + placement + "-" + game}>Email address</label>
        <input id={"email-" + placement + "-" + game} name="email" type="email" required autoComplete="email" inputMode="email" placeholder="you@email.com" value={email} onChange={event => setEmail(event.target.value)} />
        <input className="hp-field" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        <button disabled={status === "loading"}>{status === "loading" ? "Joining…" : config.cta}<b>→</b></button>
      </div>
      <label className="consent"><input type="checkbox" required checked={consent} onChange={event => setConsent(event.target.checked)} /><span>Email me private beta access and launch updates. I can unsubscribe anytime. <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></span></label>
    </form>
    <p className={"note " + status} aria-live="polite">{message || "One email · No card · No charge today"}</p>
  </div>;
}

function ProductPreview({ config }: { config: Config }) {
  return <article className="commercial-report-preview" aria-label="Illustrative Replay Method report format">
    <header><div><span>ILLUSTRATIVE REPORT FORMAT</span><b>Not a player result</b></div><i>EXAMPLE</i></header>
    <div className="commercial-preview-context"><span>SCENARIO</span><b>{config.sampleContext}</b></div>
    <section><span>01 · ONE FOCUS</span><h2>{config.sampleFinding}</h2></section>
    <section><span>02 · EVIDENCE LOGIC</span><p>{config.sampleEvidence}</p></section>
    <section className="commercial-preview-rule"><span>03 · NEXT-MATCH RULE</span><b>{config.sampleRule}</b></section>
    <footer><span>04 · PROOF</span><p>{config.sampleVerification}</p></footer>
  </article>;
}

function GameLinks({ current }: { current: GameKey }) {
  const games: Array<{ key: Exclude<GameKey, "general">; label: string; path: string }> = [
    { key: "rocket-league", label: "Rocket League", path: "/rocket-league" },
    { key: "league", label: "League of Legends", path: "/league" },
    { key: "valorant", label: "VALORANT", path: "/valorant" }
  ];
  return <div className="commercial-game-links" aria-label="Game-specific paths">{games.map(item => <a className={current === item.key ? "active" : ""} href={item.path} key={item.key}><span>{item.key === "rocket-league" ? "RL" : item.key === "league" ? "L" : "V"}</span><b>{item.label}</b><i>→</i></a>)}</div>;
}

function MethodSection() {
  const steps = [
    ["01", "Replay", "Start with one real match, not a questionnaire."],
    ["02", "Focus", "See the evidence behind one recurring decision."],
    ["03", "Improve", "Take one rule into the next match, then check it again."]
  ];
  return <section className="commercial-method shell" id="method"><div className="commercial-section-copy"><span className="kicker">THREE STEPS · ONE RED THREAD</span><h2>From replay to the next better decision.</h2><p>Everything that does not help the player understand or act is secondary.</p></div><div className="commercial-method-grid">{steps.map(step => <article key={step[0]}><i>{step[0]}</i><b>{step[1]}</b><p>{step[2]}</p></article>)}</div></section>;
}

function Faq({ engineOpen }: { engineOpen: boolean }) {
  return <section className="commercial-faq shell" id="faq"><div className="commercial-section-copy"><span className="kicker">STRAIGHT ANSWERS</span><h2>Trust starts with knowing the limits.</h2></div><div className="faq-list"><details><summary>What can I use today?<b>+</b></summary><p>The free Climb Check and guides work now. {engineOpen ? "Rocket League PC replay intake is open for evidence-gated analysis." : "Rocket League PC replay coaching remains closed while detector quality is validated."} Console video and Riot match analysis are not live.</p></details><details><summary>Is the sample report a real player result?<b>+</b></summary><p>No. It is clearly labeled as an illustrative report format. Replay Method will not manufacture testimonials, performance results or detector evidence.</p></details><details><summary>Does Replay Method guarantee rank improvement?<b>+</b></summary><p>No. It identifies supported behaviors, focuses practice and checks later evidence. Competitive outcomes still depend on the player, teammates, opponents and the game.</p></details><details><summary>Why not just use a stat tracker or AI chat?<b>+</b></summary><p>Stats describe outcomes and chat can explain ideas. Replay Method is being built to connect verified match evidence to one prioritized behavior, one action and later verification.</p></details><details><summary>What happens to my replay?<b>+</b></summary><p>Supported uploads are private, stored separately from public report identifiers and used to produce or reprocess the requested analysis. You can export or delete verified account data from report history.</p></details></div></section>;
}

export default function Landing({ game = "general", checkoutOpen = false, engineOpen = false, calibrationOpen = false }: { game?: GameKey; checkoutOpen?: boolean; engineOpen?: boolean; calibrationOpen?: boolean }) {
  const config = configs[game];
  const riotRequest = game === "league" || game === "valorant";
  const replayReady = engineOpen && (game === "general" || game === "rocket-league");
  const calibrationReady = calibrationOpen && game === "rocket-league";
  const analysisHref = riotRequest ? "/analyze?game=" + game : replayReady ? "/analyze?game=rocket-league&platform=pc" : "#join-beta";
  const primaryHref = replayReady ? "#replay-upload" : calibrationReady ? "#beta-intake" : game === "general" ? "#choose-game" : "/climb-check";
  const primaryLabel = replayReady ? "Upload my replay" : calibrationReady ? "Contribute one replay" : game === "general" ? "Choose my game" : "Try the free Climb Check";

  useEffect(() => {
    const key = "replaymethod-view-" + location.pathname;
    if (!sentViews.has(key)) {
      sentViews.add(key);
      trackEvent(game, "page_view", "landing");
    }
  }, [game]);

  return <main className="commercial-home">
    <nav className="nav shell"><a className="brand" href="/" aria-label="Replay Method home"><span className="logo">↻</span><span>replay<span>method</span></span></a><div className="nav-links"><a href="#method">How it works</a><a href="#proof">Example</a><a href="/reports">My reports</a></div><a className="nav-cta" href={primaryHref} onClick={() => trackEvent(game, calibrationReady ? "calibration_start" : replayReady ? "analysis_start" : "tool_start", "nav_primary")}>{calibrationReady ? "Send replay" : replayReady ? "Analyze" : "Start"}</a></nav>

    <section className="commercial-hero shell">
      <div className="commercial-hero-copy">
        <div className="commercial-live-state"><i /> {replayReady ? "ROCKET LEAGUE PC BETA OPEN" : calibrationReady ? "PRIVATE REPLAY COLLECTION OPEN" : game === "general" ? "START HERE" : "FREE CLIMB CHECK LIVE · ANALYSIS VALIDATING"}</div>
        <div className="eyebrow">{config.eyebrow}</div>
        <h1>{config.title}<br /><em>{config.accent}</em></h1>
        <p className="lead">{config.lead}</p>
        <div className="commercial-hero-actions"><a className="commercial-primary" href={primaryHref} onClick={() => trackEvent(game, calibrationReady ? "calibration_start" : replayReady ? "analysis_start" : "tool_start", "hero_primary")}>{primaryLabel} <b>→</b></a></div>
        <div className="commercial-trust-row"><span>Start free</span><span>Private by default</span><span>No result without evidence</span></div>
      </div>
      <div className="commercial-hero-product" id={game === "general" ? "choose-game" : undefined}>{replayReady ? <QuickReplayStart placement="commercial_hero" /> : calibrationReady ? <ReplayContribution intakeOpen compact /> : game === "general" ? <div className="commercial-game-start"><header><span>01 · CHOOSE YOUR GAME</span><b>Where are you stuck?</b><p>One choice. Then Replay Method shows the shortest honest path available for that game.</p></header><GameLinks current={game} /></div> : <ProductPreview config={config} />}</div>
    </section>

    <MethodSection />

    <section className="commercial-proof shell" id="proof"><div className="commercial-section-copy"><span className="kicker">PRODUCT PROOF, WITHOUT FAKE PROOF</span><h2>Evidence first. One focus next.</h2><p>This is the report structure Replay Method is built to earn from real match evidence. The example is illustrative; actual reports must include detector versions, confidence and limitations.</p></div><ProductPreview config={config} /><div className="commercial-proof-principles"><article><b>When evidence is strong</b><p>Show the moment, confidence, limitation and next action.</p></article><article><b>When evidence is weak</b><p>Stop, preserve the submission and explain what is missing.</p></article><article><b>When the player returns</b><p>Check the same behavior before claiming progress.</p></article></div></section>

    <PricingLadder analysisHref={analysisHref} game={game} requestOnly={riotRequest} checkoutOpen={checkoutOpen} replayReady={replayReady} />
    <Faq engineOpen={engineOpen} />

    <section className="commercial-final" id="join-beta"><div className="shell"><span className="kicker">REPLAY. FOCUS. IMPROVE.</span><h2>{replayReady ? "Start with one real match." : calibrationReady ? "One replay can help make the promise real." : "Get first access when the evidence gate passes."}</h2><p>{replayReady ? "A supported replay can become one clear focus. No card is required for the first evidence check." : calibrationReady ? "Contribute privately to calibration. This is research intake, not a promised player report." : "Join the private beta list. No file, payment details or unsupported coaching today."}</p>{(replayReady || calibrationReady) && <a className="commercial-primary" href={replayReady ? "/analyze?game=rocket-league&platform=pc" : "#beta-intake"} onClick={() => trackEvent(game, replayReady ? "analysis_start" : "calibration_start", "final_replay")}>{replayReady ? "Analyze my replay" : "Contribute one replay"} →</a>}{!calibrationReady && <WaitlistForm game={game} config={config} placement="commercial_final" />}</div></section>

    <footer className="shell"><div className="brand"><span className="logo">↻</span><span>replay<span>method</span></span></div><p>A trusted improvement system for competitive players.</p><div className="footer-links"><a href="/reports">My reports</a><a href="/guides">Guides</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="mailto:contact@replaymethod.xyz">Contact</a></div><small>Independent service. Not affiliated with or endorsed by Riot Games, Psyonix or Epic Games.</small></footer>
    <div className="commercial-mobile-cta"><div><span>{replayReady ? "REPLAY BETA OPEN" : calibrationReady ? "PRIVATE COLLECTION OPEN" : "START FREE"}</span><b>{replayReady ? "Analyze one replay" : calibrationReady ? "Contribute one replay" : game === "general" ? "Choose your game" : "Find a starting focus"}</b></div><a href={primaryHref}>{replayReady ? "Upload" : calibrationReady ? "Send" : "Start"} →</a></div>
  </main>;
}
