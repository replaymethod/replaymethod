"use client";

import { useMemo, useState } from "react";
import type { GameKey } from "./Landing";

type PreviewConfig = {
  label: string;
  diagnosis: string;
  plan: string;
  evidence: string;
  rule: string;
  verify: string;
};

type AnswerState = { round: number; choice: number; correct: boolean } | null;

const roundNames = ["SPOT THE LEAK", "LOCK THE CUE", "READ THE PROOF"] as const;

export default function InteractiveReportPreview({ config, game }: { config: PreviewConfig; game: GameKey }) {
  const rocketLeague = game === "rocket-league";
  const league = game === "league";
  const valorant = game === "valorant";
  const gameClass = rocketLeague ? "rocket-league" : league ? "league" : valorant ? "valorant" : "general";
  const playerLabels = rocketLeague ? ["YOU", "MATE", "O1", "O2"] : league ? ["YOU", "JG", "MID", "FOG"] : valorant ? ["YOU", "MATE", "DEF", "?"] : ["YOU", "ALLY", "RIVAL", "?"];
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [answer, setAnswer] = useState<AnswerState>(null);
  const [selectedMoment, setSelectedMoment] = useState(1);

  const copy = useMemo(() => ({
    question: [
      rocketLeague ? "Which freeze-frame shows the costly decision—not just the bad outcome?" : league ? "Where did the objective setup actually break?" : valorant ? "Which moment made first contact impossible to trade?" : "Which moment created the repeated loss—not just the final result?",
      "Which cue is short enough to recognize while you are actually playing?",
      "What is the honest conclusion after three comparison matches?",
    ][round],
    helper: [
      rocketLeague ? "Read teammate position, your lane and what remains uncovered." : league ? "Read the wave, river vision and objective clock." : valorant ? "Read spacing, utility and the contact lane." : "Read the available options, ally state and what disappears next.",
      "The best cue controls one behavior. It does not promise a rank result.",
      "Look for direction and sample size before claiming the habit is fixed.",
    ][round],
  }), [league, rocketLeague, round, valorant]);

  const moments = rocketLeague ? [
    { time: "3:42", label: "Goal conceded", note: "Visible outcome; the decision happened earlier.", correct: false, positions: "outcome" },
    { time: "3:47", label: "Coverage collapses", note: "Teammate commits and you enter the same lane.", correct: true, positions: "leak" },
    { time: "0:54", label: "Safe counter-example", note: "A deeper hold preserves two defensive options.", correct: false, positions: "counter" },
  ] : league ? [
    { time: "18:21", label: "Dragon lost", note: "Visible outcome; setup failed before the fight.", correct: false, positions: "outcome" },
    { time: "17:42", label: "Priority spent top", note: "The pushed wave never becomes river vision.", correct: true, positions: "leak" },
    { time: "24:08", label: "Clean setup", note: "Reset timing creates vision before the objective.", correct: false, positions: "counter" },
  ] : valorant ? [
    { time: "R7 · 0:46", label: "First death", note: "Visible outcome; the isolated contact began earlier.", correct: false, positions: "outcome" },
    { time: "R7 · 0:52", label: "Trade gap opens", note: "You cross the choke four metres ahead of support.", correct: true, positions: "leak" },
    { time: "R10 · 0:39", label: "Supported entry", note: "Utility lands as the second player closes the gap.", correct: false, positions: "counter" },
  ] : [
    { time: "04:12", label: "Visible loss", note: "The scoreboard changes after the key decision has passed.", correct: false, positions: "outcome" },
    { time: "04:18", label: "Options collapse", note: "One early commitment removes the safe follow-up.", correct: true, positions: "leak" },
    { time: "11:06", label: "Clean counter", note: "A patient choice preserves two useful next actions.", correct: false, positions: "counter" },
  ];

  const choices = round === 1 ? [
    { title: "Play faster and force the next opening.", detail: "Vague, emotional and difficult to measure.", correct: false },
    { title: config.rule, detail: "One trigger, one action and a visible replay outcome.", correct: true },
    { title: "Win three games before changing anything.", detail: "Rank is noisy and does not isolate the behavior.", correct: false },
  ] : [
    { title: "The problem is permanently fixed.", detail: "Three matches cannot support a permanent claim.", correct: false },
    { title: "The behavior is improving; keep the cue and collect more evidence.", detail: "Direction is positive, while confidence is still limited.", correct: true },
    { title: "The cue failed because match two was worse.", detail: "One noisy match should not erase the full comparison.", correct: false },
  ];

  const choose = (choice: number, correct: boolean) => {
    if (answer?.round === round) return;
    setAnswer({ round, choice, correct });
    if (correct) setScore(value => value + 100);
  };

  const next = () => {
    if (round === 2) {
      setRound(0);
      setScore(0);
      setAnswer(null);
      setSelectedMoment(1);
      return;
    }
    setRound(value => value + 1);
    setAnswer(null);
  };

  const feedback = answer ? answer.correct
    ? ["Correct. You selected the decision window before the result.", "Locked. The cue is specific, playable and measurable.", "Correct. The trend supports continued testing—not a victory claim."][round]
    : ["Not quite. Rewind to the moment where coverage disappears.", "Too broad. Choose the cue with one trigger and one visible action.", "That conclusion outruns the evidence. Use the cautious trend statement."][round]
    : "Choose one answer to reveal how Replay Method reasons.";

  return <div className="review-game">
    <header className="review-game-head"><div><small>EXAMPLE PLAYER REPORT · PLAYABLE</small><strong>Replay review challenge</strong></div><div className="review-score"><span>SCORE</span><b>{String(score).padStart(3, "0")}</b></div></header>

    <div className="review-rounds">{roundNames.map((name, index) => <span className={index < round ? "done" : index === round ? "active" : ""} key={name}><i>{index < round ? "✓" : index + 1}</i><b>{name}</b></span>)}</div>

    <section className="review-stage">
      <div className="review-prompt"><span>ROUND {round + 1} / 3 · {roundNames[round]}</span><h3>{copy.question}</h3><p>{copy.helper}</p></div>

      {round === 0 && <>
        <div className={`review-replay-frame state-${moments[selectedMoment].positions}`}>
          <div className={`review-field ${gameClass}`}><span className="review-half" /><span className="review-circle" /><span className="review-net left" /><span className="review-net right" />{rocketLeague ? <i className="review-ball" /> : league ? <i className="review-objective">DRG</i> : valorant ? <i className="review-site">A</i> : <i className="review-objective">READ</i>}<i className="review-dot you">{playerLabels[0]}</i><i className="review-dot mate">{playerLabels[1]}</i><i className="review-dot rival">{playerLabels[2]}</i><i className="review-dot rival-two">{playerLabels[3]}</i><em>{moments[selectedMoment].time}</em></div>
          <div><small>FREEZE FRAME</small><b>{moments[selectedMoment].label}</b><p>{moments[selectedMoment].note}</p></div>
        </div>
        <div className="review-moment-choices">{moments.map((moment, index) => <button type="button" className={`${selectedMoment === index ? "selected" : ""} ${answer?.choice === index ? answer.correct ? "correct" : "wrong" : ""}`} onClick={() => { setSelectedMoment(index); choose(index, moment.correct); }} key={moment.time}><span>{moment.time}</span><b>{moment.label}</b><small>{index === 1 ? "DECISION" : index === 2 ? "COUNTER" : "OUTCOME"}</small></button>)}</div>
      </>}

      {round === 1 && <div className="cue-choices">{choices.map((choice, index) => <button type="button" className={answer?.choice === index ? answer.correct ? "correct" : "wrong" : ""} onClick={() => choose(index, choice.correct)} key={choice.title}><i>{String.fromCharCode(65 + index)}</i><div><b>{choice.title}</b><small>{choice.detail}</small></div></button>)}</div>}

      {round === 2 && <>
        <div className="proof-match-grid">{[
          { match: "01", value: 34, label: "Baseline", state: "Signal found" },
          { match: "02", value: 29, label: "Practice", state: "Mixed evidence" },
          { match: "03", value: 18, label: "Recheck", state: "Fewer repeats" },
        ].map(item => <div key={item.match}><span>MATCH {item.match}</span><div><i style={{ height: `${item.value * 2}%` }} /><b>{item.value}%</b></div><strong>{item.label}</strong><small>{item.state}</small></div>)}</div>
        <div className="proof-choices">{choices.map((choice, index) => <button type="button" className={answer?.choice === index ? answer.correct ? "correct" : "wrong" : ""} onClick={() => choose(index, choice.correct)} key={choice.title}><i>{String.fromCharCode(65 + index)}</i><b>{choice.title}</b></button>)}</div>
      </>}
    </section>

    <div className={`review-feedback ${answer ? answer.correct ? "good" : "warn" : ""}`} aria-live="polite"><i>{answer ? answer.correct ? "+100" : "TRY" : "?"}</i><div><b>{feedback}</b><small>{answer?.correct ? round === 0 ? config.diagnosis : round === 1 ? config.plan : config.verify : config.evidence}</small></div></div>

    <footer className="review-game-footer"><small>Illustrative challenge—never a diagnosis or rank guarantee.</small><button type="button" disabled={!answer?.correct} onClick={next}>{round === 2 ? "PLAY AGAIN" : "NEXT ROUND"}<i>→</i></button></footer>
  </div>;
}
