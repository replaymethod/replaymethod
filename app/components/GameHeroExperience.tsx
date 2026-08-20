"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import type { GameKey } from "./Landing";
import ReplayArenaWalkthrough from "./ReplayArenaWalkthrough";

type LabChoice = { key: string; title: string; detail: string; correct?: boolean };

function DecisionShell({ game, eyebrow, title, prompt, choices, visual }: {
  game: "league" | "valorant";
  eyebrow: string;
  title: string;
  prompt: string;
  choices: LabChoice[];
  visual: ReactNode;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const answer = selected === null ? null : choices[selected];

  return <div className={`game-lab ${game}`}>
    <header className="game-lab-head"><div><small>{eyebrow}</small><strong>{title}</strong></div><span><i /> ILLUSTRATIVE DECISION</span></header>
    <div className="game-lab-visual">{visual}<div className="game-lab-prompt"><span>PAUSE · READ THE STATE</span><b>{prompt}</b></div></div>
    <div className="game-lab-body">
      <div className="game-lab-options">{choices.map((choice, index) => <button type="button" className={selected === index ? choice.correct ? "correct" : "wrong" : ""} onClick={() => setSelected(index)} key={choice.key}><i>{choice.key}</i><div><b>{choice.title}</b><small>{choice.detail}</small></div></button>)}</div>
      <div className={`game-lab-answer ${answer ? answer.correct ? "correct" : "wrong" : ""}`} aria-live="polite">
        <span>{answer ? answer.correct ? "CLEAN READ" : "EXPENSIVE READ" : "YOUR CALL"}</span>
        <b>{!answer ? "Choose one action. The product explains the trade—not just the result." : answer.correct ? game === "league" ? "Priority becomes vision before the objective. Your next fight starts with information." : "Utility creates contact and the second player is close enough to trade." : game === "league" ? "This spends priority without improving the next objective setup." : "This creates isolated first contact with no reliable trade."}</b>
      </div>
    </div>
    <footer className="game-lab-footer"><span>STATE</span><i>→</i><span>DECISION</span><i>→</i><span>ONE NEXT-MATCH CUE</span></footer>
  </div>;
}

function LeagueLab() {
  const choices: LabChoice[] = [
    { key: "A", title: "Hit top tower", detail: "Take the visible gold now." },
    { key: "B", title: "Reset and walk river", detail: "Spend priority on vision first.", correct: true },
    { key: "C", title: "Face-check dragon", detail: "Force information immediately." },
  ];
  return <DecisionShell game="league" eyebrow="LEAGUE DECISION MAP · 17:42" title="Convert priority before soul point." prompt="Dragon in 0:38. Your wave is pushed. What creates the next winning fight?" choices={choices} visual={<div className="lol-map">
    <span className="lol-river" /><span className="lol-lane top" /><span className="lol-lane mid" /><span className="lol-lane bot" />
    <i className="lol-base blue">B</i><i className="lol-base red">R</i><i className="lol-objective">DRG<small>0:38</small></i>
    <i className="lol-champ you">YOU</i><i className="lol-champ ally one">A1</i><i className="lol-champ ally two">A2</i><i className="lol-champ enemy">?</i>
    <span className="lol-vision one">WARD</span><span className="lol-vision two">FOG</span>
  </div>} />;
}

function ValorantLab() {
  const choices: LabChoice[] = [
    { key: "A", title: "Dry swing A main", detail: "Take first contact alone." },
    { key: "B", title: "Flash, then trade in", detail: "Pair utility with spacing.", correct: true },
    { key: "C", title: "Wait for a solo lurk", detail: "Give defenders the clock." },
  ];
  return <DecisionShell game="valorant" eyebrow="VALORANT ROUND LENS · ROUND 07" title="Make first contact tradeable." prompt="Fifty-two seconds. One flash. Teammate is four metres back. How do you enter?" choices={choices} visual={<div className="val-map">
    <span className="val-site">A</span><span className="val-wall wall-a" /><span className="val-wall wall-b" /><span className="val-wall wall-c" /><span className="val-choke" />
    <i className="val-agent you">YOU</i><i className="val-agent mate">MATE</i><i className="val-agent enemy">?</i>
    <span className="val-flash"><i /> FLASH PATH</span><span className="val-trade">4.1m · TRADEABLE</span>
  </div>} />;
}

function GameSelectorExperience() {
  return <div className="experience-selector">
    <header><small>THREE GAMES · THREE EVIDENCE MODELS</small><strong>Choose the decisions you actually play.</strong></header>
    <div>
      <Link href="/league"><span>L</span><div><small>LEAGUE OF LEGENDS</small><b>Wave → vision → objective</b><p>Read the map before the fight.</p></div><i>→</i></Link>
      <Link href="/valorant"><span>V</span><div><small>VALORANT</small><b>Contact → trade → utility</b><p>Read the round before the duel.</p></div><i>→</i></Link>
      <Link href="/rocket-league"><span>RL</span><div><small>ROCKET LEAGUE</small><b>Spacing → boost → recovery</b><p>Read the rotation before the goal.</p></div><i>→</i></Link>
    </div>
    <footer>Shared method. Game-native evidence.</footer>
  </div>;
}

export default function GameHeroExperience({ game }: { game: GameKey }) {
  if (game === "rocket-league") return <ReplayArenaWalkthrough />;
  if (game === "league") return <LeagueLab />;
  if (game === "valorant") return <ValorantLab />;
  return <GameSelectorExperience />;
}
