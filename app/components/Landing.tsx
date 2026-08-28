"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type TouchEvent } from "react";
import Link from "next/link";
import { trackProductEvent } from "../../lib/client-analytics";
import BatchAnalyzeFlow from "../analyze/BatchAnalyzeFlow";
import { CustomerFooter, CustomerHeader } from "./CustomerChrome";
import { ReplayMark } from "./ReplayMark";

export type GameKey = "general" | "league" | "valorant" | "rocket-league";

const sentViews = new Set<string>();

function FutureGame({ game }: { game: "league" | "valorant" }) {
  const label = game === "league" ? "League of Legends" : "VALORANT";
  return <main className="future-game-page">
    <nav className="marcel-nav shell"><Link className="brand" href="/"><span className="logo" aria-hidden="true"><ReplayMark /></span><span>replay<span>method</span></span></Link><Link href="/">Rocket League beta</Link></nav>
    <section>
      <span>{label.toUpperCase()} · COMING LATER</span>
      <h1>One game at a time.<br />Evidence before expansion.</h1>
      <p>Replay Method is validating the complete replay-to-improvement loop in Rocket League first. {label} will open only when authorized match evidence can support the same standard.</p>
      <Link href="/">Try the Rocket League beta →</Link>
    </section>
  </main>;
}

const loopStages = [
  { key: "before", label: "Before", eyebrow: "The moment", title: "Double commit", body: "Two players choose the same layer." },
  { key: "replay", label: "Replay", eyebrow: "The pattern", title: "Repeated in 6 of 10 matches", body: "The same decision appears across comparable moments." },
  { key: "better", label: "Better", eyebrow: "Your next rule", title: "Hold the second layer.", body: "Protect the next touch instead of following the same ball." },
] as const;

const LOOP_STAGE_DURATIONS_MS = [2200, 2400, 2600] as const;

function ProductMoment({ earlyAccessOpen }: { earlyAccessOpen: boolean }) {
  const [activeStage, setActiveStage] = useState(0);
  const [playback, setPlayback] = useState<"idle" | "playing" | "paused" | "complete">("idle");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [autoplayDisabled, setAutoplayDisabled] = useState(false);
  const touchStart = useRef<number | null>(null);
  const demoRef = useRef<HTMLDivElement>(null);
  const hasAutoplayed = useRef(false);
  const stage = loopStages[activeStage];

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyPreference = () => setReducedMotion(preference.matches);
    applyPreference();
    preference.addEventListener("change", applyPreference);
    return () => preference.removeEventListener("change", applyPreference);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const query = new URLSearchParams(window.location.search);
      const localReview = ["localhost", "127.0.0.1"].includes(window.location.hostname) && query.get("demoReview") === "1";
      setAutoplayDisabled(localReview && query.get("demoAutoplay") === "off");
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const target = demoRef.current;
    const query = new URLSearchParams(window.location.search);
    const localAutoplayOff = ["localhost", "127.0.0.1"].includes(window.location.hostname) && query.get("demoReview") === "1" && query.get("demoAutoplay") === "off";
    if (!target || reducedMotion || autoplayDisabled || localAutoplayOff || hasAutoplayed.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting || hasAutoplayed.current) return;
      hasAutoplayed.current = true;
      setActiveStage(0);
      setPlayback("playing");
      observer.disconnect();
    }, { threshold: 0.35 });
    observer.observe(target);
    return () => observer.disconnect();
  }, [autoplayDisabled, reducedMotion]);

  useEffect(() => {
    if (playback !== "playing") return;
    const timer = window.setTimeout(() => {
      if (activeStage === loopStages.length - 1) setPlayback("complete");
      else setActiveStage(current => current + 1);
    }, LOOP_STAGE_DURATIONS_MS[activeStage]);
    return () => window.clearTimeout(timer);
  }, [activeStage, playback]);

  function chooseStage(index: number, manual = true) {
    setActiveStage((index + loopStages.length) % loopStages.length);
    if (manual) setPlayback("paused");
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

  function play() {
    if (playback === "complete") setActiveStage(0);
    setPlayback("playing");
  }

  return <section className="rm-engine-section" id="product">
    <div className="reveal-shell">
      <header className="rm-engine-intro"><span className="reveal-kicker">Product proof</span><h2>See the pattern.<br />Open the proof.</h2><p>Every finding links back to the replay moments behind it. No clear pattern means no invented answer.</p></header>
      <div ref={demoRef} className="rm-engine-demo" data-playback={playback} onTouchStart={beginSwipe} onTouchEnd={endSwipe}>
        <header className="rm-engine-bar"><span><i />Illustrative example</span><small>Comparable 2v2 moments</small></header>
        <div className="rm-engine-stage">
          <div className={`rm-engine-field stage-${stage.key}`} role="img" aria-label={`Illustrative replay engine view showing the ${stage.label.toLowerCase()} state of a repeated double commit.`}>
            <span className="rm-engine-pitch" aria-hidden="true"><i className="rm-engine-midline" /><i className="rm-engine-circle" /><i className="rm-engine-goal rm-engine-goal-left" /><i className="rm-engine-goal rm-engine-goal-right" /></span>
            <i className="rm-engine-object rm-engine-subject" aria-hidden="true" />
            <i className="rm-engine-object rm-engine-mate" aria-hidden="true" />
            <i className="rm-engine-object rm-engine-opponent-one" aria-hidden="true" />
            <i className="rm-engine-object rm-engine-opponent-two" aria-hidden="true" />
            <i className="rm-engine-ball" aria-hidden="true" />
            <span className="rm-engine-state" aria-hidden="true">{stage.label}</span>
          </div>
          <div className="rm-engine-output" id="loop-stage-panel" role="tabpanel" aria-live={playback === "playing" ? "off" : "polite"} aria-labelledby={`loop-stage-${activeStage}`}>
            <div className="rm-engine-output-head"><span>{stage.eyebrow}</span><div aria-label="Example playback control">{playback === "playing" ? <button type="button" onClick={() => setPlayback("paused")}>Pause</button> : playback === "complete" ? <button type="button" onClick={play}>Replay</button> : <button type="button" onClick={play}>Play demo</button>}</div></div>
            <div key={stage.key} className="rm-engine-copy"><h3>{stage.title}</h3><p>{stage.body}</p></div>
            <div className="rm-engine-tabs" role="tablist" aria-label="Replay comparison states">{loopStages.map((item,index)=><button id={`loop-stage-${index}`} type="button" role="tab" aria-label={item.label} aria-selected={activeStage===index} aria-controls="loop-stage-panel" tabIndex={activeStage===index?0:-1} onClick={()=>chooseStage(index)} onKeyDown={event=>handleStageKey(event,index)} key={item.key}><span>{String(index+1).padStart(2,"0")}</span>{item.label}</button>)}</div>
          </div>
        </div>
        <footer className="rm-engine-foot"><span>One moment shows the method.</span><span>{earlyAccessOpen ? "Ten matches reveal what repeats." : "Public output opens only when the evidence holds."}</span></footer>
      </div>
    </div>
  </section>;
}

function HowItWorks() {
  return <section className="rm-home-how" id="method" aria-labelledby="how-title">
    <div className="reveal-shell">
      <header><span className="reveal-kicker">How it works</span><h2 id="how-title">Ten matches.<br />One clear focus.</h2><p>The complexity stays in the engine.</p></header>
      <ol>
        <li><small>01</small><div><h3>Find what repeats.</h3><p>Ten comparable matches reveal the pattern.</p></div></li>
        <li><small>02</small><div><h3>Open the proof.</h3><p>Every finding links back to the replay moments behind it.</p></div></li>
        <li><small>03</small><div><h3>Know what to change.</h3><p>One clear adjustment for your next queue.</p></div></li>
      </ol>
    </div>
  </section>;
}

function WhyTrustIt({ earlyAccessOpen }: { earlyAccessOpen: boolean }) {
  return <section className="rm-home-trust" id="why" aria-labelledby="why-title">
    <div className="reveal-shell">
      <header>
        <span className="reveal-kicker">Built for trust</span>
        <h2 id="why-title">The answer stays attached to the evidence.</h2>
        <p>{earlyAccessOpen ? "See the pattern, inspect the moments and carry one supported rule into your next queue." : "Early access opens only when real replay evidence can support the result."}</p>
      </header>
      <div className="rm-home-trust-list">
        <article><span>01</span><div><small>Original replay files</small><h3>Real match context.</h3><p>Decisions are compared inside the moments where they happened.</p></div><b>Context</b></article>
        <article><span>02</span><div><small>Visible evidence</small><h3>Proof you can open.</h3><p>The exact replay moments remain connected to every supported finding.</p></div><b>Evidence</b></article>
        <article><span>03</span><div><small>Honest abstention</small><h3>No signal, no guess.</h3><p>If the pattern is not clear enough, Replay Method says so.</p></div><b>Trust</b></article>
      </div>
    </div>
  </section>;
}

export default function Landing({ game = "general", engineOpen = false, earlyAccessOpen = false }: { game?: GameKey; engineOpen?: boolean; calibrationOpen?: boolean; earlyAccessOpen?: boolean }) {
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

  return <main ref={pageRef} className="marcel-home reveal-home" data-hydrated="false">
    <CustomerHeader current="product" />

    <section className="rm-home-hero reveal-shell" aria-labelledby="home-title">
      <span className="reveal-kicker">Replay intelligence for Rocket League</span>
      <h1 id="home-title">Stop losing for<br />the same reason.</h1>
      <p>Drop 10 ranked replays. Find the decision that keeps repeating.</p>
      <div className="rm-home-hero-actions">
        <a href="#ten-replay-start" onClick={() => trackProductEvent("analysis_start","rocket-league","home_hero")}>Analyze my replays <span aria-hidden="true">↓</span></a>
        <a href="#product">See an example</a>
      </div>
      <small>Private report · No card · Original PC replays</small>
    </section>

    <section className="rm-home-activation reveal-shell" aria-label="Start a free ten-replay analysis">
      <BatchAnalyzeFlow engineOpen={engineOpen} variant="hero" />
    </section>

    <HowItWorks />
    <ProductMoment earlyAccessOpen={earlyAccessOpen} />
    <WhyTrustIt earlyAccessOpen={earlyAccessOpen} />

    <section className="rm-home-final reveal-shell" id="pricing" aria-labelledby="final-title">
      <span className="reveal-kicker">Your improvement loop</span>
      <div className="rm-home-final-copy"><h2 id="final-title">Ready to see<br />what repeats?</h2><p>Start with the last ten ranked matches from one playlist.</p></div>
      <div className="rm-home-final-action"><a href="#ten-replay-start" onClick={() => trackProductEvent("analysis_start","rocket-league","home_final")}>Analyze my replays <span aria-hidden="true">↑</span></a><small>Private · No card · Original replays</small></div>
      <div className="rm-home-premium-line"><span><small>Free</small><b>Find the pattern.</b></span><i aria-hidden="true">→</i><span><small>Premium · planned</small><b>Track the fix.</b></span></div>
    </section>

    <CustomerFooter />
  </main>;
}
