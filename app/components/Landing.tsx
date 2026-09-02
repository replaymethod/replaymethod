"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type TouchEvent } from "react";
import Link from "next/link";
import { trackProductEvent } from "../../lib/client-analytics";
import BatchAnalyzeFlow from "../analyze/BatchAnalyzeFlow";
import { CustomerFooter, CustomerHeader } from "./CustomerChrome";
import { ReplayMark } from "./ReplayMark";

export type GameKey = "general" | "league" | "valorant" | "rocket-league";

const sentViews = new Set<string>();

function scrollToReplayUpload(event: ReactMouseEvent<HTMLAnchorElement>, source: string) {
  trackProductEvent("analysis_start", "rocket-league", source);
  const target = document.getElementById("ten-replay-start");
  if (!target) return;

  event.preventDefault();
  window.history.pushState(null, "", "#ten-replay-start");
  target.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    block: "center",
    inline: "nearest",
  });
}

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

// Fixed, constructed product examples only. They are not detector output or prevalence claims.
const sampleReports = [
  {
    key: "possession-giveaway",
    nav: "Booming the Ball Away",
    aria: "Booming the Ball Away fault example",
    title: "Booming the Ball Away",
    summary: "You hit the ball away when you had time to control it, giving the opponent the next useful touch. It turns your attack into their counterattack and removes your team’s chance to build pressure.",
    moment: "You have time and space, but hit the ball straight to the opponent.",
    rank: "Champion II",
    mode: "Ranked 2v2",
    replays: [
      { replay: 2, timestamps: ["01:14.20", "02:48.60", "04:03.10"] },
      { replay: 5, timestamps: ["00:52.40"] },
      { replay: 7, timestamps: ["01:31.80", "03:09.20"] },
      { replay: 9, timestamps: ["00:44.70", "02:16.30", "04:27.50"] },
    ],
    rule: "Keep the next useful touch.",
    practice: "If nobody is forcing you, take one controlled touch before choosing a clear, pass, or shot.",
    tease: "Unlock the exact clips, field zones, and better first-touch options.",
  },
  {
    key: "boost-over-ball",
    nav: "Boost Over Ball",
    aria: "Boost Over Ball fault example",
    title: "Boost Over Ball",
    summary: "You left a useful position to collect a large boost while the play was still active. The extra boost is rarely worth the open net, missed pass, or lost pressure it creates.",
    moment: "You leave the play for corner boost while the ball is still reachable.",
    rank: "Diamond III",
    mode: "Ranked 2v2",
    replays: [
      { replay: 1, timestamps: ["00:46.80"] },
      { replay: 3, timestamps: ["01:22.10", "03:38.40"] },
      { replay: 5, timestamps: ["02:11.70"] },
      { replay: 8, timestamps: ["00:58.30", "04:06.20"] },
      { replay: 10, timestamps: ["02:49.50"] },
    ],
    rule: "Stay connected to the play.",
    practice: "Use small-pad routes unless the corner boost is clearly safe.",
    tease: "Unlock the moments where boost pulled you out of the play and the safer route available.",
  },
  {
    key: "ball-side-rotation",
    nav: "Ball-Side Rotation",
    aria: "Ball-Side Rotation fault example",
    title: "Ball-Side Rotation",
    summary: "You rotated back through the same lane as the ball, blocking your view and your teammate’s approach. It compresses spacing and makes double commits, awkward challenges, and teammate cut-offs more likely.",
    moment: "You recover through the ball lane and block your teammate’s approach.",
    rank: "Champion I",
    mode: "Ranked 3v3",
    replays: [
      { replay: 2, timestamps: ["01:08.50", "03:54.20"] },
      { replay: 4, timestamps: ["02:37.80"] },
      { replay: 6, timestamps: ["00:41.60", "04:12.90"] },
      { replay: 9, timestamps: ["02:05.40"] },
    ],
    rule: "Recover through the far side.",
    practice: "When possible, take the far-side route so you can see the play and leave a clean lane.",
    tease: "Unlock the rotation paths that opened the gap and the clips where your teammate was ready.",
  },
  {
    key: "defensive-corner-dive",
    nav: "Defensive Corner Dive",
    aria: "Defensive Corner Dive fault example",
    title: "Defensive Corner Dive",
    summary: "You committed deep into your own corner before the ball was an immediate threat to the net. A miss or bad bounce removes you from the play and leaves the next defender isolated.",
    moment: "You dive into your own corner with no immediate threat on net.",
    rank: "Diamond II",
    mode: "Ranked 3v3",
    replays: [
      { replay: 3, timestamps: ["00:56.70", "03:21.40"] },
      { replay: 7, timestamps: ["02:44.10"] },
      { replay: 10, timestamps: ["01:17.80", "04:08.30"] },
    ],
    rule: "Delay the corner dive.",
    practice: "Unless you are first man with cover, shadow, fake, or protect the dangerous exit instead.",
    tease: "Unlock the exact corner commits and whether force, fake, or rotate-out was the better choice.",
  },
  {
    key: "low-percentage-mechanics",
    nav: "Low-Percentage Mechanics",
    aria: "Low-Percentage Mechanics fault example",
    title: "Low-Percentage Mechanics",
    summary: "You chose a difficult mechanic when a simpler play offered a safer result. A failed attempt often leaves you behind the play with low boost and a slow recovery.",
    moment: "You attempt a difficult mechanic with a safe pass and recovery available.",
    rank: "Champion III",
    mode: "Ranked 2v2",
    replays: [
      { replay: 2, timestamps: ["02:24.60"] },
      { replay: 5, timestamps: ["01:02.30", "04:31.70"] },
      { replay: 8, timestamps: ["03:16.20"] },
    ],
    rule: "Choose the simpler play.",
    practice: "Choose the simplest action that keeps possession or creates a useful shot, pass, or 50.",
    tease: "Unlock which mechanic attempts were worth the risk and which exposed your team.",
  },
  {
    key: "ignoring-back-post",
    nav: "Ignoring Back Post",
    aria: "Ignoring Back Post fault example",
    title: "Ignoring Back Post",
    summary: "You entered the goal from the near side or stopped in the middle, reducing your view and save angle. You are more likely to face the play sideways or backward and leave part of the net difficult to cover.",
    moment: "You enter from the near side and face the shot sideways.",
    rank: "Platinum III",
    mode: "Ranked 3v3",
    replays: [
      { replay: 1, timestamps: ["00:38.90", "03:47.20"] },
      { replay: 3, timestamps: ["02:13.60"] },
      { replay: 5, timestamps: ["01:29.40", "04:19.80"] },
      { replay: 7, timestamps: ["02:52.10"] },
      { replay: 9, timestamps: ["00:57.30", "03:34.50"] },
    ],
    rule: "Enter through back post.",
    practice: "When the play allows it, enter through the back post and make the save while driving forward.",
    tease: "Unlock the goal-entry clips and the defensive route that gave you the best coverage.",
  },
  {
    key: "jumping-for-everything",
    nav: "Jumping for Everything",
    aria: "Jumping for Everything fault example",
    title: "Jumping for Everything",
    summary: "You left the ground for a ball you were unlikely to reach first or touch with purpose. Once airborne, you lose the ability to brake, turn, or react while the play changes underneath you.",
    moment: "You jump after the opponent already has the faster read.",
    rank: "Gold III",
    mode: "Ranked 3v3",
    replays: [
      { replay: 1, timestamps: ["00:49.20", "03:18.60"] },
      { replay: 2, timestamps: ["02:07.40"] },
      { replay: 4, timestamps: ["01:11.80", "04:02.30"] },
      { replay: 6, timestamps: ["02:39.50"] },
      { replay: 8, timestamps: ["00:54.70", "03:26.10"] },
      { replay: 10, timestamps: ["01:46.90", "04:22.40"] },
    ],
    rule: "Check before you jump.",
    practice: "Check who arrives first, where your touch can go, and who covers behind you.",
    tease: "Unlock which aerials were realistically playable and which should have been left.",
  },
  {
    key: "cutting-your-teammate",
    nav: "Cutting Your Teammate",
    aria: "Cutting Your Teammate fault example",
    title: "Cutting Your Teammate",
    summary: "You entered a play your teammate was already positioned to control, interrupting their momentum or possession. It creates double commits, removes passing options, and often gives the ball away immediately.",
    moment: "You cut into a lane your teammate is already controlling.",
    rank: "Champion II",
    mode: "Ranked 3v3",
    replays: [
      { replay: 2, timestamps: ["01:05.30", "03:42.80"] },
      { replay: 5, timestamps: ["02:18.60"] },
      { replay: 7, timestamps: ["00:47.20", "04:11.50"] },
      { replay: 9, timestamps: ["01:36.90", "03:57.40"] },
    ],
    rule: "Support the next play.",
    practice: "If your teammate has the better angle and momentum, support instead of taking the same ball.",
    tease: "Unlock the cut-offs, teammate lanes, and the possession your team could have kept.",
  },
  {
    key: "over-flipping",
    nav: "Over-Flipping",
    aria: "Over-Flipping fault example",
    title: "Over-Flipping",
    summary: "You started a flip while the play was still uncertain, temporarily locking your speed and direction. A bounce, flick, or change of possession can pass you before the flip animation finishes.",
    moment: "You flip forward as the opponent changes the play.",
    rank: "Grand Champion I",
    mode: "Ranked 1v1",
    replays: [
      { replay: 1, timestamps: ["00:34.60", "02:12.80", "04:24.10"] },
      { replay: 3, timestamps: ["01:08.20", "03:46.70"] },
      { replay: 5, timestamps: ["00:51.90", "02:59.40"] },
      { replay: 7, timestamps: ["04:06.30"] },
      { replay: 9, timestamps: ["01:27.50", "03:15.80", "04:38.20"] },
    ],
    rule: "Stay on your wheels.",
    practice: "Stay grounded when you may need to brake, turn, shadow, or react to the next touch.",
    tease: "Unlock the flips that removed your reaction window and the safer movement choice.",
  },
  {
    key: "poor-50-selection",
    nav: "Poor 50/50 Selection",
    aria: "Poor 50/50 Selection fault example",
    title: "Poor 50/50 Selection",
    summary: "You challenged with an angle or commitment that sent the ball through you, over you, or into a dangerous area. A neutral challenge becomes an immediate counterattack, often while your recovery is already committed.",
    moment: "You challenge from the wrong side and send the ball into the middle.",
    rank: "Diamond III",
    mode: "Ranked 1v1",
    replays: [
      { replay: 2, timestamps: ["00:43.10", "03:09.60"] },
      { replay: 4, timestamps: ["01:21.80", "04:17.30"] },
      { replay: 6, timestamps: ["02:36.50"] },
      { replay: 8, timestamps: ["00:58.70", "02:48.20", "04:29.90"] },
    ],
    rule: "Protect the dangerous side.",
    practice: "When control is limited, stay grounded and let the opponent play into you.",
    tease: "Unlock the challenge angle, timing, and safer 50 option for every detected loss.",
  },
] as const;

function ProductMoment({ earlyAccessOpen }: { earlyAccessOpen: boolean }) {
  const [activeExample, setActiveExample] = useState(0);
  const touchStart = useRef<number | null>(null);
  const example = sampleReports[activeExample];
  const replayCount = example.replays.length;
  const instanceCount = example.replays.reduce((total, replay) => total + replay.timestamps.length, 0);
  const instancesByReplay = new Map(example.replays.map(replay => [replay.replay, replay.timestamps.length]));

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
      <header className="rm-engine-intro"><h2>Select a common ranked RL mistake below and get a brief look at the deep feedback Replay Method can provide.</h2><p>Heads up! This interactive demo is intentionally stripped down. Beyond it, the method can scale to support up to 35 .replay files per week, pairing a complete breakdown with tailored coaching and targeted drills that help you memorize each change and bring it into your games.</p></header>
      <div className="rm-product-demo rm-simple-demo" data-example={example.key} onTouchStart={beginSwipe} onTouchEnd={endSwipe}>
        <header className="rm-product-demo-bar">
          <span><i />Interactive product demo</span>
          <small>Example report — no upload needed</small>
        </header>

        <nav className="rm-product-demo-nav" aria-label="Common replay pattern examples">
          <div role="tablist" aria-label="Replay pattern examples">
            {sampleReports.map((item, index) => <button id={`product-example-${index}`} type="button" role="tab" aria-label={item.aria} aria-selected={activeExample === index} aria-controls="product-example-panel" tabIndex={activeExample === index ? 0 : -1} onClick={() => chooseExample(index)} onKeyDown={event => handleExampleKey(event, index)} key={item.key}><strong>{item.nav}</strong></button>)}
          </div>
        </nav>

        <div className="rm-simple-demo-grid" id="product-example-panel" role="tabpanel" aria-live="polite" aria-labelledby={`product-example-${activeExample}`}>
          <section className="rm-simple-demo-finding">
            <div className="rm-simple-demo-signal"><span>Example result</span><b>Illustrative example</b></div>
            <div className="rm-simple-demo-finding-copy">
              <h3>{example.title}</h3>
              <p>{example.summary}</p>
            </div>
            <article className="rm-demo-evidence" aria-label={`Illustrative ${example.rank} ${example.mode} example with ${replayCount} of 10 .replay files and ${instanceCount} total instances`}>
              <header className="rm-demo-evidence-head">
                <div><span>Rank</span><strong>{example.rank}</strong></div>
                <div><span>Mode</span><strong>{example.mode}</strong></div>
              </header>
              <p className="rm-demo-moment">{example.moment}</p>
              <div className="rm-demo-metrics">
                <div><strong>{replayCount}<small>/10</small></strong><span>.replay files with this fault</span></div>
                <div><strong>{instanceCount}</strong><span>Total instances</span></div>
              </div>
              <ol className="rm-demo-replay-rail" aria-label="Instances across the ten illustrative .replay files">
                {Array.from({ length: 10 }, (_, index) => {
                  const replayNumber = index + 1;
                  const count = instancesByReplay.get(replayNumber) ?? 0;
                  return <li key={replayNumber} data-detected={count > 0 ? "true" : "false"} aria-label={`Replay ${replayNumber}: ${count} ${count === 1 ? "instance" : "instances"}`}><i style={{ "--instances": Math.max(count, 1) } as CSSProperties} /><span>{String(replayNumber).padStart(2, "0")}</span></li>;
                })}
              </ol>
              <details className="rm-demo-breakdown">
                <summary><span>Replay breakdown</span><strong>{replayCount} .replay files</strong></summary>
                <div className="rm-demo-breakdown-list">
                  {example.replays.map(replay => <div className="rm-demo-breakdown-row" key={replay.replay}><b>Replay {String(replay.replay).padStart(2, "0")}</b><div>{replay.timestamps.map(timestamp => <time key={timestamp}>{timestamp}</time>)}</div></div>)}
                </div>
              </details>
            </article>
          </section>

          <aside className="rm-simple-demo-action">
            <div className="rm-simple-demo-action-copy">
              <span>Quick fix</span>
              <h4>{example.rule}</h4>
              <p>{example.practice}</p>
            </div>
            <p className="rm-simple-demo-tease">{example.tease}</p>
            <a href="#ten-replay-start" onClick={(event) => scrollToReplayUpload(event, `sample_report_${example.key}`)}>See the full pattern in your free analysis <i aria-hidden="true">→</i></a>
          </aside>
        </div>

        <footer className="rm-product-demo-foot"><span>{earlyAccessOpen ? "Example report — your real report opens the exact replay moments." : "Example report — your real report only includes patterns supported by your own .replay files."}</span><small>Your report stays private. No card needed.</small></footer>
      </div>
    </div>
  </section>;
}

function HowItWorks() {
  const [method, setMethod] = useState<"free" | "premium">("free");
  const steps = method === "free" ? [
    {
      title: "Upload one set of 10 ranked replays.",
      body: "Start your climb by uploading 10 ranked .replay files from the same player and game mode. Don’t cherry-pick the games where you played at your best, mechanically or game-sense-wise. Better yet, play 10 fresh ranked games in your preferred mode before uploading, so the Replay Engine gets a true picture of how you normally play and a stronger foundation for your climb.",
    },
    {
      title: "Find what keeps you hardstuck.",
      body: "Replay Method works through all 10 of your replays to identify the habits, decisions, game-sense patterns and mechanics that repeatedly hold you back. When you’ve spent hours playing a certain way, those patterns can be hard to notice on your own — and even harder to break. Instead of leaving you to spot every mistake yourself, including the small, easy-to-miss patterns that can quietly cost you games, the Replay Engine does the heavy lifting. It turns what it finds into a crystal-clear plan: what needs to change, why it matters, where you should focus first, and which drills or game-sense adjustments will help you apply those changes in your next games.",
    },
    {
      title: "Start with the change that matters most.",
      body: "Your improvement plan turns the patterns found across your 10 replays into a focused set of changes to work on first. Use the recommended drills and simple game-sense cues to practice each change, then take them into your next ranked sessions until they start to become part of how you play. Instead of trying to fix everything at once, you always know what to focus on next as you continue your climb.",
    },
  ] : [
    {
      title: "Upload up to 35 ranked replays every week.",
      body: "Upload up to 35 ranked .replay files from the same player and game mode each week. That can be as simple as five ranked games a day, giving Replay Method a much broader view of how you actually play throughout the week. With more matches to work from, it becomes easier to separate one-off mistakes from the habits, decisions and game-sense patterns that consistently shape your games.",
    },
    {
      title: "Let Replay Method connect the patterns.",
      body: "With a larger set to work from, Replay Method can build a more complete picture of what repeatedly holds you back across your mechanics, decisions and game sense. By connecting patterns across your matches, the Replay Engine can prioritize what deserves your attention first and turn the findings into a complete breakdown paired with tailored coaching — including what to change, why it matters, what to practice and how to approach it in your games.",
    },
    {
      title: "Get weekly coaching tailored to how your game improves.",
      body: "Your coaching gives you a clear focus for the week ahead, with targeted drills, simple game-sense cues and practical changes you can take straight into ranked. Instead of trying to remember a long list of problems or deciding what to work on yourself, you can focus on the changes that matter most and apply them one at a time. Play your games, put the coaching into practice, then bring your next set back to Replay Method and keep the cycle moving as your game develops.",
    },
  ];

  return <section className="rm-home-how" id="method" aria-labelledby="how-title">
    <div className="reveal-shell">
      <div className="rm-home-how-panel">
        <header>
          <span className="reveal-kicker rm-section-prompt rm-section-prompt-inverse">How does Replay Method work?</span>
          <h2 id="how-title">By filtering out unnecessary hours of frustrating tilt, Replay Method delivers focused, easy-to-apply practice and a crystal clear breakdown of exactly what you need to change in your game.</h2>
          <div className="rm-home-how-intro">
            <p>Start your climb for free by uploading your 10 latest ranked .replay files, pinpointing exactly what to improve with targeted drills to memorize the changes.</p>
            <p>Planned Premium extends this method by letting you upload up to 35 ranked .replay files each week. You&apos;ll receive a complete analysis paired with tailored coaching that is easy to follow and apply in your games throughout the next week.</p>
          </div>
        </header>
        <div className="rm-home-how-switch" role="tablist" aria-label="Choose Replay Method instructions">
          <button type="button" role="tab" aria-selected={method === "free"} aria-controls="method-steps" onClick={() => setMethod("free")}>Free method</button>
          <button type="button" role="tab" aria-selected={method === "premium"} aria-controls="method-steps" onClick={() => setMethod("premium")}>Planned Premium</button>
        </div>
        <ol className={`rm-home-how-steps rm-home-how-steps-${method}`} id="method-steps" aria-live="polite">
          {steps.map((step, index) => <li key={`${method}-${step.title}`}>
            <small>{String(index + 1).padStart(2, "0")}</small>
            <div><h3>{step.title}</h3><p>{step.body}</p></div>
          </li>)}
        </ol>
        {method === "free" && <p className="rm-home-how-premium-note"><strong>Want to keep the method going?</strong> Premium extends the same cycle across a larger set of replays each week, with tailored coaching that develops alongside your game.</p>}
      </div>
    </div>
  </section>;
}

function GoodToKnow() {
  return <section className="rm-home-trust" id="why" aria-labelledby="why-title">
    <div className="reveal-shell">
      <header>
        <span className="reveal-kicker rm-section-prompt">Why Replay Method?</span>
        <h2 id="why-title">We identify what keeps going wrong across your .replay files —<br />you get a structured improvement plan designed to help you climb the ranks.</h2>
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
    <CustomerHeader />

    <section className="rm-home-hero reveal-shell" id="start" aria-labelledby="home-title">
      <span className="reveal-kicker rm-home-hero-category">Rocket League replay analysis for PC</span>
      <h1 id="home-title">From endless grinding —<br />get a clear path toward your next target rank.</h1>
      <p>Replay Method is designed to work across up to 35 ranked RL .replay files each week—uncovering the habits, decisions and game-sense patterns keeping you hardstuck. Instead of hours of frustrating tilt and guesswork, you get a crystal-clear breakdown grounded in your own matches, tailored coaching and targeted drills that show you exactly what to change, help each adjustment stick and make it easier to apply in your next games.</p>
      <div className="rm-home-hero-actions">
        <a href="#ten-replay-start" onClick={(event) => scrollToReplayUpload(event, "home_hero")}>Analyze 10 .replay files for free <span aria-hidden="true">↓</span></a>
        <a href="#product">View the stripped-down product demo <span aria-hidden="true">↓</span></a>
      </div>
      <small className="rm-home-hero-assurance"><strong>Free first analysis.</strong> No card required. PC .replay files only.</small>
    </section>

    <section className="rm-home-activation reveal-shell" aria-label="Start a free ten-file .replay analysis">
      <BatchAnalyzeFlow engineOpen={engineOpen} variant="hero" />
    </section>

    <ProductMoment earlyAccessOpen={earlyAccessOpen} />
    <HowItWorks />
    <GoodToKnow />

    <section className="rm-home-final reveal-shell" id="pricing" aria-labelledby="final-title">
      <div className="rm-home-final-copy"><h2 id="final-title">Curious?</h2><p>Upload your 10 most recent PC .replay files from the same ranked mode and begin your climb.</p></div>
      <div className="rm-home-final-action"><a href="#ten-replay-start" onClick={(event) => scrollToReplayUpload(event, "home_final")}>Analyze 10 .replay files for free <span aria-hidden="true">↑</span></a></div>
    </section>

    <CustomerFooter />
  </main>;
}
