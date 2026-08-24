"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type TouchEvent } from "react";
import Link from "next/link";
import ReplayContribution from "../rocket-league-beta/ReplayContribution";
import QuickReplayStart from "./QuickReplayStart";
import PricingLadder from "./PricingLadder";
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
    <article><i>01</i><div><b>Drop one replay</b><span>Your original PC match file.</span></div></article>
    <article><i>02</i><div><b>See the decision that mattered</b><span>Verified moments before advice.</span></div></article>
    <article><i>03</i><div><b>Take one rule into your next 3</b><span>Then let the next replay check it.</span></div></article>
  </section>;
}

function focusReplayUploader(source: string) {
  const uploader = document.getElementById("replay-upload");
  if (!uploader) return;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  uploader.focus({ preventScroll: true });
  uploader.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
  trackProductEvent("cta_click", "rocket-league", source);
}

function HeroProof() {
  return <details className="marcel-hero-proof">
    <summary><span>10-SECOND EXAMPLE</span><b>See how one decision becomes one rule</b><i>+</i></summary>
    <div>
      <span><i>01</i><b>Decision</b><small>You follow your teammate into the same lane.</small></span>
      <span><i>02</i><b>Consequence</b><small>The safe layer disappears before possession is clear.</small></span>
      <span><i>03</i><b>One rule</b><small>If your teammate crosses the ball line, hold one layer deeper.</small></span>
    </div>
    <p>Illustration—not a live analysis.</p>
  </details>;
}

const loopStages = [
  { key: "match", label: "MATCH", title: "Your teammate crosses the ball line.", body: "2v2 · 2:41 left. The replay fixes the moment in time before any advice appears." },
  { key: "decision", label: "DECISION", title: "You enter the same channel.", body: "Both cars commit to one lane, leaving no safe layer behind the play." },
  { key: "rule", label: "RULE", title: "Hold one layer deeper.", body: "If your teammate crosses the ball line, protect the safe layer until possession is clear." },
  { key: "check", label: "CHECK AGAIN", title: "Measure the next three matches.", body: "The next replay checks whether the same overlap appears in a comparable game state." },
] as const;

function ProductMoment({ earlyAccessOpen }: { earlyAccessOpen: boolean }) {
  const [activeStage, setActiveStage] = useState(0);
  const touchStart = useRef<number | null>(null);
  const stage = loopStages[activeStage];

  function chooseStage(index: number) {
    setActiveStage((index + loopStages.length) % loopStages.length);
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
      <span>THE IMPROVEMENT LOOP</span>
      <h2>One match.<br />One decision. One test.</h2>
      <p>Move through the same four steps your report follows: what happened, the decision that mattered, one rule to try, and what the next replay should check.</p>
      <div className="marcel-truth"><i>✓</i><span><b>Truth before hype</b>{earlyAccessOpen ? "Experimental Early Access coaching is clearly marked while formal detector validation continues independently." : "Coaching stays off until the current release gate opens."}</span></div>
    </div>
    <div className={`marcel-demo stage-${stage.key}`} aria-label="Illustrative Replay Method product loop" onTouchStart={beginSwipe} onTouchEnd={endSwipe}>
      <header><span>ILLUSTRATIVE FLOW</span><em>NOT A LIVE FINDING</em></header>
      <div className="marcel-demo-stages" role="tablist" aria-label="Improvement loop stages">
        {loopStages.map((item, index) => <button id={`loop-stage-${index}`} type="button" role="tab" aria-selected={activeStage === index} aria-controls="loop-stage-panel" tabIndex={activeStage === index ? 0 : -1} onClick={() => chooseStage(index)} onKeyDown={event => handleStageKey(event, index)} key={item.key}>{item.label}</button>)}
      </div>
      <div className="marcel-demo-screen" id="loop-stage-panel" role="tabpanel" aria-live="polite" aria-labelledby={`loop-stage-${activeStage}`}>
        <div className="marcel-demo-meta"><span>{stage.label}</span><b>{activeStage < 2 ? "VERIFIED MOMENT" : activeStage === 2 ? "ONE FOCUS" : "NEXT TEST"}</b></div>
        <div className="marcel-field" aria-hidden="true"><i className="scan-line" /><i className="ball" /><i className="car one" /><i className="car two" /><i className="path" /><i className="evidence-pin">01</i></div>
        <p><b>{stage.title}</b>{stage.body}</p>
      </div>
      <div className="marcel-demo-progress" aria-hidden="true"><i style={{ width: `${((activeStage + 1) / loopStages.length) * 100}%` }} /></div>
      <button type="button" onClick={() => focusReplayUploader("product_loop_to_uploader")}>RUN THIS ON MY REPLAY <span>→</span></button>
    </div>
  </section>;
}

export default function Landing({ game = "general", checkoutOpen = false, engineOpen = false, calibrationOpen = false, earlyAccessOpen = false }: { game?: GameKey; checkoutOpen?: boolean; engineOpen?: boolean; calibrationOpen?: boolean; earlyAccessOpen?: boolean }) {
  useEffect(() => {
    const key = `replaymethod-view-${location.pathname}`;
    if (!sentViews.has(key)) {
      sentViews.add(key);
      trackProductEvent("page_view", game === "general" ? "rocket-league" : game, "marcel_landing");
    }
  }, [game]);

  if (game === "league" || game === "valorant") return <FutureGame game={game} />;

  return <main className="marcel-home">
    <nav className="marcel-nav shell">
      <Link className="brand" href="/" aria-label="Replay Method home"><span className="logo" aria-hidden="true" /><span>replay<span>method</span></span></Link>
      <div><a href="#product">How it helps</a><Link href="/reports">My progress</Link></div>
    </nav>

    <section className="marcel-hero shell">
      <div className="marcel-hero-copy">
        <span className="marcel-status"><i /> ROCKET LEAGUE · {engineOpen && earlyAccessOpen ? "EARLY ACCESS BETA" : engineOpen ? "PC REPLAY BETA" : "PRIVATE BETA"}</span>
        <h1>Stop grinding blind.<br /><em>Find the decision costing you games.</em></h1>
        <p>{engineOpen && earlyAccessOpen ? "Upload one original PC replay, choose yourself, and get one evidence-backed focus to test in your next three matches." : engineOpen ? "Upload one original PC replay, choose yourself, and see the decision the evidence can actually support." : "Upload one original PC replay so real match evidence can replace generic advice."}</p>
        <div className="marcel-trust-row"><span>First report included · Private · No card</span></div>
        <HeroProof />
      </div>
      <div className="marcel-upload-stage">
        {engineOpen ? <QuickReplayStart placement="marcel_hero" /> : <ReplayContribution intakeOpen={calibrationOpen} compact />}
      </div>
    </section>

    <MethodStrip />
    <ProductMoment earlyAccessOpen={earlyAccessOpen} />
    {checkoutOpen && <PricingLadder analysisHref="#replay-upload" game="rocket-league" checkoutOpen replayReady />}

    <section className="marcel-beta-truth shell" aria-labelledby="trust-title">
      <span>{earlyAccessOpen ? "EARLY ACCESS · CLEAR BOUNDARIES" : "PRIVATE BETA · CLEAR BOUNDARIES"}</span>
      <h2 id="trust-title">What your replay gets—and what we never pretend to know.</h2>
      <div className="marcel-promises">
        <article><i>01</i><b>What happened</b><p>Verified facts and timestamps read from the original replay.</p></article>
        <article><i>02</i><b>What to try next</b><p>Experimental coaching appears only when this match provides enough evidence.</p></article>
        <article><i>03</i><b>When evidence is weak</b><p>Replay Method says so and withholds the coaching instead of guessing.</p></article>
      </div>
    </section>

    <section className="marcel-faq shell" aria-labelledby="faq-title">
      <header><span>BEFORE YOU UPLOAD</span><h2 id="faq-title">Straight answers.</h2></header>
      <details><summary>Where is my Rocket League replay?<b>+</b></summary><p>On Windows: Documents → My Games → Rocket League → TAGame → Demos. Choose the original file ending in .replay.</p></details>
      <details><summary>Will I get an analysis now?<b>+</b></summary><p>{engineOpen && earlyAccessOpen ? "Yes. You receive a complete private report with verified match facts. A coaching insight appears only if it clears the conservative Early Access evidence policy; otherwise that part abstains locally and explains why." : engineOpen ? "The live engine parses the replay, identifies its playlist and lets you choose your player. You receive a real report only when a detector has passed its exact evidence gate; otherwise you receive an honest evidence-status result." : "Not yet. Intake is for the private validation corpus. You receive a secure reference immediately; public coaching remains off until the evidence gate passes."}</p></details>
      <details><summary>What happens to the file?<b>+</b></summary><p>It is stored privately to deliver your requested report. Customer analysis replays are not used for detector calibration, training or evaluation without a separate explicit opt-in.</p></details>
      <details><summary>What does “experimental coaching” mean?<b>+</b></summary><p>The replay facts are parser-backed, while the coaching interpretation is still being independently validated. It is clearly labelled and never presented as a stable habit from one match.</p></details>
      <details><summary>Why might Replay Method abstain?<b>+</b></summary><p>If the file parses but the available moments cannot support a defensible recommendation, you still receive the verified match review and an honest explanation instead of generic advice.</p></details>
      <button className="marcel-faq-cta" type="button" onClick={() => focusReplayUploader("trust_faq_to_uploader")}>ANALYZE MY REPLAY <span>↑</span></button>
    </section>

    <footer className="marcel-footer shell">
      <div className="brand"><span className="logo" aria-hidden="true" /><span>replay<span>method</span></span></div>
      <p>Rocket League first. <Link href="/league">League</Link> and <Link href="/valorant">VALORANT</Link> later.</p>
      <div><Link href="/privacy">Privacy</Link><Link href="/beta-terms">Beta terms</Link><a href="mailto:contact@replaymethod.xyz">Contact</a></div>
      <small>Independent service. Not affiliated with or endorsed by Psyonix or Epic Games.</small>
    </footer>
  </main>;
}
