"use client";

import { useEffect } from "react";
import Link from "next/link";
import ReplayContribution from "../rocket-league-beta/ReplayContribution";
import { trackProductEvent } from "../../lib/client-analytics";

export type GameKey = "general" | "league" | "valorant" | "rocket-league";

const sentViews = new Set<string>();

function FutureGame({ game }: { game: "league" | "valorant" }) {
  const label = game === "league" ? "League of Legends" : "VALORANT";
  return <main className="future-game-page">
    <nav className="marcel-nav shell"><Link className="brand" href="/"><span className="logo">↻</span><span>replay<span>method</span></span></Link><Link href="/">Rocket League beta</Link></nav>
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
    <article><i>01</i><div><b>Drop the replay</b><span>Your real match, not a quiz.</span></div></article>
    <article><i>02</i><div><b>Reveal one pattern</b><span>Evidence first. No stat wall.</span></div></article>
    <article><i>03</i><div><b>Play with one rule</b><span>Then check if it changed.</span></div></article>
  </section>;
}

function ProductMoment() {
  return <section className="marcel-moment shell" id="product">
    <div className="marcel-moment-copy">
      <span>THE PRODUCT PROMISE</span>
      <h2>Not more information.<br />One decision you can use.</h2>
      <p>Replay Method is being built to turn a repeated match behavior into one focus, one next-match cue and a later proof check. If the evidence is not strong enough, it says so.</p>
      <div className="marcel-truth"><i>✓</i><span><b>Truth before hype</b>Public coaching stays off until real replay evidence and two independent qualified reviewers clear the detector gate.</span></div>
    </div>
    <div className="marcel-result-card" aria-label="Illustration of the Replay Method result structure">
      <header><span>RESULT STRUCTURE</span><em>ILLUSTRATION</em></header>
      <div className="marcel-result-score"><span>YOUR NEXT MATCH</span><b>Protect the safe layer.</b></div>
      <div className="marcel-field"><i className="ball" /><i className="car one" /><i className="car two" /><i className="path" /></div>
      <p><b>The moment:</b> your teammate crosses the ball line while you follow the same channel.</p>
      <footer><span>ONE CUE</span><b>Hold the second layer until possession is clear.</b></footer>
    </div>
  </section>;
}

export default function Landing({ game = "general", calibrationOpen = false }: { game?: GameKey; checkoutOpen?: boolean; engineOpen?: boolean; calibrationOpen?: boolean }) {
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
      <Link className="brand" href="/" aria-label="Replay Method home"><span className="logo">↻</span><span>replay<span>method</span></span></Link>
      <div><a href="#product">How it helps</a><Link href="/reports">My progress</Link></div>
    </nav>

    <section className="marcel-hero shell">
      <div className="marcel-hero-copy">
        <span className="marcel-status"><i /> ROCKET LEAGUE · PRIVATE BETA</span>
        <h1>Stop grinding blind.<br /><em>Find the decision costing you games.</em></h1>
        <p>Drop one original PC replay. Replay Method securely captures the match and the exact player to follow—so real evidence can replace generic advice.</p>
        <div className="marcel-trust-row"><span>.replay file</span><span>Private</span><span>No card</span></div>
      </div>
      <div className="marcel-upload-stage">
        <ReplayContribution intakeOpen={calibrationOpen} compact />
      </div>
    </section>

    <MethodStrip />
    <ProductMoment />

    <section className="marcel-beta-truth shell">
      <span>WHY THIS IS A PRIVATE BETA</span>
      <h2>Your replay helps build the proof. It does not buy a promise.</h2>
      <p>Uploads can open before coaching does. Every replay is stored with consent, player identity and rank context. Qualified reviewers then label detector moments independently. Only patterns that survive that process may appear in a future report.</p>
      <Link href="/rocket-league-beta">See how replay validation works →</Link>
    </section>

    <section className="marcel-faq shell">
      <details><summary>Where is my Rocket League replay?<b>+</b></summary><p>On Windows: Documents → My Games → Rocket League → TAGame → Demos. Choose the original file ending in .replay.</p></details>
      <details><summary>Will I get an analysis now?<b>+</b></summary><p>Not yet. Intake is for the private validation corpus. You receive a secure reference immediately; public coaching remains off until the evidence gate passes.</p></details>
      <details><summary>What happens to the file?<b>+</b></summary><p>It is stored privately for consented calibration, never used as public social proof and never treated as a validated result without review.</p></details>
    </section>

    <footer className="marcel-footer shell">
      <div className="brand"><span className="logo">↻</span><span>replay<span>method</span></span></div>
      <p>Rocket League first. <Link href="/league">League</Link> and <Link href="/valorant">VALORANT</Link> later.</p>
      <div><Link href="/privacy">Privacy</Link><Link href="/beta-terms">Beta terms</Link><a href="mailto:contact@replaymethod.xyz">Contact</a></div>
      <small>Independent service. Not affiliated with or endorsed by Psyonix or Epic Games.</small>
    </footer>
  </main>;
}
