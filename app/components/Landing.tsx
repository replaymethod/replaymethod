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

const sampleReports = [
  {
    key: "boost",
    nav: "Boost before ball",
    aria: "Boost mistake: leave the net for boost",
    timestamp: "03:42.18",
    title: "You leave net for boost.",
    summary: "They are still attacking when you turn away.",
    rule: "Hold net. Boost after.",
    practice: "Stay goal-side until your team has the ball clear.",
    matches: [1, 3, 6, 8],
    moments: {
      decision: { label: "Decision", time: "03:42.18", copy: "You turn for corner boost before a teammate has net covered." },
    },
  },
  {
    key: "double",
    nav: "Double commit",
    aria: "Double commit mistake: both teammates go for the same ball",
    timestamp: "01:17.64",
    title: "You double commit.",
    summary: "You and your teammate go for the same ball.",
    rule: "Let them go. Stay behind.",
    practice: "If your teammate challenges, cover the loose ball.",
    matches: [2, 5, 9],
    moments: {
      decision: { label: "Decision", time: "01:17.64", copy: "Your teammate is already up, but you jump for the same ball." },
    },
  },
  {
    key: "last",
    nav: "Chase",
    aria: "Last man mistake: dive into a challenge too early",
    timestamp: "04:06.31",
    title: "You dive as last man.",
    summary: "If you miss, nobody is behind you.",
    rule: "Fake challenge. Buy time.",
    practice: "Shadow until a teammate gets back.",
    matches: [0, 2, 4, 7, 9],
    moments: {
      decision: { label: "Decision", time: "04:06.31", copy: "You full commit while both teammates are still recovering." },
    },
  },
  {
    key: "clear",
    nav: "Shitty clears",
    aria: "Clear mistake: hit the ball back through the middle",
    timestamp: "02:28.90",
    title: "You clear straight to them.",
    summary: "Your touch through mid gives them another attack.",
    rule: "Clear wide, not mid.",
    practice: "Use the side wall when the middle is covered.",
    matches: [1, 4, 5, 8],
    moments: {
      decision: { label: "Decision", time: "02:28.90", copy: "You have space wide but clear the ball back through mid." },
    },
  },
  {
    key: "rotation",
    nav: "Cutting",
    aria: "Rotation mistake: cut in front of a teammate",
    timestamp: "03:09.47",
    title: "You cut your teammate.",
    summary: "You both end up in the same lane.",
    rule: "Leave. Rotate behind them.",
    practice: "If they have the better angle, rotate back post.",
    matches: [0, 6, 9],
    moments: {
      decision: { label: "Decision", time: "03:09.47", copy: "Your teammate has the better angle, but you cut in front." },
    },
  },
] as const;

function ProductMoment({ earlyAccessOpen }: { earlyAccessOpen: boolean }) {
  const [activeExample, setActiveExample] = useState(0);
  const touchStart = useRef<number | null>(null);
  const example = sampleReports[activeExample];

  function chooseExample(index: number) {
    setActiveExample((index + sampleReports.length) % sampleReports.length);
  }

  function handleExampleKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const keys: Record<string, number> = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: sampleReports.length - 1 };
    if (!(event.key in keys)) return;
    event.preventDefault();
    const next = (keys[event.key] + sampleReports.length) % sampleReports.length;
    chooseExample(next);
    document.getElementById(`product-example-${next}`)?.focus();
  }

  function beginSwipe(event: TouchEvent<HTMLElement>) {
    touchStart.current = event.changedTouches[0]?.clientX ?? null;
  }

  function endSwipe(event: TouchEvent<HTMLElement>) {
    if (touchStart.current == null) return;
    const distance = (event.changedTouches[0]?.clientX ?? touchStart.current) - touchStart.current;
    touchStart.current = null;
    if (Math.abs(distance) < 45) return;
    chooseExample(activeExample + (distance < 0 ? 1 : -1));
  }

  return <section className="rm-engine-section" id="product">
    <div className="reveal-shell">
      <header className="rm-engine-intro"><span className="reveal-kicker">Try the product demo</span><h2>Pick a mistake.<br />See the report.</h2><p>Tap a common Rocket League mistake below. The demo shows what Replay Method would point out and what to do next.</p></header>
      <div className="rm-product-demo rm-simple-demo" data-example={example.key} onTouchStart={beginSwipe} onTouchEnd={endSwipe}>
        <header className="rm-product-demo-bar">
          <span><i />Interactive product demo</span>
          <small>Example report · no upload needed</small>
        </header>

        <nav className="rm-product-demo-nav" aria-label="Common replay pattern examples">
          <div role="tablist" aria-label="Replay pattern examples">
            {sampleReports.map((item, index) => <button id={`product-example-${index}`} type="button" role="tab" aria-label={item.aria} aria-selected={activeExample === index} aria-controls="product-example-panel" tabIndex={activeExample === index ? 0 : -1} onClick={() => chooseExample(index)} onKeyDown={event => handleExampleKey(event, index)} key={item.key}><strong>{item.nav}</strong></button>)}
          </div>
        </nav>

        <div className="rm-simple-demo-grid" id="product-example-panel" role="tabpanel" aria-live="polite" aria-labelledby={`product-example-${activeExample}`}>
          <section className="rm-simple-demo-finding">
            <div className="rm-simple-demo-signal"><span>Example result</span><b>Seen in {example.matches.length} of 10</b></div>
            <h3>{example.title}</h3>
            <p>{example.summary}</p>
            <ol aria-label="Ten analyzed sample replays">{Array.from({ length: 10 }, (_, index) => <li data-match={(example.matches as readonly number[]).includes(index)} key={index}><span>{index + 1}</span></li>)}</ol>
            <article>
              <div><b>Replay {String((example.matches as readonly number[])[0] + 1).padStart(2, "0")}</b><span>{example.timestamp}</span></div>
              <p>{example.moments.decision.copy}</p>
            </article>
          </section>

          <aside className="rm-simple-demo-action">
            <span>What to do next</span>
            <h4>{example.rule}</h4>
            <p>{example.practice}</p>
            <a href="#ten-replay-start" onClick={() => trackProductEvent("analysis_start", "rocket-league", `sample_report_${example.key}`)}>Analyze my replays free <i aria-hidden="true">→</i></a>
            <small>Private report · no card</small>
          </aside>
        </div>

        <footer className="rm-product-demo-foot"><span>{earlyAccessOpen ? "Example report — your real report opens the exact replay moments." : "Example report — your real report only includes patterns supported by your own replay files."}</span></footer>
      </div>
    </div>
  </section>;
}

function HowItWorks() {
  return <section className="rm-home-how" id="method" aria-labelledby="how-title">
    <div className="reveal-shell">
      <header><span className="reveal-kicker">How it works</span><h2 id="how-title">Upload your replays.<br />Get your improvement program.</h2><p>Three simple steps.</p></header>
      <ol>
        <li><small>01</small><div><h3>Upload 10 replays.</h3><p>Use the same player and ranked mode in every file.</p></div></li>
        <li><small>02</small><div><h3>We compare your games.</h3><p>Replay Method performs longitudinal cross-match analysis to identify recurring mechanical execution errors and game-sense decision patterns.</p></div></li>
        <li><small>03</small><div><h3>Open your personal report.</h3><p>See your repeated mistakes, the exact replay moments and your structured improvement program.</p></div></li>
      </ol>
    </div>
  </section>;
}

function GoodToKnow() {
  return <section className="rm-home-trust" id="why" aria-labelledby="why-title">
    <div className="reveal-shell">
      <header>
        <span className="reveal-kicker">Good to know:</span>
        <h2 id="why-title">We identify what keeps going wrong across your replays —<br />you get a structured improvement plan designed to help you climb the ranks.</h2>
      </header>
      <div className="rm-home-trust-list">
        <article><span>01</span><div><h3>What keeps going wrong?</h3><p>Usually, it&apos;s a combination of ingrained habits that creates tunnel vision and makes you overlook the fundamentals.</p></div></article>
        <article><span>02</span><div><h3>How do I fix them?</h3><p>Get a structured improvement program for every repeated mistake we find—including what to change, what to practice and how to apply each fix in your next games.</p></div></article>
        <article><span>03</span><div><h3>How do I know it&apos;s not bs?</h3><p>Open the exact matches and timestamps, then compare them with the analysis yourself.</p></div></article>
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
      <span className="reveal-kicker">Rocket League replay analysis</span>
      <h1 id="home-title">Turn repeated mistakes into<br />focused improvement.</h1>
      <p>Upload 10 ranked replays. See what keeps going wrong and what to do differently next game.</p>
      <div className="rm-home-hero-actions">
        <a href="#ten-replay-start" onClick={() => trackProductEvent("analysis_start","rocket-league","home_hero")}>Analyze 10 replays for free <span aria-hidden="true">↓</span></a>
        <a href="#product">View the stripped-down product demo</a>
      </div>
      <small>Free first analysis, report stays private.</small>
    </section>

    <section className="rm-home-activation reveal-shell" aria-label="Start a free ten-replay analysis">
      <BatchAnalyzeFlow engineOpen={engineOpen} variant="hero" />
    </section>

    <ProductMoment earlyAccessOpen={earlyAccessOpen} />
    <HowItWorks />
    <GoodToKnow />

    <section className="rm-home-final reveal-shell" id="pricing" aria-labelledby="final-title">
      <div className="rm-home-final-copy"><h2 id="final-title">Curious?</h2><p>Upload your 10 most recent replays from the same ranked mode and begin your climb.</p></div>
      <div className="rm-home-final-action"><a href="#ten-replay-start" onClick={() => trackProductEvent("analysis_start","rocket-league","home_final")}>Analyze 10 replays for free <span aria-hidden="true">↑</span></a></div>
    </section>

    <CustomerFooter />
  </main>;
}
