"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { GameKey } from "./Landing";

type Choice = { label: string; correct?: boolean };
type Scenario = { game: string; title: string; situation: string; choices: Choice[]; cue: string };

const scenarios: Record<Exclude<GameKey, "general">, Scenario> = {
  league: {
    game: "LEAGUE OF LEGENDS",
    title: "Dragon in 38 seconds. What comes first?",
    situation: "Your wave is pushed and river is dark.",
    choices: [
      { label: "Hit top tower" },
      { label: "Reset, then place river vision", correct: true },
      { label: "Face-check dragon" },
    ],
    cue: "When your wave is pushed, spend the advantage on vision before the objective.",
  },
  valorant: {
    game: "VALORANT",
    title: "You have one flash. How do you enter?",
    situation: "Your teammate is four metres behind you.",
    choices: [
      { label: "Dry swing alone" },
      { label: "Flash, wait for spacing, then swing", correct: true },
      { label: "Wait for a solo lurk" },
    ],
    cue: "Use utility when the second player is close enough to trade.",
  },
  "rocket-league": {
    game: "ROCKET LEAGUE",
    title: "Your teammate commits. What do you do?",
    situation: "You have 41 boost and the net is uncovered.",
    choices: [
      { label: "Challenge the same ball" },
      { label: "Rotate through back post", correct: true },
      { label: "Leave for corner boost" },
    ],
    cue: "When your teammate crosses the ball line, protect back post until the play resets.",
  },
};

function DecisionPreview({ scenario }: { scenario: Scenario }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [interactive, setInteractive] = useState(false);
  const answer = selected === null ? null : scenario.choices[selected];

  useEffect(() => {
    const timer = window.setTimeout(() => setInteractive(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  return <div className="decision-preview">
    <header><span>TRY ONE REAL DECISION</span><b>{scenario.game}</b></header>
    <div className="decision-scene" aria-hidden="true"><i className="scene-you">YOU</i><i className="scene-mate">MATE</i><i className="scene-risk">!</i><span /><em>DECISION WINDOW</em></div>
    <div className="decision-copy"><small>SITUATION</small><h2>{scenario.title}</h2><p>{scenario.situation}</p></div>
    <div className="decision-options" role="group" aria-label={scenario.title}>
      {scenario.choices.map((choice, index) => <button type="button" disabled={!interactive} key={choice.label} className={selected === index ? choice.correct ? "correct" : "wrong" : ""} onClick={() => setSelected(index)}><i>{String.fromCharCode(65 + index)}</i><span>{choice.label}</span></button>)}
    </div>
    <div className={`decision-answer ${answer ? answer.correct ? "correct" : "wrong" : ""}`} aria-live="polite">
      <small>{!answer ? "MAKE YOUR READ" : answer.correct ? "THAT'S THE CUE" : "LOOK ONE STEP EARLIER"}</small>
      <b>{!answer ? "Choose an action. You get the reason immediately." : answer.correct ? scenario.cue : "That choice removes a safe option. Try the action that keeps the next play under control."}</b>
    </div>
  </div>;
}

function GameSelectorExperience() {
  return <div className="experience-selector simple-selector">
    <header><small>ONE METHOD · THREE GAME-SPECIFIC FLOWS</small><strong>Choose your game.</strong></header>
    <div>
      <Link href="/league"><span>L</span><div><b>League of Legends</b><p>Wave · vision · objective</p></div><i>→</i></Link>
      <Link href="/valorant"><span>V</span><div><b>VALORANT</b><p>Contact · trade · utility</p></div><i>→</i></Link>
      <Link href="/rocket-league"><span>RL</span><div><b>Rocket League</b><p>Spacing · boost · recovery</p></div><i>→</i></Link>
    </div>
    <footer>Same clear loop. Different match evidence.</footer>
  </div>;
}

export default function GameHeroExperience({ game }: { game: GameKey }) {
  if (game === "general") return <GameSelectorExperience />;
  return <DecisionPreview scenario={scenarios[game]} />;
}
