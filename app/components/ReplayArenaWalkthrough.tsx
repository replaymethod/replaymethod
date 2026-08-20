"use client";

import { CSSProperties, KeyboardEvent, PointerEvent, useRef, useState } from "react";

type Point = { x: number; y: number };

const missions = [
  { short: "BOOST", title: "Collect the small boost pad", detail: "Small pads keep you in the play without abandoning the net." },
  { short: "ROTATE", title: "Enter through back post", detail: "Take the far post first. You keep the play in front of your car." },
  { short: "CLEAR", title: "Meet the ball from the safe side", detail: "Drive through the ball. Your approach sends the clear away from your own goal." },
  { short: "PROOF", title: "Decision complete", detail: "Replay Method can now test whether this coverage choice repeats in real matches." },
] as const;

const targets = [{ x: 31, y: 70 }, { x: 12, y: 34 }, { x: 47, y: 47 }] as const;
const clamp = (value: number) => Math.max(6, Math.min(94, value));
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export default function ReplayArenaWalkthrough() {
  const fieldRef = useRef<HTMLDivElement>(null);
  const [player, setPlayer] = useState<Point>({ x: 18, y: 78 });
  const [heading, setHeading] = useState(-18);
  const [stage, setStage] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [boost, setBoost] = useState(21);
  const [mistakes, setMistakes] = useState(0);
  const [feedback, setFeedback] = useState("Drag the blue car through the glowing route. Arrow keys work too.");
  const [feedbackTone, setFeedbackTone] = useState<"neutral" | "good" | "warn">("neutral");

  const movePlayer = (point: Point) => {
    if (stage === 3) return;
    const next = { x: clamp(point.x), y: clamp(point.y) };
    const angle = Math.atan2(next.y - player.y, next.x - player.x) * (180 / Math.PI);
    if (Math.abs(next.x - player.x) + Math.abs(next.y - player.y) > 0.5) setHeading(angle);
    setPlayer(next);

    if (stage < 2 && distance(next, targets[2]) < 9) {
      setMistakes(value => value + 1);
      setFeedbackTone("warn");
      setFeedback("Too early: your teammate is already committed. Finish the cyan route before attacking the ball.");
      return;
    }

    if (distance(next, targets[stage]) >= (stage === 2 ? 10 : 8)) return;
    if (stage === 0) {
      setBoost(33);
      setStage(1);
      setFeedbackTone("good");
      setFeedback("+12 boost. You stayed close enough to defend—now rotate through the far post.");
    } else if (stage === 1) {
      setStage(2);
      setFeedbackTone("good");
      setFeedback("Back post secured. The play is in front of you; drive through the ball for a safe clear.");
    } else {
      setStage(3);
      setBoost(value => Math.max(0, value - 8));
      setFeedbackTone("good");
      setFeedback("Clean clear. One input became a measurable replay decision: boost path → coverage → outcome.");
    }
  };

  const pointFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = fieldRef.current?.getBoundingClientRect();
    if (!bounds) return null;
    return { x: ((event.clientX - bounds.left) / bounds.width) * 100, y: ((event.clientY - bounds.top) / bounds.height) * 100 };
  };

  const keyboardMove = (event: KeyboardEvent<HTMLButtonElement>) => {
    const delta = event.shiftKey ? 7 : 3;
    const directions: Record<string, Point> = {
      ArrowLeft: { x: -delta, y: 0 }, ArrowRight: { x: delta, y: 0 },
      ArrowUp: { x: 0, y: -delta }, ArrowDown: { x: 0, y: delta },
    };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    movePlayer({ x: player.x + direction.x, y: player.y + direction.y });
  };

  const reset = () => {
    setPlayer({ x: 18, y: 78 });
    setHeading(-18);
    setStage(0);
    setBoost(21);
    setMistakes(0);
    setFeedbackTone("neutral");
    setFeedback("Drag the blue car through the glowing route. Arrow keys work too.");
  };

  const carStyle = { left: `${player.x}%`, top: `${player.y}%`, "--car-angle": `${heading}deg` } as CSSProperties;

  return <div className="arcade-console">
    <header className="arcade-head">
      <div><small>PLAYABLE REPLAY LESSON · 2V2</small><strong>Back-post rescue</strong></div>
      <div className="arcade-score"><span className="blue">BLUE <b>{stage === 3 ? 1 : 0}</b></span><em>0:{String(Math.max(0, 18 - stage * 5)).padStart(2, "0")}</em><span>ORANGE <b>0</b></span></div>
    </header>

    <div className="arcade-objective"><span>OBJECTIVE</span><b>{missions[stage].title}</b><small>{stage < 3 ? `${stage + 1} / 3` : "CLEAR ✓"}</small></div>

    <div
      ref={fieldRef}
      className={`arcade-field arcade-stage-${stage} ${dragging ? "is-driving" : ""}`}
      onPointerMove={event => { if (dragging) { const point = pointFromPointer(event); if (point) movePlayer(point); } }}
      onPointerUp={event => { setDragging(false); event.currentTarget.releasePointerCapture?.(event.pointerId); }}
      onPointerCancel={() => setDragging(false)}
    >
      <span className="arcade-pitch-stripes" /><span className="arcade-half" /><span className="arcade-circle" />
      <span className="arcade-goal blue" /><span className="arcade-goal orange" />
      {[{ x: 31, y: 70 }, { x: 31, y: 30 }, { x: 69, y: 30 }, { x: 69, y: 70 }].map((pad, index) => <i className={`boost-pad ${index === 0 ? "mission-pad" : ""}`} style={{ left: `${pad.x}%`, top: `${pad.y}%` }} key={`${pad.x}-${pad.y}`} />)}
      <span className="arcade-route"><i /><i /><i /></span>
      {stage < 3 && <span className={`arcade-target target-${stage}`}><i>{stage + 1}</i><b>{missions[stage].short}</b></span>}
      <i className="arcade-ball"><span /></i>
      <button
        type="button"
        className="arcade-car player"
        aria-label="Blue car. Drag it through the glowing route or use the arrow keys."
        style={carStyle}
        onPointerDown={event => { setDragging(true); event.currentTarget.parentElement?.setPointerCapture?.(event.pointerId); }}
        onKeyDown={keyboardMove}
      ><span>YOU</span><i /></button>
      <i className="arcade-car blue-mate"><span>MATE</span><i /></i>
      <i className="arcade-car orange-one"><span>O1</span><i /></i>
      <i className="arcade-car orange-two"><span>O2</span><i /></i>
      <div className="arcade-boost"><span>BOOST</span><b>{boost}</b><i><em style={{ width: `${boost}%` }} /></i></div>
      {stage === 0 && <div className="arcade-start-hint"><b>DRAG TO DRIVE</b><span>Follow 1 → 2 → 3</span></div>}
      {stage === 3 && <div className="goal-burst"><i /><b>NICE CLEAR!</b><span>+100 decision score</span></div>}
    </div>

    <div className="arcade-steps" aria-label="Mission progress">
      {missions.slice(0, 3).map((mission, index) => <span className={index < stage ? "done" : index === stage ? "active" : ""} key={mission.short}><i>{index < stage ? "✓" : index + 1}</i><b>{mission.short}</b></span>)}
    </div>

    <div className={`arcade-feedback ${feedbackTone}`} aria-live="polite"><i>{feedbackTone === "warn" ? "!" : feedbackTone === "good" ? "✓" : "i"}</i><div><b>{missions[stage].detail}</b><p>{feedback}</p></div></div>

    <footer className="arcade-footer"><div><span>DECISION SCORE</span><b>{Math.max(0, stage * 100 - mistakes * 15)}</b><small>{mistakes ? `${mistakes} early challenge${mistakes === 1 ? "" : "s"}` : "Clean read so far"}</small></div><button type="button" onClick={reset}>{stage === 3 ? "PLAY AGAIN" : "RESET RUN"}<i>↻</i></button></footer>
  </div>;
}
