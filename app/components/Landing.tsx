"use client";
/* eslint-disable @next/next/no-html-link-for-pages */

import { FormEvent, useEffect, useState } from "react";
import QuickReplayStart from "./QuickReplayStart";
import HardstuckHook from "./HardstuckHook";
import PricingLadder from "./PricingLadder";
import InteractiveReportPreview from "./InteractiveReportPreview";
import GameHeroExperience from "./GameHeroExperience";
import { trackProductEvent, type ProductEvent } from "../../lib/client-analytics";

export type GameKey = "general" | "league" | "valorant" | "rocket-league";
type Config = {
  label: string;
  eyebrow: string;
  title: string;
  accent: string;
  lead: string;
  cta: string;
  diagnosis: string;
  plan: string;
  evidence: string;
  rule: string;
  verify: string;
};

const configs: Record<GameKey, Config> = {
  general: {
    label: "Competitive gaming",
    eyebrow: "EVIDENCE-FIRST REPLAY COACH · ROCKET LEAGUE QUALITY BETA",
    title: "Stop grinding blind.",
    accent: "Turn one replay into your next clear focus.",
    lead: "Upload a real Rocket League replay. The quality beta verifies the match, player and evidence timeline today; coaching appears only after a detector earns the right to make a public claim.",
    cta: "Join beta updates",
    diagnosis: "Your decision-making drops when the match gets close.",
    plan: "Slow the game down after a lost fight. Reset before forcing the next play.",
    evidence: "The same high-risk decision appears in 4 of your last 6 losses.",
    rule: "After a lost fight, reset before you force the next play.",
    verify: "Risky decisions are trending down across the next sessions."
  },
  league: {
    label: "League of Legends",
    eyebrow: "STOP DONATING LP",
    title: "Stop guessing why you lose.",
    accent: "Find the decision costing your LP.",
    lead: "Replay Method is preparing an opt-in League workflow that can turn official match and timeline evidence into one focused plan. Riot production access is still pending.",
    cta: "Join the League beta list",
    diagnosis: "You give away your lead during the 14–20 minute transition.",
    plan: "Convert priority into vision before the second objective. Stop taking isolated river fights.",
    evidence: "Five of your last seven deaths happened without an objective trade available.",
    rule: "When you have lane priority, spend it on vision before you contest river.",
    verify: "Untraded deaths fall while objective participation rises."
  },
  valorant: {
    label: "VALORANT",
    eyebrow: "STOP BLEEDING RR",
    title: "Your aim isn’t the whole problem.",
    accent: "Find the rounds costing your RR.",
    lead: "Replay Method is preparing an opt-in VALORANT workflow for supported fights, round patterns and utility evidence. Riot production access is still pending.",
    cta: "Join the VALORANT beta list",
    diagnosis: "Your first-death rate spikes after your team loses two rounds in a row.",
    plan: "Change your opening position after a loss streak. Preserve utility for the retake instead of forcing contact.",
    evidence: "You take first contact without trade support in 38% of lost defense rounds.",
    rule: "After two lost rounds, change your opener and keep one piece of retake utility.",
    verify: "First deaths fall and your tradeable fights increase."
  },
  "rocket-league": {
    label: "Rocket League",
    eyebrow: "BREAK THE HARDSTUCK LOOP",
    title: "Stop grinding blind.",
    accent: "Turn one replay into your next clear focus.",
    lead: "Choose your platform. PC gets deep .replay evidence; console players get a clear video-beta path—no dead-end Windows instructions.",
    cta: "Join the replay beta list",
    diagnosis: "You follow the play too closely after your teammate commits.",
    plan: "Hold one layer deeper and enter through back post. Stop turning a 1v1 into a double commit.",
    evidence: "You enter the same lane as your teammate in 6 of 9 conceded goals.",
    rule: "When your teammate crosses the ball line, hold back post until the play resets.",
    verify: "Double commits fall while controlled defensive touches rise."
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

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const website = String(new FormData(form).get("company") || "");
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
        <label className="sr-only" htmlFor={`email-${placement}-${game}`}>Email address</label>
        <input id={`email-${placement}-${game}`} name="email" type="email" required autoComplete="email" inputMode="email" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} />
        <input className="hp-field" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        <button disabled={status === "loading"}>{status === "loading" ? "Joining…" : config.cta}<b>→</b></button>
      </div>
      <label className="consent"><input type="checkbox" required checked={consent} onChange={event => setConsent(event.target.checked)} /><span>Email me private beta access and launch updates. I can unsubscribe anytime. <a href="/privacy">Privacy</a> · <a href="/terms">Waitlist terms</a></span></label>
    </form>
    <p className={`note ${status}`} aria-live="polite">{message || "One email · No card · No charge today"}</p>
  </div>;
}

function GameLinks({ current, placement }: { current: GameKey; placement: string }) {
  const games: { key: GameKey; label: string; path: string; mark: string }[] = [
    { key: "league", label: "League", path: "/league", mark: "L" },
    { key: "valorant", label: "VALORANT", path: "/valorant", mark: "V" },
    { key: "rocket-league", label: "Rocket League", path: "/rocket-league", mark: "RL" }
  ];
  return <div className="game-picker" aria-label="Choose your game"><span>I PLAY</span>{games.map(item => <a key={item.key} className={current === item.key ? "active" : ""} href={item.path} onClick={() => trackEvent(item.key, "game_select", placement)}><i>{item.mark}</i>{item.label}</a>)}</div>;
}

export default function Landing({ game = "general", checkoutOpen = false, engineOpen = false }: { game?: GameKey; checkoutOpen?: boolean; engineOpen?: boolean }) {
  const config = configs[game];
  const analysisHref = game === "general" ? "/analyze" : `/analyze?game=${game}`;
  const riotRequest = game === "league" || game === "valorant";
  const replayClosed = !riotRequest && !engineOpen;
  const intakeHref = replayClosed ? "#join-beta" : analysisHref;
  const intakeLabel = riotRequest ? "Save beta request" : replayClosed ? "Join replay beta" : "Start evidence check";
  const lead = replayClosed
    ? "PC replay engine: final quality gate. Console video lane: next. Join first access—no file or card today."
    : config.lead;

  useEffect(() => {
    const key = `replaymethod-view-${location.pathname}`;
    if (!sentViews.has(key)) {
      sentViews.add(key);
      trackEvent(game, "page_view", "landing");
    }
  }, [game]);

  const previewProduct = () => {
    trackEvent(game, "cta_click", "hero_product_preview");
    document.getElementById("product")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return <main>
    <div className="launch-bar"><strong>{riotRequest ? "RIOT ACCESS BETA" : replayClosed ? "REPLAY BETA ACCESS" : "REPLAY EVIDENCE BETA"}</strong><span>{riotRequest ? "Preserve an opt-in request. Official ingestion is pending." : replayClosed ? "The production quality gate is finishing. No file or card today." : "Submit one real replay. See the verified outcome."}</span><a href={intakeHref} onClick={() => trackEvent(game, replayClosed ? "cta_click" : "analysis_start", "launch_bar")}>{intakeLabel} →</a></div>
    <nav className="nav shell"><a className="brand" href="/" aria-label="Replay Method home"><span className="logo">↻</span><span>replay<span>method</span></span></a><div className="nav-links"><a href={replayClosed ? "/#join-beta" : "/analyze"}>Beta access</a><a href="#product">Sample report</a><a href="/guides">Guides</a><a href="#pricing">Pricing</a></div><a className="nav-cta" href={intakeHref} onClick={() => trackEvent(game, replayClosed ? "cta_click" : "analysis_start", "nav_analysis")}>{intakeLabel}</a></nav>

    <section className="hero shell">
      <div className="hero-copy"><div className="eyebrow"><i /> {config.eyebrow}</div><h1>{config.title}<br /><em>{config.accent}</em></h1><p className="lead">{lead}</p><GameLinks current={game} placement="hero_picker" />{(game === "general" || game === "rocket-league") && engineOpen ? <><QuickReplayStart placement={game === "general" ? "home_quick_replay" : "rl_quick_replay"} /><div className="hero-quiet-actions"><button className="hero-secondary" onClick={previewProduct}>See a sample report <span>↓</span></button><a href={analysisHref} onClick={() => trackEvent(game, "analysis_start", "hero_full_intake")}>Use the full intake instead →</a></div></> : <div className="hero-actions"><a className="hero-primary" href={intakeHref} onClick={() => trackEvent(game, replayClosed ? "cta_click" : "analysis_start", "hero_analysis")}><span>{riotRequest ? "OFFICIAL ACCESS PENDING" : "ENGINE VALIDATION IN PROGRESS"} · NO CARD</span><b>{riotRequest ? "Save my beta request" : "Join the replay beta"} <i>→</i></b></a><button className="hero-secondary" onClick={previewProduct}>Play the product walkthrough <span>↓</span></button></div>}<div className="hero-proof"><span><i>01</i> Real match evidence</span><span><i>02</i> Honest abstention</span><span><i>03</i> No card</span></div><div className="hero-route-links"><a className="hero-plan-summary" href="#pricing" onClick={() => trackEvent(game, "cta_click", "hero_pricing")}><span>PLANS</span><b>First check planned free · paid checkout closed</b><i>↓</i></a><a className="hero-beta-link" href="/climb-check" onClick={() => trackEvent(game, "tool_start", "hero_climb_check")}>No replay ready? Run the 60-second Climb Check →</a></div>
      </div>
      <div className="visual-wrap"><div className="orb orb-a" /><div className="orb orb-b" /><div className="example-tag">PLAY THE PRODUCT</div><GameHeroExperience game={game} /></div>
    </section>

    <section className="proof-ribbon"><div className="shell"><span><b>01</b> REPLAY</span><i>→</i><span><b>02</b> REVEAL</span><i>→</i><span><b>03</b> PRACTICE</span><i>→</i><span><b>04</b> PROVE</span></div></section>
        <HardstuckHook
          analysisHref={intakeHref}
          requestOnly={riotRequest}
          intakeClosed={replayClosed}
          onPatternSelect={(pattern) => trackEvent(game, "hardstuck_select", `pattern_${pattern}`)}
          onAnalysisStart={() =>
            trackEvent(game, "analysis_start", "hardstuck_hook")
          }
        />

    <section className="product-section shell" id="product"><div className="section-intro"><span className="kicker">PLAY THE REPORT</span><h2>Spot it. Train it.<br />Prove it changed.</h2><p>Three rounds. One real decision loop. Every value is example data.</p></div><InteractiveReportPreview config={config} game={game} /><div className="demo-conversion"><div><span>{riotRequest ? "RIOT ACCESS REQUESTS ARE OPEN" : replayClosed ? "REPLAY BETA LIST IS OPEN" : "FIRST CHECK · $0"}</span><b>{riotRequest ? "Save your official-access request." : replayClosed ? "Get first access." : "Try the real evidence pipeline."}</b><p>{riotRequest ? "No unsupported ingestion." : replayClosed ? "We email you when the engine clears its gate." : "Your replay decides whether a finding is strong enough to show."}</p></div><a href={intakeHref} onClick={() => trackEvent(game, replayClosed ? "cta_click" : "analysis_start", "demo_analysis")}>{intakeLabel} →</a></div></section>

    <PricingLadder analysisHref={intakeHref} game={game} requestOnly={riotRequest} checkoutOpen={checkoutOpen} replayReady={!replayClosed} />

    <section className="compare"><div className="shell"><div className="section-intro"><span className="kicker">THE DIFFERENCE</span><h2>Stats describe.<br />Replay Method changes the next decision.</h2><p>Evidence → one cue → recheck.</p></div><div className="compare-table"><div className="compare-head"><span>WHAT YOU GET</span><b>STAT TRACKER</b><b>AI CHAT</b><b className="climb-col">REPLAY METHOD</b></div>{[["Uses your real match", "✓", "Sometimes", "✓"], ["Finds the repeated decision", "—", "Sometimes", "✓"], ["Gives one playable cue", "—", "Sometimes", "✓"], ["Remembers it next match", "—", "—", "✓"], ["Checks if it changed", "—", "—", "✓"]].map(row => <div className="compare-row" key={row[0]}>{row.map((cell, index) => index === 0 ? <span key={cell}>{cell}</span> : <b className={index === 3 ? "climb-col" : ""} key={`${cell}-${index}`}>{cell}</b>)}</div>)}</div><div className="difference-line"><span>THE PROMISE</span><b>Stop losing for the same reason.</b></div></div></section>

    <section className="guide-preview shell"><div className="section-intro"><span className="kicker">FREE FIELD NOTES</span><h2>Stuck? Open the exact checklist.</h2><p>No filler. One useful review session.</p></div><div className="guide-preview-grid"><a href="/guides/league-replay-review-checklist"><span>LEAGUE OF LEGENDS</span><h3>Review the loss before the final fight</h3><p>Lane → vision → objective.</p><b>Open guide →</b></a><a href="/guides/valorant-vod-review-checklist"><span>VALORANT</span><h3>Review a VOD in 15 minutes</h3><p>Contact → trade → utility.</p><b>Open guide →</b></a><a href="/guides/rocket-league-replay-review-checklist"><span>ROCKET LEAGUE</span><h3>Find the decision behind the goal</h3><p>Spacing → boost → recovery.</p><b>Open guide →</b></a></div></section>

    <section className="faq shell"><div className="section-intro"><span className="kicker">NO BULLSHIT FAQ</span><h2>Know exactly what you’re submitting.</h2></div><div className="faq-list"><details><summary>Is Replay Method live today?<b>+</b></summary><p>{replayClosed ? "The public beta site and waitlist are live. Rocket League file intake remains closed until the production evidence engine passes its real-replay quality gate; League and VALORANT ingestion awaits official Riot production approval." : "The production-quality beta foundation is live. Rocket League uses original .replay files; official League and VALORANT account ingestion is awaiting Riot production approval. A report is only produced when the available evidence supports it."}</p></details><details><summary>Does Replay Method guarantee I rank up?<b>+</b></summary><p>No honest coach can guarantee a rank. Replay Method exposes patterns, focuses practice and tracks behavior. You still have to play and apply the feedback.</p></details><details><summary>Which games are supported?<b>+</b></summary><p>Rocket League is the first deep replay adapter. League of Legends and VALORANT share the same product foundation and will activate through official opt-in Riot connections after approval.</p></details><details><summary>What can I submit?<b>+</b></summary><p>{replayClosed ? "No replay file is accepted while the production engine is closed. Join the beta list instead. League and VALORANT requests may preserve a representative match link, but unverified public profiles are never used to invent private-match coaching." : "Rocket League automation requires the original PC .replay file. League and VALORANT beta requests can preserve a representative match link, but unverified public profiles are never used to invent private-match coaching."}</p></details><details><summary>What happens after submission?<b>+</b></summary><p>{replayClosed ? "A beta-list signup stores your email and selected game so we can invite you when the quality gate passes. No replay or payment details are collected today." : "You immediately receive a private status link. It shows the real pipeline stage, report evidence and engine versions—or an honest blocked state when access or evidence is insufficient."}</p></details><details><summary>Why not just use a stat tracker?<b>+</b></summary><p>Trackers are excellent at showing rank, history and performance. Replay Method turns repeated patterns into one prioritized correction you can apply in the next match.</p></details></div></section>

    <section className="final"><div className="shell"><span className="kicker">REPLAY. REVEAL. PRACTICE. PROVE.</span><h2>Stop hoping the rank changes.<br />Change what creates the rank.</h2><p className="final-lead">{riotRequest ? "Save an opt-in beta request while official Riot access is pending." : replayClosed ? "Join for first access when the real-replay quality gate passes." : "Submit one real replay and see the evidence-gated outcome free."}</p>{!replayClosed && <a className="final-analysis-cta" href={analysisHref} onClick={() => trackEvent(game, "analysis_start", "final_analysis")}>{intakeLabel} →</a>}<p className="final-alt">{replayClosed ? "Beta access is free to request. No file or payment today." : "Not ready to submit? Join beta updates below."}</p><WaitlistForm game={game} config={config} placement="final_form" id="join-beta" /><small>Private beta · No card · No unsupported coaching</small></div></section>
    <footer className="shell"><div className="brand"><span className="logo">↻</span><span>replay<span>method</span></span></div><p>A better way to get better.</p><div className="footer-links"><a href={replayClosed ? "/#join-beta" : "/analyze"}>Beta access</a><a href="/reports">My reports</a><a href="/guides">Guides</a><a href="mailto:contact@replaymethod.xyz">Contact</a><a href="/privacy">Privacy</a><a href="/terms">Service terms</a><a href="/beta-terms">Beta terms</a></div><small>Independent service. Not affiliated with, endorsed by or sponsored by Riot Games, Psyonix or Epic Games.</small></footer>
    <div className="mobile-join"><div><span>{riotRequest ? "RIOT ACCESS BETA" : "REPLAY QUALITY BETA"}</span><b>{riotRequest ? "Save a private request" : replayClosed ? "Join first access" : "Start an evidence check"}</b></div><a href={intakeHref} onClick={() => trackEvent(game, replayClosed ? "cta_click" : "analysis_start", "mobile_analysis")}>{riotRequest ? "Save" : replayClosed ? "Join" : "Start"} →</a></div>
  </main>;
}
