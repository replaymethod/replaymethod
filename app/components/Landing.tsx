"use client";
/* eslint-disable @next/next/no-html-link-for-pages */

import { FormEvent, useEffect, useState } from "react";
import QuickReplayStart from "./QuickReplayStart";
import HardstuckHook from "./HardstuckHook";
import PricingLadder from "./PricingLadder";

export type GameKey = "general" | "league" | "valorant" | "rocket-league";
type DemoTab = "diagnosis" | "plan" | "verify";
type EventName = "page_view" | "cta_click" | "game_select" | "signup" | "tool_start" | "tool_complete" | "analysis_start" | "analysis_submit" | "report_view" | "feedback";

type Config = {
  label: string;
  eyebrow: string;
  title: string;
  accent: string;
  lead: string;
  cta: string;
  currency: string;
  loss: string;
  diagnosis: string;
  plan: string;
  metrics: string[];
  moment: string;
  week: string[];
  evidence: string;
  rule: string;
  verify: string;
};

const configs: Record<GameKey, Config> = {
  general: {
    label: "Competitive gaming",
    eyebrow: "THE EVIDENCE-BASED IMPROVEMENT LOOP",
    title: "Stop losing for the same reason.",
    accent: "Fix it. Prove it changed.",
    lead: "Replay Method is not another stats dashboard or AI chatbot. It finds the repeated decision holding you back, gives you one rule to train, then checks future matches for proof that the habit changed.",
    cta: "Join beta updates",
    currency: "rank",
    loss: "You queue again hoping this session will be different. Three hours later, you’re back where you started.",
    diagnosis: "Your decision-making drops when the match gets close.",
    plan: "Slow the game down after a lost fight. Reset before forcing the next play.",
    metrics: ["Decisions", "Consistency", "Positioning"],
    moment: "For the first time, you know exactly why you’re stuck—and exactly what to do tonight.",
    week: ["Find the one habit costing the most wins", "Train it with a focused routine", "Verify the change in real matches"],
    evidence: "The same high-risk decision appears in 4 of your last 6 losses.",
    rule: "After a lost fight, reset before you force the next play.",
    verify: "Risky decisions are trending down across the next sessions."
  },
  league: {
    label: "League of Legends",
    eyebrow: "STOP DONATING LP",
    title: "Stop guessing why you lose.",
    accent: "Find the decision costing your LP.",
    lead: "Replay Method reads your match history, finds the decisions draining your LP, and gives you one focused plan for your role, champion and rank.",
    cta: "Join the League beta list",
    currency: "LP",
    loss: "You win lane, lose the game, blame the team—and queue again without knowing what actually broke down.",
    diagnosis: "You give away your lead during the 14–20 minute transition.",
    plan: "Convert priority into vision before the second objective. Stop taking isolated river fights.",
    metrics: ["Lane impact", "Death quality", "Objective timing"],
    moment: "The loss stops feeling random. You can finally see the decision that changed the game.",
    week: ["Identify your highest-cost macro pattern", "Get champion- and role-specific corrections", "Measure the decision across your next games"],
    evidence: "Five of your last seven deaths happened without an objective trade available.",
    rule: "When you have lane priority, spend it on vision before you contest river.",
    verify: "Untraded deaths fall while objective participation rises."
  },
  valorant: {
    label: "VALORANT",
    eyebrow: "STOP BLEEDING RR",
    title: "Your aim isn’t the whole problem.",
    accent: "Find the rounds costing your RR.",
    lead: "Replay Method finds the fights, positioning and utility mistakes quietly draining your RR—then tells you what to fix before your next queue.",
    cta: "Join the VALORANT beta list",
    currency: "RR",
    loss: "You top-frag and still lose. You aim train, queue again and repeat the same rounds without seeing why.",
    diagnosis: "Your first-death rate spikes after your team loses two rounds in a row.",
    plan: "Change your opening position after a loss streak. Preserve utility for the retake instead of forcing contact.",
    metrics: ["Fight quality", "Utility value", "Round impact"],
    moment: "You stop guessing whether it’s aim, teammates or positioning. The evidence is right there.",
    week: ["Expose the rounds you repeatedly throw away", "Turn the leak into one pre-round rule", "Track first deaths, trades and round impact"],
    evidence: "You take first contact without trade support in 38% of lost defense rounds.",
    rule: "After two lost rounds, change your opener and keep one piece of retake utility.",
    verify: "First deaths fall and your tradeable fights increase."
  },
  "rocket-league": {
    label: "Rocket League",
    eyebrow: "BREAK THE HARDSTUCK LOOP",
    title: "Stop grinding the same rank.",
    accent: "Find the habit costing your MMR.",
    lead: "Upload one representative ranked replay. Replay Method finds the invisible rotation, challenge and boost habits costing you games before you grind another 500 matches.",
    cta: "Join the replay beta list",
    currency: "MMR",
    loss: "You feel faster. Your mechanics improve. But the rank graph keeps ending in the same place.",
    diagnosis: "You follow the play too closely after your teammate commits.",
    plan: "Hold one layer deeper and enter through back post. Stop turning a 1v1 into a double commit.",
    metrics: ["Rotation", "Boost efficiency", "Recovery"],
    moment: "You finally see the tiny repeated choice that turns close games into losses.",
    week: ["Find your highest-impact game-sense mistake", "Get the exact drill and in-game focus", "Compare the pattern in your next three replays"],
    evidence: "You enter the same lane as your teammate in 6 of 9 conceded goals.",
    rule: "When your teammate crosses the ball line, hold back post until the play resets.",
    verify: "Double commits fall while controlled defensive touches rise."
  }
};

const sentViews = new Set<string>();

function getAttribution() {
  const params = new URLSearchParams(window.location.search);
  let source = params.get("utm_source") || "direct";
  if (source === "direct" && document.referrer) {
    try { source = new URL(document.referrer).hostname.replace(/^www\./, ""); } catch { /* keep direct */ }
  }
  return { source: source.slice(0, 80), campaign: (params.get("utm_campaign") || "").slice(0, 120) };
}

function trackEvent(game: GameKey, event: EventName, placement: string) {
  try {
    const attribution = getAttribution();
    const storageKey = "replaymethod-session-id";
    let visitorId = sessionStorage.getItem(storageKey);
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      sessionStorage.setItem(storageKey, visitorId);
    }
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ visitorId, event, game, placement, path: location.pathname, ...attribution })
    });
  } catch { /* analytics must never block the page */ }
}

function WaitlistForm({ game, config, placement, id }: { game: GameKey; config: Config; placement: string; id?: string }) {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const website = String(new FormData(form).get("company") || "");
    setStatus("loading");
    setMessage("");
    trackEvent(game, "cta_click", placement);
    try {
      const attribution = getAttribution();
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, game, website, consent, ...attribution })
      });
      const result = await response.json() as { created?: boolean; message?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "Try again");
      setStatus("success");
      setMessage(result.message || "Your beta signup is confirmed.");
      if (result.created) trackEvent(game, "signup", placement);
      setEmail("");
      setConsent(false);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Try again");
    }
  }

  if (status === "success") {
    return <div className="signup-success" id={id} role="status"><span>✓</span><div><b>You’re on the beta list.</b><p>{message} We’ll email you when a suitable private beta spot opens. No charge today.</p></div></div>;
  }

  return <div className="form-wrap" id={id}>
    <form className="waitlist-form" onSubmit={submit}>
      <div className="waitlist">
        <label className="sr-only" htmlFor={`email-${placement}-${game}`}>Email address</label>
        <input id={`email-${placement}-${game}`} name="email" type="email" required autoComplete="email" inputMode="email" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} />
        <input className="hp-field" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        <button disabled={status === "loading"}>{status === "loading" ? "Joining…" : config.cta}<b>→</b></button>
      </div>
      <label className="consent"><input type="checkbox" required checked={consent} onChange={event => setConsent(event.target.checked)} /><span>Email me private beta access and launch updates. I can unsubscribe anytime. <a href="/privacy">Privacy</a> · <a href="/terms">Waitlist terms</a></span></label>
    </form>
    <p className={`note ${status}`} aria-live="polite">{message || "One email · No card · No charge today"}</p>
  </div>;
}

function GameLinks({ current, placement }: { current: GameKey; placement: string }) {
  const games: { key: GameKey; label: string; path: string; mark: string }[] = [
    { key: "league", label: "League", path: "/league", mark: "L" },
    { key: "valorant", label: "VALORANT", path: "/valorant", mark: "V" },
    { key: "rocket-league", label: "Rocket League", path: "/rocket-league", mark: "RL" }
  ];
  return <div className="game-picker" aria-label="Choose your game"><span>I PLAY</span>{games.map(item => <a key={item.key} className={current === item.key ? "active" : ""} href={item.path} onClick={() => trackEvent(item.key, "game_select", placement)}><i>{item.mark}</i>{item.label}</a>)}</div>;
}

export default function Landing({ game = "general" }: { game?: GameKey }) {
  const config = configs[game];
  const [demoTab, setDemoTab] = useState<DemoTab>("diagnosis");
  const analysisHref = game === "general" ? "/analyze" : `/analyze?game=${game}`;

  useEffect(() => {
    const key = `replaymethod-view-${location.pathname}`;
    if (!sentViews.has(key)) {
      sentViews.add(key);
      trackEvent(game, "page_view", "landing");
    }
  }, [game]);

  const scrollTo = (id: string, placement: string) => {
    trackEvent(game, "cta_click", placement);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => document.querySelector<HTMLInputElement>(`#${id} input[type=email]`)?.focus(), 450);
  };

  const previewProduct = () => {
    trackEvent(game, "cta_click", "hero_product_preview");
    document.getElementById("product")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return <main>
    <div className="launch-bar"><strong>FREE MATCH ANALYSIS BETA</strong><span>Submit one real match. Get one focused diagnosis.</span><a href={analysisHref} onClick={() => trackEvent(game, "analysis_start", "launch_bar")}>Submit free →</a></div>
    <nav className="nav shell"><a className="brand" href="/" aria-label="Replay Method home"><span className="logo">↻</span><span>replay<span>method</span></span></a><div className="nav-links"><a href="/analyze">Free analysis</a><a href="#product">Sample report</a><a href="/guides">Guides</a><a href="#pricing">Pricing</a></div><a className="nav-cta" href={analysisHref} onClick={() => trackEvent(game, "analysis_start", "nav_analysis")}>Analyze a match</a></nav>

    <section className="hero shell">
      <div className="hero-copy"><div className="eyebrow"><i /> {config.eyebrow}</div><h1>{config.title}<br /><em>{config.accent}</em></h1><p className="lead">{config.lead}</p><GameLinks current={game} placement="hero_picker" />{(game === "general" || game === "rocket-league") ? <><QuickReplayStart placement={game === "general" ? "home_quick_replay" : "rl_quick_replay"} /><div className="hero-quiet-actions"><button className="hero-secondary" onClick={previewProduct}>See a sample report <span>↓</span></button><a href={analysisHref} onClick={() => trackEvent(game, "analysis_start", "hero_full_intake")}>Use the full intake instead →</a></div></> : <div className="hero-actions"><a className="hero-primary" href={analysisHref} onClick={() => trackEvent(game, "analysis_start", "hero_analysis")}><span>FIRST MATCH FREE · PRIVATE REPORT</span><b>Analyze my match <i>→</i></b></a><button className="hero-secondary" onClick={previewProduct}>See a sample report <span>↓</span></button></div>}<div className="hero-proof"><span>✓ Real match evidence</span><span>✓ One focused plan</span><span>✓ No card</span></div><a className="hero-beta-link" href="/climb-check" onClick={() => trackEvent(game, "tool_start", "hero_climb_check")}>No match ready? Run the 60-second Climb Check →</a>
      </div>
      <div className="visual-wrap"><div className="orb orb-a" /><div className="orb orb-b" /><div className="example-tag">INTERACTIVE PRODUCT PREVIEW</div><div className="coach-card"><div className="card-head"><div><small>REPLAY METHOD MATCH INTELLIGENCE</small><strong>{config.label}</strong></div><span><i /> ANALYSIS COMPLETE</span></div><div className="rank-row"><div><small>LAST 30 DAYS</small><b>HARDSTUCK</b></div><span>→</span><div><small>NEXT TARGET</small><b className="electric">RANK UP</b></div></div><div className="chart"><div className="gridlines" /><div className="ceiling">YOUR CURRENT CEILING</div><svg viewBox="0 0 480 180" preserveAspectRatio="none" aria-hidden="true"><path className="ghost-line" d="M0,125 C55,140 78,92 125,120 S190,83 235,112 S310,90 350,112 S420,79 480,104" /><path className="climb-line" d="M0,126 C55,140 78,92 125,120 S190,83 235,112 S310,90 350,76 S420,60 480,20" /></svg><div className="unlock">PATTERN FIXED</div></div><div className="alert"><i>!</i><div><small>YOUR #1 RANK KILLER</small><strong>{config.diagnosis}</strong><p>{config.plan}</p></div></div><div className="scores">{config.metrics.map((metric, index) => <div key={metric}><span>{metric}</span><b>{[62, 76, 69][index]}</b><small>/100</small><div><i style={{ width: `${[62, 76, 69][index]}%` }} /></div></div>)}</div></div><div className="floating-chip chip-one"><i>↗</i><div><small>NEXT FOCUS</small><b>Unlocked</b></div></div><div className="floating-chip chip-two"><i>+12</i><div><small>PROJECTED</small><b>{config.currency} impact</b></div></div></div>
    </section>

    <section className="proof-ribbon"><div className="shell"><span><b>01</b> REPLAY</span><i>→</i><span><b>02</b> REVEAL</span><i>→</i><span><b>03</b> PRACTICE</span><i>→</i><span><b>04</b> PROVE</span></div></section>
        <HardstuckHook
          analysisHref={analysisHref}
          onAnalysisStart={() =>
            trackEvent(game, "analysis_start", "hardstuck_hook")
          }
        />

    <section className="free-layer shell"><div className="section-intro"><span className="kicker">VALUE BEFORE PAYMENT</span><h2>Don’t take our word for it.<br />Use the method for free.</h2><p>Submit a real match and receive one evidence-backed correction before deciding whether Replay Method deserves your money.</p></div><div className="free-layer-grid"><a className="free-card featured" href={analysisHref} onClick={() => trackEvent(game, "analysis_start", "free_layer_analysis")}><span>FREE PRODUCT BETA</span><h3>Real match analysis</h3><p>Send one match, replay or VOD. Get your highest-impact repeated mistake, evidence moments and a focused next-queue plan.</p><b>Submit my match →</b></a><a className="free-card" href="/climb-check" onClick={() => trackEvent(game, "tool_start", "free_layer_check")}><span>60-SECOND SELF CHECK</span><h3>Climb Leak Check</h3><p>No match ready? Find a likely leak class and leave with one immediate focus.</p><b>Run the check →</b></a><a className="free-card" href="/guides"><span>FREE REVIEW SYSTEM</span><h3>Replay & VOD checklists</h3><p>Review the moments that decide games instead of watching an entire match without structure.</p><b>Open the guide library →</b></a></div></section>

    <section className="product-section shell" id="product"><div className="section-intro"><span className="kicker">THE PRODUCT, IN ONE LOOP</span><h2>Evidence in. One priority out.<br />Progress verified.</h2><p>The free report delivers a real diagnosis. The improvement loop keeps watching the same decision across future matches until the evidence says it changed.</p></div><div className="product-demo"><div className="demo-sidebar"><span>EXAMPLE PLAYER REPORT</span><strong>{config.label}</strong><div className="demo-tabs" role="tablist" aria-label="Example report views"><button className={demoTab === "diagnosis" ? "active" : ""} onClick={() => setDemoTab("diagnosis")}>01 Evidence</button><button className={demoTab === "plan" ? "active" : ""} onClick={() => setDemoTab("plan")}>02 One focus</button><button className={demoTab === "verify" ? "active" : ""} onClick={() => setDemoTab("verify")}>03 Proof</button></div><small>Illustrative product preview—not a claimed player result.</small></div><div className="demo-main">
      {demoTab === "diagnosis" && <div className="demo-panel"><div className="demo-status"><span>HIGH IMPACT PATTERN</span><b>Repeated across recent losses</b></div><h3>{config.diagnosis}</h3><p>{config.evidence}</p><div className="timeline"><span>LOSS 01<i /></span><span>LOSS 02<i /></span><span>WIN 03</span><span>LOSS 04<i /></span><span>LOSS 05<i /></span></div><div className="coach-note"><i>AI</i><div><small>WHY IT MATTERS</small><b>Fixing the repeated decision creates more value than adding another hour of unfocused grinding.</b></div></div></div>}
      {demoTab === "plan" && <div className="demo-panel"><div className="demo-status cyan"><span>NEXT-QUEUE RULE</span><b>One focus. No overload.</b></div><h3>{config.rule}</h3><p>{config.plan}</p><div className="focus-card"><span>BEFORE YOU QUEUE</span><b>Review the rule for 30 seconds.</b><small>Then play normally and focus on recognizing only this decision.</small></div><div className="focus-card"><span>AFTER THE MATCH</span><b>Mark the moment: followed, missed or not applicable.</b><small>Replay Method uses the next matches to adjust the focus.</small></div></div>}
      {demoTab === "verify" && <div className="demo-panel"><div className="demo-status green"><span>FOCUS TREND</span><b>Example progress view</b></div><h3>{config.verify}</h3><p>A rank graph alone cannot tell you whether the underlying habit improved. Replay Method tracks the decision first, then the result.</p><div className="verify-chart"><div><span>WEEK 01</span><b style={{ height: "34%" }}>34%</b></div><div><span>WEEK 02</span><b style={{ height: "51%" }}>51%</b></div><div><span>WEEK 03</span><b style={{ height: "72%" }}>72%</b></div></div><small className="demo-disclaimer">Example values for product demonstration. Improvement is not guaranteed.</small></div>}
    </div></div><div className="demo-conversion"><div><span>PRODUCT BETA IS OPEN</span><b>Your first real match analysis is free.</b><p>See whether the method is useful on your own gameplay before deciding whether a subscription is worth it.</p></div><a href={analysisHref} onClick={() => trackEvent(game, "analysis_start", "demo_analysis")}>Submit my first match →</a></div></section>

    <section className="pain"><div className="shell pain-grid"><div><span className="kicker">THE HARDSTUCK LOOP</span><h2>{config.loss}</h2><p>More hours only make bad patterns harder to break when nobody shows you what the pattern is.</p></div><div className="loop"><div><b>01</b><span>Queue with hope</span></div><i>↓</i><div><b>02</b><span>Repeat the same mistake</span></div><i>↓</i><div><b>03</b><span>Blame aim, luck or teammates</span></div><i>↓</i><div className="hot"><b>04</b><span>Queue again anyway</span></div></div></div></section>

    <section className="method shell" id="how"><div className="section-intro"><span className="kicker">THE REPLAY METHOD</span><h2>Replay. Reveal. Practice. Prove.</h2><p>A repeatable improvement loop built around your matches—not generic advice, endless videos or another hour of blind grinding.</p></div><div className="method-grid"><article><span>01</span><i>REPLAY</i><h3>Bring your real matches.</h3><p>Connect match history or upload a replay or gameplay recording supported during beta.</p><b>REAL MATCH EVIDENCE →</b></article><article><span>02</span><i>REVEAL</i><h3>Find the highest-cost pattern.</h3><p>Replay Method ranks repeated decisions by how often and how severely they hurt your games.</p><b>ONE CLEAR LEAK →</b></article><article><span>03</span><i>PRACTICE</i><h3>Queue with one rule.</h3><p>Apply one specific correction without overloading yourself with ten things to remember.</p><b>FOCUSED REPETITION →</b></article><article><span>04</span><i>PROVE</i><h3>Track the behavior.</h3><p>Verify the correction in new matches and move on only when the habit actually changes.</p><b>MEASURABLE PROGRESS</b></article></div></section>

    <section className="compare"><div className="shell"><div className="section-intro"><span className="kicker">WHY REPLAY METHOD STANDS OUT</span><h2>Other tools give you pieces.<br />Replay Method closes the loop.</h2><p>Each ingredient exists somewhere. The advantage is combining trustworthy match evidence, ruthless prioritization, a usable correction and longitudinal proof in one product.</p></div><div className="compare-table"><div className="compare-head"><span>WHAT YOU GET</span><b>STAT TRACKER</b><b>AI CHAT</b><b className="climb-col">REPLAY METHOD</b></div>{[["Uses evidence from your real match", "✓", "Sometimes", "✓"], ["Identifies the highest-cost repeated decision", "—", "Sometimes", "✓"], ["Gives one rule for the next queue", "—", "Sometimes", "✓"], ["Remembers the focus across matches", "—", "—", "✓"], ["Checks whether the behavior changed", "—", "—", "✓"]].map(row => <div className="compare-row" key={row[0]}>{row.map((cell, index) => index === 0 ? <span key={cell}>{cell}</span> : <b className={index === 3 ? "climb-col" : ""} key={`${cell}-${index}`}>{cell}</b>)}</div>)}</div><div className="difference-line"><span>OUR PRODUCT PROMISE</span><b>We do not just explain the loss. We help you stop losing for the same reason.</b></div></div></section>

    <section className="reveal shell"><div className="reveal-copy"><span className="kicker">THE “THAT’S WHY” MOMENT</span><h2>{config.moment}</h2><p>A coach should reduce uncertainty, not add another dashboard to study. Your plan stays deliberately narrow until the behavior changes.</p><button onClick={() => scrollTo("final-signup", "climb_plan")}>Show me what I’m missing →</button></div><div className="weekly"><div className="weekly-head"><span>YOUR 7-DAY CLIMB PLAN</span><b>WEEK 01</b></div>{config.week.map((item, index) => <div className="week-row" key={item}><span>0{index + 1}</span><div><small>{["DIAGNOSE", "TRAIN", "VERIFY"][index]}</small><b>{item}</b></div><i>{index === 2 ? "★" : "✓"}</i></div>)}</div></section>

    <section className="games"><div className="shell"><span>CHOOSE YOUR CLIMB</span><a href="/league" onClick={() => trackEvent("league", "game_select", "game_bar")}>LEAGUE OF LEGENDS <b>→</b></a><a href="/valorant" onClick={() => trackEvent("valorant", "game_select", "game_bar")}>VALORANT <b>→</b></a><a href="/rocket-league" onClick={() => trackEvent("rocket-league", "game_select", "game_bar")}>ROCKET LEAGUE <b>→</b></a></div></section>

    <section className="guide-preview shell"><div className="section-intro"><span className="kicker">FREE PLAYER GUIDES</span><h2>Searchable answers for the exact moment you get stuck.</h2><p>Built for the questions ranked players actually search after a bad session—not generic motivational content.</p></div><div className="guide-preview-grid"><a href="/guides/league-replay-review-checklist"><span>LEAGUE OF LEGENDS</span><h3>How to review a loss without blaming the last teamfight</h3><p>Lane conversion, objective setup, death quality and the 14–20 minute transition.</p><b>Read the checklist →</b></a><a href="/guides/valorant-vod-review-checklist"><span>VALORANT</span><h3>A round-by-round VOD review that takes 15 minutes</h3><p>First contact, tradeability, utility value and decisions after a losing streak.</p><b>Read the checklist →</b></a><a href="/guides/rocket-league-replay-review-checklist"><span>ROCKET LEAGUE</span><h3>The replay review checklist for hardstuck ranked players</h3><p>Spacing, challenges, boost paths, recoveries and the goals your mechanics did not cause.</p><b>Read the checklist →</b></a></div></section>

    <PricingLadder analysisHref={analysisHref} />

    <section className="faq shell"><div className="section-intro"><span className="kicker">NO BULLSHIT FAQ</span><h2>Know exactly what you’re submitting.</h2></div><div className="faq-list"><details><summary>Is Replay Method live today?<b>+</b></summary><p>The production-quality beta foundation is live. Rocket League uses original .replay files; official League and VALORANT account ingestion is awaiting Riot production approval. A report is only produced when the available evidence supports it.</p></details><details><summary>Does Replay Method guarantee I rank up?<b>+</b></summary><p>No honest coach can guarantee a rank. Replay Method exposes patterns, focuses practice and tracks behavior. You still have to play and apply the feedback.</p></details><details><summary>Which games are supported?<b>+</b></summary><p>Rocket League is the first deep replay adapter. League of Legends and VALORANT share the same product foundation and will activate through official opt-in Riot connections after approval.</p></details><details><summary>What can I submit?<b>+</b></summary><p>Rocket League automation requires the original PC .replay file. League and VALORANT beta requests can preserve a representative match link, but unverified public profiles are never used to invent private-match coaching.</p></details><details><summary>What happens after submission?<b>+</b></summary><p>You immediately receive a private status link. It shows the real pipeline stage, report evidence and engine versions—or an honest blocked state when access or evidence is insufficient.</p></details><details><summary>Why not just use a stat tracker?<b>+</b></summary><p>Trackers are excellent at showing rank, history and performance. Replay Method turns repeated patterns into one prioritized correction you can apply in the next match.</p></details></div></section>

    <section className="final"><div className="shell"><span className="kicker">REPLAY. REVEAL. PRACTICE. PROVE.</span><h2>Stop hoping the rank changes.<br />Change what creates the rank.</h2><p className="final-lead">Submit one real match. Get the first Replay Method report free.</p><a className="final-analysis-cta" href={analysisHref} onClick={() => trackEvent(game, "analysis_start", "final_analysis")}>Analyze my match — free →</a><p className="final-alt">Not ready to submit? Join beta updates below.</p><WaitlistForm game={game} config={config} placement="final_form" id="final-signup" /><small>Private beta · First analysis free · No card</small></div></section>
    <footer className="shell"><div className="brand"><span className="logo">↻</span><span>replay<span>method</span></span></div><p>A better way to get better.</p><div className="footer-links"><a href="/analyze">Free analysis</a><a href="/reports">My reports</a><a href="/guides">Guides</a><a href="mailto:contact@replaymethod.xyz">Contact</a><a href="/privacy">Privacy</a><a href="/beta-terms">Beta terms</a></div><small>Not affiliated with Riot Games, Psyonix or Epic Games.</small></footer>
    <div className="mobile-join"><div><span>FIRST MATCH FREE</span><b>Get a private diagnosis</b></div><a href={analysisHref} onClick={() => trackEvent(game, "analysis_start", "mobile_analysis")}>Analyze →</a></div>
  </main>;
}
