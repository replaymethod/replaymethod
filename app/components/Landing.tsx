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

type SampleMoment = "setup" | "decision" | "outcome";

const sampleReports = [
  {
    key: "boost",
    nav: "Boost",
    timestamp: "03:42.18",
    title: "You leave the net for boost.",
    summary: "Pressure is still live when you turn away from the defensive layer.",
    evidence: "4 similar moments in this sample",
    rule: "Protect the net first.",
    matches: [1, 3, 6, 8],
    clip: null as string | null,
    moments: {
      setup: { label: "Setup", time: "−2.0s", copy: "Corner boost opens while pressure builds." },
      decision: { label: "Decision", time: "03:42.18", copy: "You turn away before the net is protected." },
      outcome: { label: "Outcome", time: "+1.4s", copy: "The next touch reaches an open layer." },
    },
  },
  {
    key: "double",
    nav: "Double commit",
    timestamp: "01:17.64",
    title: "You follow the same ball.",
    summary: "Both players attack one touch and leave the next layer empty.",
    evidence: "3 similar moments in this sample",
    rule: "Hold the second layer.",
    matches: [2, 5, 9],
    clip: null as string | null,
    moments: {
      setup: { label: "Setup", time: "−1.8s", copy: "Your teammate is already moving into the challenge." },
      decision: { label: "Decision", time: "01:17.64", copy: "You accelerate into the same touch." },
      outcome: { label: "Outcome", time: "+1.1s", copy: "The loose ball has no second player behind it." },
    },
  },
  {
    key: "last",
    nav: "Last player",
    timestamp: "04:06.31",
    title: "You dive as the last player.",
    summary: "The challenge removes the only layer still protecting the counter.",
    evidence: "5 similar moments in this sample",
    rule: "Delay the play.",
    matches: [0, 2, 4, 7, 9],
    clip: null as string | null,
    moments: {
      setup: { label: "Setup", time: "−2.2s", copy: "Both teammates are recovering behind the play." },
      decision: { label: "Decision", time: "04:06.31", copy: "You commit before support has returned." },
      outcome: { label: "Outcome", time: "+1.6s", copy: "One touch sends the counter past the last defender." },
    },
  },
  {
    key: "clear",
    nav: "Clear",
    timestamp: "02:28.90",
    title: "Your clear becomes their pass.",
    summary: "A central touch gives pressure straight back instead of ending it.",
    evidence: "4 similar moments in this sample",
    rule: "Clear away from pressure.",
    matches: [1, 4, 5, 8],
    clip: null as string | null,
    moments: {
      setup: { label: "Setup", time: "−1.5s", copy: "You reach the ball with space toward the side wall." },
      decision: { label: "Decision", time: "02:28.90", copy: "The clear is played back through the middle." },
      outcome: { label: "Outcome", time: "+1.2s", copy: "The opponent receives another attack immediately." },
    },
  },
  {
    key: "rotation",
    nav: "Rotation cut",
    timestamp: "03:09.47",
    title: "You cut into your teammate's play.",
    summary: "The rotation compresses into one space and removes the useful player behind it.",
    evidence: "3 similar moments in this sample",
    rule: "Rotate behind the play.",
    matches: [0, 6, 9],
    clip: null as string | null,
    moments: {
      setup: { label: "Setup", time: "−2.0s", copy: "Your teammate has the closer, cleaner line to the ball." },
      decision: { label: "Decision", time: "03:09.47", copy: "You turn across the rotation and enter the same lane." },
      outcome: { label: "Outcome", time: "+1.3s", copy: "No player remains ready for the next touch." },
    },
  },
] as const;

function ProductMoment({ earlyAccessOpen }: { earlyAccessOpen: boolean }) {
  const [activeExample, setActiveExample] = useState(0);
  const [activeMoment, setActiveMoment] = useState<SampleMoment>("decision");
  const touchStart = useRef<number | null>(null);
  const example = sampleReports[activeExample];
  const moment = example.moments[activeMoment];

  function chooseExample(index: number) {
    setActiveExample((index + sampleReports.length) % sampleReports.length);
    setActiveMoment("decision");
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
      <header className="rm-engine-intro"><span className="reveal-kicker">Interactive sample report</span><h2>Open the moment.<br />See the decision.</h2><p>Choose a familiar mistake. The replay moment, supporting sample and one next-queue rule stay in the same view.</p></header>
      <div className="rm-product-demo" data-example={example.key} data-moment={activeMoment} onTouchStart={beginSwipe} onTouchEnd={endSwipe}>
        <header className="rm-product-demo-bar">
          <span><i />Sample analysis</span>
          <small><b>Input</b> 10 replays <i aria-hidden="true">→</i> <b>Output</b> one supported focus</small>
        </header>

        <nav className="rm-product-demo-nav" aria-label="Common replay pattern examples">
          <button className="rm-product-demo-arrow" type="button" aria-label="Previous example" onClick={() => chooseExample(activeExample - 1)}>←</button>
          <div role="tablist" aria-label="Replay pattern examples">
            {sampleReports.map((item, index) => <button id={`product-example-${index}`} type="button" role="tab" aria-label={item.nav} aria-selected={activeExample === index} aria-controls="product-example-panel" tabIndex={activeExample === index ? 0 : -1} onClick={() => chooseExample(index)} onKeyDown={event => handleExampleKey(event, index)} key={item.key}><span>{String(index + 1).padStart(2, "0")}</span>{item.nav}</button>)}
          </div>
          <button className="rm-product-demo-arrow" type="button" aria-label="Next example" onClick={() => chooseExample(activeExample + 1)}>→</button>
        </nav>

        <div className="rm-product-demo-stage">
          <figure className="rm-sample-media" aria-labelledby="sample-moment-title">
            <div className="rm-sample-frame">
              {example.clip ? <video src={example.clip} muted playsInline preload="metadata" /> : <div className="rm-sample-media-adapter" aria-hidden="true"><i /><i /><i /><span><ReplayMark /></span></div>}
              <span className="rm-sample-frame-label">Original replay · sample view</span>
              <span className="rm-sample-frame-time">{moment.time}</span>
              <div className="rm-sample-freeze"><span>{moment.label}</span><i /></div>
            </div>
            <figcaption>
              <button type="button" onClick={() => setActiveMoment("setup")} aria-label="Rewind to setup">↶ <span>Rewind 2 sec</span></button>
              <div role="tablist" aria-label="Replay moment states">
                {(Object.keys(example.moments) as SampleMoment[]).map(key => <button type="button" role="tab" aria-selected={activeMoment === key} onClick={() => setActiveMoment(key)} key={key}><span>{example.moments[key].label}</span><small>{example.moments[key].time}</small></button>)}
              </div>
            </figcaption>
          </figure>

          <aside className="rm-product-demo-output" id="product-example-panel" role="tabpanel" aria-live="polite" aria-labelledby={`product-example-${activeExample}`}>
            <span>Sample pattern {String(activeExample + 1).padStart(2, "0")} / {String(sampleReports.length).padStart(2, "0")}</span>
            <div key={example.key} className="rm-product-demo-copy"><h3 id="sample-moment-title">{example.title}</h3><p>{example.summary}</p></div>
            <div className="rm-sample-moment-copy" key={`${example.key}-${activeMoment}`}><small>{moment.label} · {moment.time}</small><p>{moment.copy}</p></div>
            <div className="rm-sample-evidence">
              <div><span>10 replays</span><ol aria-label={example.evidence}>{Array.from({ length: 10 }, (_, index) => <li data-match={(example.matches as readonly number[]).includes(index)} key={index}><span>{index + 1}</span></li>)}</ol></div>
              <i aria-hidden="true">→</i><strong><small>One focus</small>{example.rule}</strong>
            </div>
            <a href="#ten-replay-start" onClick={() => trackProductEvent("analysis_start", "rocket-league", `sample_report_${example.key}`)}>Analyze my replays <i aria-hidden="true">↗</i></a>
          </aside>
        </div>

        <footer className="rm-product-demo-foot"><span>Browse with the tabs, arrows or a horizontal swipe.</span><span>{earlyAccessOpen ? "Illustrative · real reports stay attached to their replay moments." : "Illustrative · public output opens only when the evidence holds."}</span></footer>
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
