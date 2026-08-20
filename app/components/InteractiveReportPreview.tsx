"use client";

import { useMemo, useState } from "react";

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

export default function InteractiveReportPreview({ config }: { config: PreviewConfig }) {
  const rocketLeague = config.label === "Rocket League";
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [answer, setAnswer] = useState<AnswerState>(null);
  const [selectedMoment, setSelectedMoment] = useState(1);

  const copy = useMemo(() => ({
    question: [
      rocketLeague ? "Which freeze-frame shows the costly decision—not just the bad outcome?" : "Which moment contains the repeated decision—not just the final outcome?",
      "Which cue is short enough to recognize while you are actually playing?",
      "What is the honest conclusion after three comparison matches?",
    ][round],
    helper: [
      "Read teammate position, your lane and what remains uncovered.",
      "The best cue controls one behavior. It does not promise a rank result.",
      "Look for direction and sample size before claiming the habit is fixed.",
    ][round],
  }), [rocketLeague, round]);

  const moments = rocketLeague ? [
    { time: "3:42", label: "Goal conceded", note: "Visible outcome; the decision happened earlier.", correct: false, positions: "outcome" },
    { time: "3:47", label: "Coverage collapses", note: "Teammate commits and you enter the same lane.", correct: true, positions: "leak" },
    { time: "0:54", label: "Safe counter-example", note: "A deeper hold preserves two defensive options.", correct: false, positions: "counter" },
  ] : [
    { time: "12:18", label: "Final outcome", note: "The result is visible, but the decision happened earlier.", correct: false, positions: "outcome" },
    { time: "12:11", label: "Decision window", note: "The repeated choice appears before the outcome.", correct: true, positions: "leak" },
    { time: "18:04", label: "Counter-example", note: "A different choice preserves more options.", correct: false, positions: "counter" },
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
          <div className="review-field"><span className="review-half" /><span className="review-circle" /><span className="review-net left" /><span className="review-net right" /><i className="review-ball" /><i className="review-dot you">YOU</i><i className="review-dot mate">MATE</i><i className="review-dot rival">O1</i><i className="review-dot rival-two">O2</i><em>{moments[selectedMoment].time}</em></div>
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
