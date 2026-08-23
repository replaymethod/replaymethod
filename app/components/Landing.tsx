"use client";

import { useEffect } from "react";
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
    <article><i>01</i><div><b>Drop the replay</b><span>Your real match, not a quiz.</span></div></article>
    <article><i>02</i><div><b>Reveal one pattern</b><span>Evidence first. No stat wall.</span></div></article>
    <article><i>03</i><div><b>Play with one rule</b><span>Then check if it changed.</span></div></article>
  </section>;
}

function ProductMoment({ earlyAccessOpen }: { earlyAccessOpen: boolean }) {
  function focusUploader() {
    const uploader = document.getElementById("replay-upload");
    if (!uploader) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    uploader.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
    uploader.focus({ preventScroll: true });
    trackProductEvent("cta_click", "rocket-league", "product_loop_to_uploader");
  }

  return <section className="marcel-moment shell" id="product">
    <div className="marcel-moment-copy">
      <span>THE IMPROVEMENT LOOP</span>
      <h2>See the moment.<br />Queue with one rule.</h2>
      <p>Replay Method turns supported match evidence into one focus you can carry into the next game. If the evidence is not strong enough, it stops instead of filling the screen with guesses.</p>
      <div className="marcel-truth"><i>✓</i><span><b>Truth before hype</b>{earlyAccessOpen ? "Experimental Early Access coaching is clearly marked while formal detector validation continues independently." : "Coaching stays off until the current release gate opens."}</span></div>
    </div>
    <div className="marcel-demo" aria-label="Illustrative Replay Method product loop">
      <header><span>ILLUSTRATIVE FLOW</span><em>NOT A LIVE FINDING</em></header>
      <ol className="marcel-demo-stages" aria-label="Product loop stages">
        <li>MATCH LOADED</li><li>SCAN</li><li>MOMENT</li><li>MOVEMENT PATH</li><li>EVIDENCE</li><li>ONE FOCUS</li><li>NEXT-MATCH RULE</li>
      </ol>
      <div className="marcel-demo-screen">
        <div className="marcel-demo-meta"><span>2V2 · 02:41</span><b>SUPPORTED MOMENT</b></div>
        <div className="marcel-field" aria-hidden="true"><i className="scan-line" /><i className="ball" /><i className="car one" /><i className="car two" /><i className="path" /><i className="evidence-pin">01</i></div>
        <p><b>EVIDENCE 01</b>Your teammate crosses the ball line while your path enters the same channel.</p>
      </div>
      <div className="marcel-demo-decision"><span>ONE FOCUS</span><b>Protect the safe layer.</b><small>NEXT-MATCH RULE · Hold one layer deeper until possession is clear.</small></div>
      <button type="button" onClick={focusUploader}>RUN THIS ON MY REPLAY <span>→</span></button>
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
        <p>{engineOpen && earlyAccessOpen ? "Drop one original PC replay. Choose your player, receive verified match facts and—only when the evidence clears the Early Access policy—one clearly marked experimental coaching insight." : engineOpen ? "Drop one original PC replay. The engine reads the playlist and players, then asks only which player is you. If evidence has not earned a coaching claim, it stops and tells you." : "Drop one original PC replay. Replay Method securely captures the match and the exact player to follow—so real evidence can replace generic advice."}</p>
        <div className="marcel-trust-row"><span>First analysis included · Private · No card</span></div>
      </div>
      <div className="marcel-upload-stage">
        {engineOpen ? <QuickReplayStart placement="marcel_hero" /> : <ReplayContribution intakeOpen={calibrationOpen} compact />}
      </div>
    </section>

    <MethodStrip />
    <ProductMoment earlyAccessOpen={earlyAccessOpen} />
    {checkoutOpen && <PricingLadder analysisHref="#replay-upload" game="rocket-league" checkoutOpen replayReady />}

    <section className="marcel-beta-truth shell">
      <span>{earlyAccessOpen ? "WHY THIS IS EARLY ACCESS" : "WHY THIS IS A PRIVATE BETA"}</span>
      <h2>{engineOpen && earlyAccessOpen ? "Verified facts first. Experimental coaching only where this replay supports it." : engineOpen ? "The engine can read the match. Coaching still has to earn the right to speak." : "Your replay helps build the proof. It does not buy a promise."}</h2>
      <p>{engineOpen && earlyAccessOpen ? "Your report separates parser-backed facts, experimental coaching and local abstentions. Expert review continues independently and no Early Access result is represented as formally validated or individually human-reviewed." : engineOpen ? "Every replay enters the real parser and evidence pipeline. Exact detector scopes stay private until qualified independent review and holdout performance pass. A safe stop is a product result—not a failed promise." : "Uploads can open before coaching does. Every replay is stored with consent, player identity and rank context. Qualified reviewers then label detector moments independently. Only patterns that survive that process may appear in a future report."}</p>
      <Link href="/rocket-league-beta">{engineOpen ? "Contribute a calibration replay separately →" : "See how replay validation works →"}</Link>
    </section>

    <section className="marcel-faq shell">
      <details><summary>Where is my Rocket League replay?<b>+</b></summary><p>On Windows: Documents → My Games → Rocket League → TAGame → Demos. Choose the original file ending in .replay.</p></details>
      <details><summary>Will I get an analysis now?<b>+</b></summary><p>{engineOpen && earlyAccessOpen ? "Yes. You receive a complete private report with verified match facts. A coaching insight appears only if it clears the conservative Early Access evidence policy; otherwise that part abstains locally and explains why." : engineOpen ? "The live engine parses the replay, identifies its playlist and lets you choose your player. You receive a real report only when a detector has passed its exact evidence gate; otherwise you receive an honest evidence-status result." : "Not yet. Intake is for the private validation corpus. You receive a secure reference immediately; public coaching remains off until the evidence gate passes."}</p></details>
      <details><summary>What happens to the file?<b>+</b></summary><p>It is stored privately to deliver your requested report. Customer analysis replays are not used for detector calibration, training or evaluation without a separate explicit opt-in.</p></details>
    </section>

    <footer className="marcel-footer shell">
      <div className="brand"><span className="logo" aria-hidden="true" /><span>replay<span>method</span></span></div>
      <p>Rocket League first. <Link href="/league">League</Link> and <Link href="/valorant">VALORANT</Link> later.</p>
      <div><Link href="/privacy">Privacy</Link><Link href="/beta-terms">Beta terms</Link><a href="mailto:contact@replaymethod.xyz">Contact</a></div>
      <small>Independent service. Not affiliated with or endorsed by Psyonix or Epic Games.</small>
    </footer>
  </main>;
}
