"use client";
/* eslint-disable @next/next/no-html-link-for-pages */

import { FormEvent, useEffect, useMemo, useState } from "react";

type Game = "league" | "valorant" | "rocket-league";
type Leak = {
  id: string;
  prompt: string;
  label: string;
  title: string;
  explanation: string;
  focus: string;
  review: string[];
};

const gameNames: Record<Game, string> = {
  league: "League of Legends",
  valorant: "VALORANT",
  "rocket-league": "Rocket League"
};

const leaks: Record<Game, Leak[]> = {
  league: [
    { id: "lead", prompt: "I win lane, then the game slips away", label: "Lead conversion", title: "Your likely leak is lead conversion—not laning.", explanation: "A lead only matters when it changes the map. If gold stays on your champion while vision, waves and objectives remain neutral, the advantage expires.", focus: "Before the next objective, spend your priority on one map action before you look for a fight.", review: ["Minute 8–14: what did your first lead buy?", "Minute 14–20: were side waves fixed before you grouped?", "Every death: was an objective, wave or vision trade available?"] },
    { id: "objectives", prompt: "I keep dying before objectives", label: "Objective setup", title: "Your likely leak is arriving after the decision was already made.", explanation: "Many objective deaths are caused 30–60 seconds earlier by a bad recall, an unpushed wave or vision placed too late—not by the final fight.", focus: "Start your objective plan one minute early: wave, recall, route, vision, then position.", review: ["Pause 60 seconds before each objective", "Check gold and recall timing", "Count untraded face-checks and late rotations"] },
    { id: "champions", prompt: "I change champion or role after losses", label: "Process consistency", title: "Your likely leak is changing the test every match.", explanation: "When champion, role and focus all change, you cannot tell whether a decision improved. Variety feels productive but often hides the repeated mistake.", focus: "Play one role, a two-champion pool and one review focus for the next five ranked games.", review: ["Record the same decision after every game", "Separate execution errors from matchup knowledge", "Change the focus only after five comparable games"] },
    { id: "impact", prompt: "My farm is fine but my impact feels low", label: "Tempo conversion", title: "Your likely leak is converting resources into pressure.", explanation: "Strong CS can coexist with low impact when resets, rotations and threat windows happen after the play is already decided.", focus: "After each completed wave, name the next highest-value action before autopiloting into another wave.", review: ["Track first move to river and objectives", "Mark recalls that lost a tempo window", "Check whether farm created pressure or only a larger number"] }
  ],
  valorant: [
    { id: "topfrag", prompt: "I top-frag and still lose", label: "Round impact", title: "Your likely leak is fight value—not raw kills.", explanation: "A late exit kill and an opening kill both raise K/D, but they do not change rounds equally. The question is whether your fights create space, trades or objective control.", focus: "Label every fight next game: opener, trade, conversion or exit. Prioritize the first three.", review: ["Was each kill before or after the round was decided?", "Did your first contact have trade support?", "What space or objective did the kill create?"] },
    { id: "firstdeath", prompt: "I am first death too often", label: "Opening duel quality", title: "Your likely leak is repeatable first-contact risk.", explanation: "The problem may not be aim. Reusing the same opener, fighting without an escape route or peeking outside trade range creates low-quality duels.", focus: "Before barrier drop, name your trade partner, escape route and the utility that starts the fight.", review: ["Pause before every first death", "Check trade distance and teammate line of sight", "Mark repeated openers after lost rounds"] },
    { id: "utility", prompt: "I die with utility or use it too early", label: "Utility timing", title: "Your likely leak is utility without a decision attached.", explanation: "Utility is valuable when it enables contact, denies a timing or protects a conversion. Throwing it by habit—or saving it forever—removes that purpose.", focus: "Attach every key ability to one job: take space, stop contact, enable trade or protect retake.", review: ["Did utility change an enemy decision?", "Was a teammate ready to act on it?", "What utility remained when the round ended?"] },
    { id: "streak", prompt: "My aim disappears after a few bad rounds", label: "Loss-streak decisions", title: "Your likely leak is how your decisions change after losing rounds.", explanation: "Players often speed up, repeat a failed opener or force hero fights when confidence drops. That looks like inconsistent aim but begins as predictable decision drift.", focus: "After two lost rounds, change position and choose one low-variance first action.", review: ["Compare your first three rounds with rounds after a streak", "Mark solo peeks and rushed re-peeks", "Check whether your opener changed when the enemy adapted"] }
  ],
  "rocket-league": [
    { id: "double", prompt: "I feel fast but keep double committing", label: "Teammate spacing", title: "Your likely leak is speed without spacing.", explanation: "Arriving quickly is only valuable when you own the next touch. Following a teammate into the same lane turns recoverable plays into open nets.", focus: "When your teammate crosses the ball line, hold one layer deeper until possession is clear.", review: ["Pause when both teammates enter the same lane", "Check your distance after a teammate commits", "Count goals conceded with nobody behind the ball"] },
    { id: "boost", prompt: "I am always low boost at the worst time", label: "Boost pathing", title: "Your likely leak is pathing—not boost availability.", explanation: "Detouring for a full pad can remove you from the play. Small-pad routes preserve position, momentum and options even when the tank is not full.", focus: "Use a three-small-pad route through your rotation before leaving the play for corner boost.", review: ["Track exits from the play for full boost", "Check boost collected while rotating", "Mark defensive moments reached late after a detour"] },
    { id: "recovery", prompt: "One bad touch removes me from the play", label: "Recovery chain", title: "Your likely leak is the second action after the mistake.", explanation: "A missed touch is rarely the entire goal. Landing direction, powerslide use and the first recovery path decide whether the mistake becomes fatal.", focus: "After every aerial or challenge, prioritize wheels-down momentum before looking at the ball again.", review: ["Watch five seconds after each failed touch", "Check landing direction and first turn", "Count recoveries that cross a teammate's lane"] },
    { id: "mechanics", prompt: "My mechanics improve but my rank does not", label: "Mechanic selection", title: "Your likely leak is choosing the mechanic, not performing it.", explanation: "A harder mechanic can create less value than a controlled touch. Rank stalls when execution improves faster than decision quality.", focus: "Before committing, ask whether the touch creates possession, pressure or a safe recovery. If none, simplify.", review: ["Separate execution errors from selection errors", "Mark mechanics attempted with no teammate behind", "Compare controlled first touches with immediate commits"] }
  ]
};

function sendEvent(event: "page_view" | "tool_start" | "tool_complete" | "cta_click" | "signup", game: Game | "general", placement: string) {
  try {
    const storageKey = "replaymethod-session-id";
    let visitorId = sessionStorage.getItem(storageKey);
    if (!visitorId) { visitorId = crypto.randomUUID(); sessionStorage.setItem(storageKey, visitorId); }
    const params = new URLSearchParams(location.search);
    void fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true, body: JSON.stringify({ visitorId, event, game, placement, path: location.pathname, source: params.get("utm_source") || "direct", campaign: params.get("utm_campaign") || "" }) });
  } catch { /* the tool must work even if analytics does not */ }
}

function ResultSignup({ game, leak }: { game: Game; leak: Leak }) {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const website = String(new FormData(form).get("company") || "");
    setStatus("loading");
    setMessage("");
    sendEvent("cta_click", game, "climb_check_result_form");
    try {
      const params = new URLSearchParams(location.search);
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          game,
          website,
          consent,
          source: params.get("utm_source") || "climb_check",
          campaign: params.get("utm_campaign") || `climb-check-${leak.id}`
        })
      });
      const result = await response.json() as { created?: boolean; message?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "Try again");
      setStatus("success");
      setMessage(result.message || "Your beta signup is confirmed.");
      if (result.created) sendEvent("signup", game, "climb_check_result_form");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Try again");
    }
  }

  if (status === "success") {
    return <div className="result-signup-success" role="status"><i>✓</i><div><b>You’re on the beta list.</b><p>{message} We’ll invite suitable testers when the relevant evidence beta is available.</p></div></div>;
  }

  return <form className="result-signup" onSubmit={submit}>
    <div className="result-signup-copy"><span>FREE BETA ACCESS</span><h3>Take the next evidence-based step.</h3><p>Join the beta list. No card and no charge today.</p></div>
    <div className="result-signup-fields"><label className="sr-only" htmlFor={`result-email-${game}`}>Email address</label><input id={`result-email-${game}`} type="email" required autoComplete="email" inputMode="email" placeholder="you@email.com" value={email} onChange={event => setEmail(event.target.value)} /><input className="hp-field" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" /><button disabled={status === "loading"}>{status === "loading" ? "Joining…" : "Join beta list →"}</button></div>
    <label className="consent"><input type="checkbox" required checked={consent} onChange={event => setConsent(event.target.checked)} /><span>Email me private beta access and launch updates. I can unsubscribe anytime. <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></span></label>
    {message && <p className={`result-signup-message ${status}`} aria-live="polite">{message}</p>}
  </form>;
}

export default function ClimbCheck() {
  const [game, setGame] = useState<Game | null>(null);
  const [leakId, setLeakId] = useState<string | null>(null);
  const result = useMemo(() => game && leakId ? leaks[game].find(item => item.id === leakId) ?? null : null, [game, leakId]);

  useEffect(() => { sendEvent("page_view", "general", "climb_check"); }, []);

  function chooseGame(next: Game) {
    setGame(next); setLeakId(null); sendEvent("tool_start", next, "climb_check_game");
  }

  function chooseLeak(id: string) {
    setLeakId(id); if (game) sendEvent("tool_complete", game, "climb_check_result");
  }

  return <main className="tool-page">
    <nav className="tool-nav shell"><a className="brand" href="/"><span className="logo">↻</span><span>replay<span>method</span></span></a><a href="/guides">Free guides</a></nav>
    <section className="tool-hero shell"><span className="kicker">FREE CLIMB LEAK CHECK</span><h1>What keeps repeating<br /><em>when you lose?</em></h1><p>Get a focused self-review in under 60 seconds. No login, no email and no fake AI diagnosis. Your answer is a starting hypothesis to test in your next matches.</p><div className="tool-progress"><i className="done" /><i className={game ? "done" : ""} /><i className={result ? "done" : ""} /><span>{result ? "RESULT" : game ? "STEP 2 OF 2" : "STEP 1 OF 2"}</span></div></section>

    <section className="tool-card shell">
      {!game && <div className="tool-step"><span>01 · CHOOSE YOUR GAME</span><h2>Where are you hardstuck?</h2><div className="tool-options game-options">{(Object.keys(gameNames) as Game[]).map(key => <button key={key} onClick={() => chooseGame(key)}><i>{key === "league" ? "L" : key === "valorant" ? "V" : "RL"}</i><b>{gameNames[key]}</b><span>→</span></button>)}</div></div>}
      {game && !result && <div className="tool-step"><button className="tool-back" onClick={() => setGame(null)}>← Change game</button><span>02 · PICK THE REPEATED SITUATION</span><h2>Which one sounds most like your sessions?</h2><div className="tool-options">{leaks[game].map(item => <button key={item.id} onClick={() => chooseLeak(item.id)}><b>{item.prompt}</b><span>→</span></button>)}</div></div>}
      {game && result && <div className="tool-result"><div className="result-head"><div><span>YOUR STARTING HYPOTHESIS</span><small>{gameNames[game]} · {result.label}</small></div><b>01</b></div><h2>{result.title}</h2><p>{result.explanation}</p><div className="result-focus"><span>YOUR NEXT-QUEUE RULE</span><b>{result.focus}</b></div><div className="result-review"><span>REVIEW THESE THREE MOMENTS</span>{result.review.map((item, index) => <div key={item}><b>0{index + 1}</b><p>{item}</p></div>)}</div><p className="result-honesty">This result is based on your answer, not match data. {game === "rocket-league" ? "The replay quality beta can test it, but stops if no reliable finding is supported." : "Official Riot ingestion is still pending; the beta intake preserves this as a hypothesis, not a diagnosis."}</p><ResultSignup game={game} leak={result} /><div className="result-actions"><a href={`/analyze?game=${game}&hypothesis=${encodeURIComponent(result.title)}`}>Carry this hypothesis into beta intake →</a><button onClick={() => setLeakId(null)}>Try another answer</button></div></div>}
    </section>
    <footer className="tool-footer shell"><p>Free tool by Replay Method. No rank guarantee. Use the focus, review the evidence, adjust.</p><div><a href="/guides">Guides</a><a href="/privacy">Privacy</a><a href="mailto:contact@replaymethod.xyz">Contact</a></div></footer>
  </main>;
}
