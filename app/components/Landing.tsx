"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type TouchEvent } from "react";
import Link from "next/link";
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

const loopStages = [
  { key: "setup", label: "01 · The setup", title: "Your teammate attacks the corner.", body: "You still have space to protect the next ball." },
  { key: "mistake", label: "02 · The mistake", title: "Both of you committed.", body: "You followed too close and entered the same space." },
  { key: "consequence", label: "03 · The consequence", title: "Nobody covered the next ball.", body: "The opponent can now play through the space behind you." },
  { key: "rewind", label: "04 · Rewind", title: "Run the same moment again.", body: "This time, your teammate attacks while you read the next play." },
  { key: "decision", label: "05 · The better decision", title: "Stay one layer back.", body: "Keep enough distance to react to the clear." },
  { key: "result", label: "06 · The result", title: "Keep the play alive.", body: "You reach the next ball and your team stays in control." },
] as const;

function ProductMoment({ earlyAccessOpen }: { earlyAccessOpen: boolean }) {
  const [activeStage, setActiveStage] = useState(0);
  const [playback, setPlayback] = useState<"idle" | "playing" | "paused" | "complete">("idle");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [variant, setVariant] = useState<"tactical" | "focus">("tactical");
  const [reviewControls, setReviewControls] = useState(false);
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
    }, 2600);
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

  return <section className="reveal-section" id="product">
    <div className="reveal-shell">
      <header className="reveal-section-intro"><span className="reveal-kicker">16-second replay example</span><h2>You both go. No one covers.</h2><p>See why following the same ball leaves the next play open — and what to do instead.</p></header>
      {reviewControls && <div className="reveal-review-controls" aria-label="Local demo review controls"><span>Local review</span><button type="button" aria-pressed={variant === "tactical"} onClick={() => setVariant("tactical")}>A · Tactical board</button><button type="button" aria-pressed={variant === "focus"} onClick={() => setVariant("focus")}>B · Focus mode</button></div>}
      <div ref={demoRef} className={`reveal-demo reveal-card reveal-variant-${variant}`} data-playback={playback} aria-label={`Illustrative Replay Method product loop, ${variant === "tactical" ? "tactical board" : "focus mode"} variant`} onTouchStart={beginSwipe} onTouchEnd={endSwipe}>
        <div className="reveal-field-wrap">
          <div className={`reveal-field stage-${stage.key}`} role="img" aria-label="Illustrative flat top-down 2v2 scenario. Your blue car is identified by a warm yellow position marker; the other blue car is your teammate."><i className="reveal-goal reveal-goal-left" /><i className="reveal-goal reveal-goal-right" /><i className="reveal-zone" /><i className="reveal-path" /><i className="reveal-ball" /><i className="reveal-car car-you" /><i className="reveal-car car-mate" /><i className="reveal-car car-opp" /><i className="reveal-car car-opp-two" /></div>
        </div>
        <div className="reveal-demo-copy reveal-card" id="loop-stage-panel" role="tabpanel" aria-live={playback === "playing" ? "off" : "polite"} aria-labelledby={`loop-stage-${activeStage}`}>
          <div><div className="reveal-demo-meta"><span className="reveal-step-index">{stage.label}</span><div className="reveal-demo-controls" aria-label="Example playback control">{playback === "playing" ? <button type="button" onClick={() => setPlayback("paused")}>Pause</button> : playback === "complete" ? <button type="button" onClick={play}>Replay</button> : <button type="button" onClick={play}>Play demo</button>}</div></div><h3>{stage.title}</h3><p>{stage.body}</p><div className="reveal-before-after"><div><small>The mistake</small><b>Follow the same ball</b></div><div><small>Better decision</small><b>Protect the next ball</b></div></div></div>
          <div className="reveal-timeline" role="tablist" aria-label="Demo steps">{loopStages.map((item,index)=><button id={`loop-stage-${index}`} type="button" role="tab" aria-label={`${String(index+1).padStart(2,"0")} ${item.label.replace(/^\d+ · /, "")}`} aria-selected={activeStage===index} aria-controls="loop-stage-panel" tabIndex={activeStage===index?0:-1} onClick={()=>chooseStage(index)} onKeyDown={event=>handleStageKey(event,index)} key={item.key}>{String(index+1).padStart(2,"0")}</button>)}</div>
        </div>
      </div>
      <p className="reveal-demo-truth"><b>Illustrative example, not your analysis.</b> {earlyAccessOpen ? "Your real review only uses moments verified across your own ten replays." : "Your real review opens only while every match can be verified safely."}</p>
    </div>
  </section>;
}

const infoPanels = {
  free: ["Included free", "See what keeps holding you back.", "Replay Method analyzes all ten matches together, ignores one-off chaos, and finds the mistake that actually repeats.", ["10 matches together", "Your repeated mistake", "What to try next"]],
  premium: ["Planned for Premium", "See whether you are actually fixing it.", "Premium will later follow one priority across four weeks and show whether the habit improved, slipped back, or stayed unclear.", ["One monthly focus", "Up to 35 each week", "Progress you can see"]],
  honest: ["An honest result", "No clear pattern means no made-up advice.", "If the ten matches do not support one repeated mistake, you get the verified facts and keep your free analysis for another set.", ["Files still checked", "No invented coaching", "Free analysis remains"]],
  privacy: ["Private by default", "Your replays stay yours.", "Your files and report stay tied to your private access. Duplicates are blocked, replacements keep your progress, and reports are private by default.", ["Private report", "Safe resume", "Duplicate protection"]],
  faq: ["Quick answer", "What needs to match?", "Use ten replays from the same player and playlist. If one file is wrong, replace only that file — you do not start over.", ["Same player", "Same playlist", "Replace one file"]],
  advanced: ["How it works", "The complexity stays under the surface.", "Evidence thresholds, exclusions, detector details, and experiment labels remain available when someone chooses to inspect the advanced view.", ["Evidence rules", "Version details", "Processing notes"]],
} as const;

function RevealInfo() {
  const [active, setActive] = useState<keyof typeof infoPanels>("free");
  const panel = infoPanels[active];
  const labels: Array<[keyof typeof infoPanels,string]> = [["free","What you get"],["premium","Keep improving"],["honest","When it is unclear"],["privacy","Your files"],["faq","Quick answers"],["advanced","How it works"]];
  return <section className="reveal-section reveal-info-section"><div className="reveal-shell"><header className="reveal-section-intro"><span className="reveal-kicker">What Replay Method Does</span><h2>One bad game is noise. A repeated mistake is the clue.</h2><p>We compare all ten matches, find what keeps happening, and turn it into one clear thing to try next.</p></header><div className="reveal-info"><div className="reveal-info-nav" aria-label="Product information">{labels.map(([key,label])=><button type="button" aria-pressed={active===key} onClick={()=>setActive(key)} key={key}>{label}<span>→</span></button>)}</div><article className="reveal-info-panel reveal-card" aria-live="polite"><span className="reveal-kicker">{panel[0]}</span><h3>{panel[1]}</h3><p>{panel[2]}</p><div>{panel[3].map(point=><span key={point}>{point}</span>)}</div></article></div></div></section>;
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
    <nav className="reveal-nav reveal-shell" aria-label="Replay Method">
      <Link className="reveal-brand" href="/" aria-label="Replay Method home"><span className="reveal-logo" aria-hidden="true" /><span>Replay Method</span></Link>
      <div className="reveal-nav-links"><a href="#product">How it works</a><a href="#product">Example</a><a href="#pricing">Free vs Premium</a></div>
      <span className="reveal-nav-note">Private by default</span>
    </nav>

    <section className="reveal-hero reveal-shell">
      <div className="reveal-hero-copy">
        <span className="reveal-kicker">Hardstuck in Rocket League?</span>
        <h1>Replay Method finds the mistake <em>you keep repeating.</em></h1>
        <p>Upload ten ranked replays. We compare them together, spot what keeps going wrong, and show you what to try next.</p>
      </div>
      <section className="reveal-report-card reveal-report-empty reveal-card" id="ten-replay-start" tabIndex={-1} aria-label="Start a new ten-replay analysis">
        <header>
          <div><small>Your replay set</small><strong>Start your private analysis</strong></div>
          <span>0/10</span>
        </header>
        <div className="reveal-report-summary"><i aria-hidden="true">↑</i><b>Choose your 10 ranked replays</b><p>Your report begins after ten valid matches have been verified</p></div>
        <div className="reveal-report-row"><i aria-hidden="true">01</i><span>Replays selected</span><small>0 of 10</small></div>
        <div className="reveal-report-row"><i aria-hidden="true">02</i><span>Private report</span><small>Not started</small></div>
        <div className="reveal-report-progress" aria-hidden="true"><i /></div>
        <p>Same player · Same playlist · Duplicates blocked automatically<br />Your files stay private, and this verified set can be resumed later.</p>
        <Link className="reveal-primary" href="/analyze" onClick={() => trackProductEvent("analysis_start", "rocket-league", "home_ten_replay_start")}>Choose my 10 replays <span>→</span></Link>
      </section>
    </section>

    <ProductMoment earlyAccessOpen={earlyAccessOpen} />
    <RevealInfo />

    <section className="reveal-section" id="pricing"><div className="reveal-shell reveal-premium reveal-card"><div><span className="reveal-kicker">Future value</span><h2>Free finds the pattern. Premium tracks the climb.</h2><p>Ten replays reveal what keeps repeating. Premium will later compare up to 35 each week to show whether it is actually changing.</p><span className="reveal-coming">Planned for Premium</span></div><div className="reveal-climb" role="img" aria-label="Illustrative future Premium journey from baseline through focus and recheck to a next move"><svg viewBox="0 0 520 150" aria-hidden="true"><defs><linearGradient id="revealClimbGradient" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#8753ff"/><stop offset="1" stopColor="#18cde3"/></linearGradient></defs><path className="track" d="M24 116 C110 116 126 78 188 82 S287 104 334 70 S420 42 496 34"/><path className="line" d="M24 116 C110 116 126 78 188 82 S287 104 334 70 S420 42 496 34"/><circle cx="24" cy="116" r="6"/><circle cx="188" cy="82" r="6"/><circle cx="334" cy="70" r="6"/><circle cx="496" cy="34" r="6"/></svg><div className="reveal-climb-labels"><div><small>01</small><b>Baseline</b></div><div><small>02</small><b>Focus</b></div><div><small>03</small><b>Recheck</b></div><div><small>04</small><b>Next move</b></div></div><small>Illustrative tracking flow · improvement is measured, never promised</small></div></div></section>

    <section className="reveal-section reveal-trust" aria-labelledby="trust-title"><div className="reveal-shell"><span className="reveal-kicker">{earlyAccessOpen ? "Early access · Clear answers" : "Private beta · Clear answers"}</span><h2 id="trust-title">Useful when the pattern is clear. Honest when it is not.</h2><div><article><i>01</i><b>Your ten matches</b><p>Every accepted replay stays visible and contributes to one combined review.</p></article><article><i>02</i><b>Your next move</b><p>You get one focus only when the same supported pattern appears across matches.</p></article><article><i>03</i><b>If the pattern is weak</b><p>You still see what was analyzed, the neutral facts, and what to do next. No invented coaching.</p></article></div></div></section>

    <section className="reveal-section reveal-faq" aria-labelledby="faq-title"><div className="reveal-shell"><header><span className="reveal-kicker">Before you upload</span><h2 id="faq-title">Straight answers.</h2></header><details><summary>Where is my Rocket League replay?<b>+</b></summary><p>On Windows: Documents → My Games → Rocket League → TAGame → Demos. Choose the original file ending in .replay.</p></details><details><summary>Will I get an analysis now?<b>+</b></summary><p>{engineOpen ? "Yes, after ten valid replays. Each file is verified for the same player and ranked playlist. The report is released only at 10/10." : "Not while the deterministic replay engine is unavailable. No files are accepted into a dead end."}</p></details><details><summary>What if one file is invalid?<b>+</b></summary><p>It is excluded with a concrete reason and does not consume a valid slot. Add a replacement until the batch reaches exactly ten verified matches.</p></details><details><summary>What happens to the files?<b>+</b></summary><p>They are stored privately to deliver the requested report. Customer replays are excluded from calibration, training and evaluation unless you separately opt in.</p></details><details><summary>Why might Replay Method abstain?<b>+</b></summary><p>If no supported pattern repeats across the ten matches, the report shows the verified facts and explains why it cannot name a habit yet.</p></details></div></section>

    <section className="reveal-final reveal-shell"><h2>You may not see the pattern. Replay Method can.</h2><Link className="reveal-primary" href="/analyze" onClick={() => trackProductEvent("analysis_start","rocket-league","home_final")}>Analyze my 10 replays <span>→</span></Link></section>

    <footer className="reveal-footer reveal-shell"><span>Replay Method</span><Link href="/privacy">Privacy</Link><Link href="/beta-terms">Beta terms</Link><a href="mailto:contact@replaymethod.xyz">Contact</a><span>Evidence boundaries</span></footer>
  </main>;
}
