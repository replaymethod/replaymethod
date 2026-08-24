"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type TouchEvent } from "react";
import Link from "next/link";
import ReplayContribution from "../rocket-league-beta/ReplayContribution";
import { trackProductEvent } from "../../lib/client-analytics";

export type GameKey = "general" | "league" | "valorant" | "rocket-league";

const sentViews = new Set<string>();

function FutureGame({ game }: { game: "league" | "valorant" }) {
  const label = game === "league" ? "League of Legends" : "VALORANT";
  return <main className="future-game-page">
    <nav className="marcel-nav shell"><Link className="brand" href="/"><span className="logo" aria-hidden="true" /><span>replay<span>method</span></span></Link><Link href="/">Rocket League beta</Link></nav>
    <section>
      <span>{label.toUpperCase()} · COMING LATER</span>
      <h1>One game at a time.<br />Evidence before expansion.</h1>
      <p>Replay Method is validating the complete replay-to-improvement loop in Rocket League first. {label} will open only when authorized match evidence can support the same standard.</p>
      <Link href="/">Try the Rocket League beta →</Link>
    </section>
  </main>;
}

function MethodStrip() {
  return <section className="marcel-loop shell" aria-label="How Replay Method works">
    <article><i>01</i><div><b>See what keeps happening</b><span>Ten matches reveal what one match can hide.</span></div></article>
    <article><i>02</i><div><b>Know what to try next</b><span>One supported habit. One simple rule.</span></div></article>
    <article><i>03</i><div><b>Check if it improves</b><span>Take the rule into your next three matches.</span></div></article>
  </section>;
}

function focusReplayUploader(source: string) {
  const uploader = document.getElementById("ten-replay-start");
  if (!uploader) return;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  uploader.focus({ preventScroll: true });
  uploader.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
  trackProductEvent("cta_click", "rocket-league", source);
}

function TenReplayStart() {
  return <section className="quick-replay ten-replay-start" id="ten-replay-start" tabIndex={-1} aria-label="Start a free ten-replay baseline">
    <div className="quick-replay-top"><span>YOUR FREE REVIEW</span><b>0 / 10</b></div>
    <h2>Ten matches.<br />One next move.</h2>
    <p>Use the same player and ranked playlist. Ten matches help separate a repeated habit from one weird game.</p>
    <div className="intake-progress" aria-label="0 of 10 verified replays"><i style={{ width: "0%" }} /><span>0 / 10</span></div>
    <Link className="quick-submit" href="/analyze" onClick={() => trackProductEvent("analysis_start", "rocket-league", "home_ten_replay_start")}>Choose 10 replays <span>→</span></Link>
    <small>One free 10-match review · Private · No card</small>
  </section>;
}

const loopStages = [
  { key: "crowd", label: "0–2 SEC", title: "You follow too close.", body: "Your teammate is already on the ball in the offensive corner. You drive into the same space." },
  { key: "clear", label: "2–4 SEC", title: "The clear beats both of you.", body: "The opponent sends the ball over both cars. Nobody is behind the play." },
  { key: "freeze", label: "4–6 SEC", title: "You followed too close. Nobody covered the clear.", body: "With nobody behind the play, the opponents get an easy goal. The useful moment came before it." },
  { key: "rewind", label: "6–8 SEC", title: "Let them go. Cover what happens next.", body: "Rewind. This time you stay deeper, read the clear, and keep the play alive." },
] as const;

function ProductMoment({ earlyAccessOpen }: { earlyAccessOpen: boolean }) {
  const [activeStage, setActiveStage] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const touchStart = useRef<number | null>(null);
  const stage = loopStages[activeStage];

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyPreference = () => {
      setReducedMotion(preference.matches);
      if (preference.matches) setPaused(true);
    };
    applyPreference();
    preference.addEventListener("change", applyPreference);
    return () => preference.removeEventListener("change", applyPreference);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion) return;
    const timer = window.setInterval(() => setActiveStage(current => (current + 1) % loopStages.length), 2000);
    return () => window.clearInterval(timer);
  }, [paused, reducedMotion]);

  function chooseStage(index: number, manual = true) {
    setActiveStage((index + loopStages.length) % loopStages.length);
    if (manual) setPaused(true);
  }

  function handleStageKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const keys: Record<string, number> = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: loopStages.length - 1 };
    if (!(event.key in keys)) return;
    event.preventDefault();
    const next = (keys[event.key] + loopStages.length) % loopStages.length;
    chooseStage(next);
    document.getElementById(`loop-stage-${next}`)?.focus();
  }

  function beginSwipe(event: TouchEvent<HTMLElement>) {
    touchStart.current = event.changedTouches[0]?.clientX ?? null;
  }

  function endSwipe(event: TouchEvent<HTMLElement>) {
    if (touchStart.current == null) return;
    const distance = (event.changedTouches[0]?.clientX ?? touchStart.current) - touchStart.current;
    touchStart.current = null;
    if (Math.abs(distance) < 45) return;
    chooseStage(activeStage + (distance < 0 ? 1 : -1));
  }

  return <section className="marcel-moment shell" id="product">
    <div className="marcel-moment-copy">
      <span>AN 8-SECOND EXAMPLE</span>
      <h2>One mistake.<br />One better decision.</h2>
      <p>A calm replay of a familiar ranked problem: following the first player into the corner instead of covering the clear.</p>
      <div className="marcel-truth"><i>✓</i><span><b>Example, not your analysis</b>{earlyAccessOpen ? "Your real review only uses moments verified across your own ten replays." : "Your real review opens only when every match can be verified safely."}</span></div>
    </div>
    <div className={`marcel-demo stage-${stage.key}`} aria-label="Illustrative Replay Method product loop" onTouchStart={beginSwipe} onTouchEnd={endSwipe}>
      <header><span>RANKED 2V2 EXAMPLE</span><em>NOT YOUR ANALYSIS</em></header>
      <div className="marcel-demo-stages" role="tablist" aria-label="Improvement loop stages">
        {loopStages.map((item, index) => <button id={`loop-stage-${index}`} type="button" role="tab" aria-selected={activeStage === index} aria-controls="loop-stage-panel" tabIndex={activeStage === index ? 0 : -1} onClick={() => chooseStage(index)} onKeyDown={event => handleStageKey(event, index)} key={item.key}>{item.label}</button>)}
      </div>
      <div className="marcel-demo-screen" id="loop-stage-panel" role="tabpanel" aria-live={paused ? "polite" : "off"} aria-labelledby={`loop-stage-${activeStage}`}>
        <div className="marcel-demo-meta"><span>{stage.label}</span><b>{activeStage === 3 ? "BETTER DECISION" : activeStage === 2 ? "FREEZE" : "THE PLAY"}</b></div>
        <div className="marcel-field" aria-hidden="true"><i className="scan-line" /><i className="ball" /><i className="car one" /><i className="car two" /><i className="path" /><i className="evidence-pin">01</i></div>
        <p><b>{stage.title}</b>{stage.body}</p>
      </div>
      <div className="marcel-demo-progress" aria-hidden="true"><i style={{ width: `${((activeStage + 1) / loopStages.length) * 100}%` }} /></div>
      <div className="marcel-demo-controls" aria-label="Example playback controls"><button type="button" onClick={() => setPaused(value => !value)}>{paused ? "Play" : "Pause"}</button><button type="button" onClick={() => { setActiveStage(0); setPaused(reducedMotion); }}>Replay</button><span>{activeStage + 1} / 4</span></div>
      <Link className="marcel-demo-cta" href="/analyze" onClick={() => trackProductEvent("analysis_start", "rocket-league", "product_demo")}>Find the mistake I keep repeating <span>→</span></Link>
    </div>
  </section>;
}

export default function Landing({ game = "general", engineOpen = false, calibrationOpen = false, earlyAccessOpen = false }: { game?: GameKey; engineOpen?: boolean; calibrationOpen?: boolean; earlyAccessOpen?: boolean }) {
  const pageRef = useRef<HTMLElement>(null);
  useEffect(() => {
    pageRef.current?.setAttribute("data-hydrated", "true");
    const key = `replaymethod-view-${location.pathname}`;
    if (!sentViews.has(key)) {
      sentViews.add(key);
      trackProductEvent("page_view", game === "general" ? "rocket-league" : game, "marcel_landing");
    }
  }, [game]);

  if (game === "league" || game === "valorant") return <FutureGame game={game} />;

  return <main ref={pageRef} className="marcel-home" data-hydrated="false">
    <nav className="marcel-nav shell">
      <Link className="brand" href="/" aria-label="Replay Method home"><span className="logo" aria-hidden="true" /><span>replay<span>method</span></span></Link>
      <div><a href="#product">How it helps</a><Link href="/reports">My progress</Link></div>
    </nav>

    <section className="marcel-hero shell">
      <div className="marcel-hero-copy">
        <span className="marcel-status"><i /> ROCKET LEAGUE · {engineOpen && earlyAccessOpen ? "EARLY ACCESS BETA" : engineOpen ? "PC REPLAY BETA" : "PRIVATE BETA"}</span>
        <h1>Upload 10 ranked replays.<br /><em>See the mistake you keep repeating.</em></h1>
        <p>{engineOpen ? "Replay Method compares ten matches from the same player, filters out one-off moments, and gives you one focus for your next session." : "The ten-replay review opens only while every match can be verified safely."}</p>
        <div className="marcel-trust-row"><span>One free 10-match review · Private · No card</span></div>
      </div>
      <div className="marcel-upload-stage">
        {engineOpen ? <TenReplayStart /> : <ReplayContribution intakeOpen={calibrationOpen} compact />}
      </div>
    </section>

    <ProductMoment earlyAccessOpen={earlyAccessOpen} />
    <MethodStrip />
    <section className="pricing-compact shell" id="pricing" aria-labelledby="pricing-title"><div className="commercial-section-copy"><span className="kicker">PREMIUM · COMING LATER</span><h2 id="pricing-title">Free: find the pattern. Premium: prove you fixed it.</h2><p>Your free review uses exactly ten valid replays. A future Premium will compare up to 35 representative replays per week and measure change over time. It is not for sale and there is no checkout.</p></div></section>

    <section className="marcel-beta-truth shell" aria-labelledby="trust-title">
      <span>{earlyAccessOpen ? "EARLY ACCESS · CLEAR ANSWERS" : "PRIVATE BETA · CLEAR ANSWERS"}</span>
      <h2 id="trust-title">Useful when the pattern is clear. Honest when it is not.</h2>
      <div className="marcel-promises">
        <article><i>01</i><b>Your ten matches</b><p>Every accepted replay stays visible and contributes to one combined review.</p></article>
        <article><i>02</i><b>Your next move</b><p>You get one focus only when the same supported pattern appears across matches.</p></article>
        <article><i>03</i><b>If the pattern is weak</b><p>You still see what was analyzed, the neutral facts, and what to do next. No invented coaching.</p></article>
      </div>
    </section>

    <section className="marcel-faq shell" aria-labelledby="faq-title">
      <header><span>BEFORE YOU UPLOAD</span><h2 id="faq-title">Straight answers.</h2></header>
      <details><summary>Where is my Rocket League replay?<b>+</b></summary><p>On Windows: Documents → My Games → Rocket League → TAGame → Demos. Choose the original file ending in .replay.</p></details>
      <details><summary>Will I get an analysis now?<b>+</b></summary><p>{engineOpen ? "Yes, after ten valid replays. Each file is verified for the same player and ranked playlist. The report is released only at 10/10." : "Not while the deterministic replay engine is unavailable. No files are accepted into a dead end."}</p></details>
      <details><summary>What if one file is invalid?<b>+</b></summary><p>It is excluded with a concrete reason and does not consume a valid slot. Add a replacement until the batch reaches exactly ten verified matches.</p></details>
      <details><summary>What happens to the files?<b>+</b></summary><p>They are stored privately to deliver the requested report. Customer replays are excluded from calibration, training and evaluation unless you separately opt in.</p></details>
      <details><summary>Why might Replay Method abstain?<b>+</b></summary><p>If no supported pattern repeats across the ten matches, the report shows the verified facts and explains why it cannot name a habit yet.</p></details>
      <button className="marcel-faq-cta" type="button" onClick={() => focusReplayUploader("trust_faq_to_uploader")}>Choose 10 replays <span>↑</span></button>
    </section>

    <footer className="marcel-footer shell">
      <div className="brand"><span className="logo" aria-hidden="true" /><span>replay<span>method</span></span></div>
      <p>Rocket League first. <Link href="/league">League</Link> and <Link href="/valorant">VALORANT</Link> later.</p>
      <div><Link href="/privacy">Privacy</Link><Link href="/beta-terms">Beta terms</Link><a href="mailto:contact@replaymethod.xyz">Contact</a></div>
      <small>Independent service. Not affiliated with or endorsed by Psyonix or Epic Games.</small>
    </footer>
  </main>;
}
