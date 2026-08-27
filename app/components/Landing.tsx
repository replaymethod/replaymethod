"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type TouchEvent } from "react";
import Link from "next/link";
import { trackProductEvent } from "../../lib/client-analytics";
import { CustomerFooter, CustomerHeader } from "./CustomerChrome";
import { ReplayMark } from "./ReplayMark";

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

const loopStages = [
  { key: "setup", label: "01 · The setup", title: "Your teammate attacks the corner.", body: "You still have space to protect the next ball." },
  { key: "mistake", label: "02 · The mistake", title: "Both of you committed.", body: "You followed too close and entered the same space." },
  { key: "consequence", label: "03 · The consequence", title: "Nobody covered the next ball.", body: "The opponent reaches it first and shoots toward your open net." },
  { key: "rewind", label: "04 · Rewind", title: "Run the same moment again.", body: "This time, your teammate attacks while you read the next play." },
  { key: "decision", label: "05 · The better decision", title: "Stay one layer back.", body: "Keep enough distance to react to the clear." },
  { key: "result", label: "06 · The result", title: "Keep the play alive.", body: "You reach the next ball and your team stays in control." },
] as const;

// Deliberately speed-remapped: action moves quickly, while the consequence and
// result get enough room to land. The full loop is 9.2 seconds.
const LOOP_STAGE_DURATIONS_MS = [1500, 1150, 1900, 1050, 1550, 2050] as const;
const REPLAY_CUE_LEAD_MS = 280;
const REPLAY_CUE_DURATION_MS = 980;

function ProductMoment({ earlyAccessOpen }: { earlyAccessOpen: boolean }) {
  const [activeStage, setActiveStage] = useState(0);
  const [playback, setPlayback] = useState<"idle" | "playing" | "paused" | "complete">("idle");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [variant, setVariant] = useState<"tactical" | "focus">("tactical");
  const [reviewControls, setReviewControls] = useState(false);
  const [autoplayDisabled, setAutoplayDisabled] = useState(false);
  const [replayCueVisible, setReplayCueVisible] = useState(false);
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
      setReviewControls(localReview);
      setAutoplayDisabled(localReview && query.get("demoAutoplay") === "off");
      if (localReview && query.get("demoVariant") === "focus") setVariant("focus");
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

  useEffect(() => {
    const timers: number[] = [];

    if (playback === "playing" && activeStage === 2) {
      timers.push(window.setTimeout(() => setReplayCueVisible(false), 0));
      timers.push(window.setTimeout(
        () => setReplayCueVisible(true),
        LOOP_STAGE_DURATIONS_MS[activeStage] - REPLAY_CUE_LEAD_MS,
      ));
    } else if (activeStage === 3) {
      timers.push(window.setTimeout(() => setReplayCueVisible(true), 0));
      timers.push(window.setTimeout(
        () => setReplayCueVisible(false),
        playback === "playing"
          ? REPLAY_CUE_DURATION_MS - REPLAY_CUE_LEAD_MS
          : REPLAY_CUE_DURATION_MS,
      ));
    } else {
      timers.push(window.setTimeout(() => setReplayCueVisible(false), 0));
    }

    return () => timers.forEach(timer => window.clearTimeout(timer));
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

  return <section className="reveal-section" id="product">
    <div className="reveal-shell">
      <header className="reveal-section-intro"><span className="reveal-kicker">Simple example · Double commit</span><h2>One common mistake. Two very different outcomes.</h2><p>Watch one double commit open the net. Then see how Replay Method finds the patterns you repeat across ten matches.</p></header>
      {reviewControls && <div className="reveal-review-controls" aria-label="Local demo review controls"><span>Local review</span><button type="button" aria-pressed={variant === "tactical"} onClick={() => setVariant("tactical")}>A · Tactical board</button><button type="button" aria-pressed={variant === "focus"} onClick={() => setVariant("focus")}>B · Focus mode</button></div>}
      <div ref={demoRef} className={`reveal-demo reveal-card reveal-variant-${variant}`} data-playback={playback} aria-label={`Illustrative Replay Method product loop, ${variant === "tactical" ? "tactical board" : "focus mode"} variant`} onTouchStart={beginSwipe} onTouchEnd={endSwipe}>
        <header className="rm-demo-windowbar"><span className="active"><i />Replay example</span><span>Decision comparison</span><small>9.2 second loop</small></header>
        <div className="reveal-field-wrap">
          <div className={`reveal-field stage-${stage.key}${replayCueVisible ? " show-replay-cue" : ""}`} role="img" aria-label="Illustrative horizontal Rocket League field and top-down 2v2 scenario. Both blue cars point toward and chase the same ball during the mistake. Your blue car is identified by a restrained gold outline. A circular replay cue signals a fresh attempt.">
            <span className="reveal-scene" aria-hidden="true">
              <span className="reveal-pitch"><span className="reveal-pitch-boundary" /><i className="reveal-goal reveal-goal-left" /><i className="reveal-goal reveal-goal-right" /><i className="reveal-goal-arc reveal-goal-arc-left" /><i className="reveal-goal-arc reveal-goal-arc-right" /></span>
              <i className="reveal-ball"><span className="reveal-ball-core" /></i>
              <i className="reveal-car car-you" /><i className="reveal-car car-mate" /><i className="reveal-car car-opp" /><i className="reveal-car car-opp-two" />
            </span>
                  <span className="reveal-restart" aria-hidden="true"><span className="reveal-restart-spinner"><i className="reveal-restart-mark"><ReplayMark /></i></span></span>
          </div>
        </div>
        <div className="reveal-demo-copy reveal-card" id="loop-stage-panel" role="tabpanel" aria-live={playback === "playing" ? "off" : "polite"} aria-labelledby={`loop-stage-${activeStage}`}>
          <div key={stage.key} className="reveal-stage-copy"><div className="reveal-demo-meta"><span className="reveal-step-index">{stage.label}</span><div className="reveal-demo-controls" aria-label="Example playback control">{playback === "playing" ? <button type="button" onClick={() => setPlayback("paused")}>Pause</button> : playback === "complete" ? <button type="button" onClick={play}>Replay</button> : <button type="button" onClick={play}>Play demo</button>}</div></div><h3>{stage.title}</h3><p>{stage.body}</p><div className="reveal-before-after"><div><small>The mistake</small><b>Follow the same ball</b></div><div><small>Better decision</small><b>Protect the next ball</b></div></div></div>
          <div className="reveal-timeline" role="tablist" aria-label="Demo steps">{loopStages.map((item,index)=><button id={`loop-stage-${index}`} type="button" role="tab" aria-label={`${String(index+1).padStart(2,"0")} ${item.label.replace(/^\d+ · /, "")}`} aria-selected={activeStage===index} aria-controls="loop-stage-panel" tabIndex={activeStage===index?0:-1} onClick={()=>chooseStage(index)} onKeyDown={event=>handleStageKey(event,index)} key={item.key}>{String(index+1).padStart(2,"0")}</button>)}</div>
        </div>
        <div className="reveal-example-bridge" aria-label="Difference between the simple example and a real Replay Method analysis">
          <div><span>This demo</span><b>One familiar mistake.</b><p>Six beats make a double commit instantly readable.</p></div>
          <i aria-hidden="true">→</i>
          <div><span>Your real analysis</span><b>Ten matches in context.</b><p>{earlyAccessOpen ? "Only verified, repeated opportunities become coaching." : "It opens only when every match can be verified safely."}</p></div>
          <a href="#why">Why ten replays matter <span aria-hidden="true">↓</span></a>
        </div>
      </div>
    </div>
  </section>;
}

function HowItWorks() {
  return <section className="rm-home-how" id="method" aria-labelledby="how-title">
    <div className="reveal-shell">
      <header><span className="reveal-kicker">How it works</span><h2 id="how-title">From replay files to one useful focus.</h2></header>
      <ol>
        <li><small>01</small><div><h3>Upload ten ranked replays.</h3><p>Use the same player and playlist so the matches can be compared fairly.</p></div></li>
        <li><small>02</small><div><h3>We find what repeats.</h3><p>Replay Method compares similar decisions across the full set, with the situation around each one.</p></div></li>
        <li><small>03</small><div><h3>Take one focus into your next session.</h3><p>You get the clearest supported pattern, the replay evidence and a concrete adjustment.</p></div></li>
      </ol>
    </div>
  </section>;
}

function WhyTrustIt({ earlyAccessOpen }: { earlyAccessOpen: boolean }) {
  return <section className="rm-home-trust" id="why" aria-labelledby="why-title">
    <div className="reveal-shell">
      <header>
        <span className="reveal-kicker">Why trust the result</span>
        <h2 id="why-title">A pattern needs evidence.<br />Not confidence theatre.</h2>
        <p>{earlyAccessOpen ? "Early Access stays explicit: the engine shows what supports the result and where certainty ends." : "The private beta stays closed when the engine cannot safely deliver a supported result."}</p>
      </header>
      <div className="rm-home-trust-list">
        <article><span>01</span><div><h3>Several matches, not one clip.</h3><p>A habit must return across comparable moments before it becomes coaching.</p></div></article>
        <article><span>02</span><div><h3>Context changes the verdict.</h3><p>Pressure, possession, teammate coverage and what happened next all matter.</p></div></article>
        <article><span>03</span><div><h3>The evidence stays attached.</h3><p>The result points back to concrete replay moments, including counterexamples.</p></div></article>
        <article><span>04</span><div><h3>No signal means no forced answer.</h3><p>If the proof is too weak, Replay Method says so—and your free analysis remains available.</p></div></article>
      </div>
    </div>
  </section>;
}

export default function Landing({ game = "general", earlyAccessOpen = false }: { game?: GameKey; engineOpen?: boolean; calibrationOpen?: boolean; earlyAccessOpen?: boolean }) {
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
      <span className="reveal-kicker">Rocket League replay analysis</span>
      <h1 id="home-title">Stop guessing.<br />See the decision holding you back.</h1>
      <p>Upload ten ranked replays. Replay Method finds the pattern that keeps returning and gives you one clear focus for your next session.</p>
      <div className="rm-home-hero-actions">
        <Link href="/analyze" onClick={() => trackProductEvent("analysis_start","rocket-league","home_hero")}>Start free analysis <span aria-hidden="true">→</span></Link>
        <a href="#product">See a simple example</a>
      </div>
      <small>Private report · No card · Original PC replays</small>
    </section>

    <HowItWorks />
    <ProductMoment earlyAccessOpen={earlyAccessOpen} />
    <WhyTrustIt earlyAccessOpen={earlyAccessOpen} />

    <section className="rm-home-final reveal-shell" id="pricing" aria-labelledby="final-title"><span className="reveal-kicker">Ready when you are</span><h2 id="final-title">Ten replays.<br />One thing to improve.</h2><p>Start with the last ten ranked matches from the same playlist.</p><Link href="/analyze" onClick={() => trackProductEvent("analysis_start","rocket-league","home_final")}>Start free analysis <span aria-hidden="true">→</span></Link><small>Free · Private · No card</small></section>

    <CustomerFooter />
  </main>;
}
