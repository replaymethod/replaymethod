"use client";

import { KeyboardEvent, PointerEvent, useRef, useState } from "react";

type Point = { x: number; y: number };
type Read = "challenge" | "shadow" | "rotate" | null;

const steps = ["Create the moment", "Make the read", "Train the correction", "Prove the change"] as const;

const clamp = (value: number) => Math.max(7, Math.min(93, value));

export default function ReplayArenaWalkthrough() {
  const fieldRef = useRef<HTMLDivElement>(null);
  const [player, setPlayer] = useState<Point>({ x: 25, y: 68 });
  const [step, setStep] = useState(0);
  const [read, setRead] = useState<Read>(null);
  const [dragging, setDragging] = useState(false);
  const [proofRunning, setProofRunning] = useState(false);
  const [message, setMessage] = useState("Drag the highlighted blue car toward the ball. Touch and keyboard work too.");

  const movePlayer = (point: Point) => {
    const next = { x: clamp(point.x), y: clamp(point.y) };
    setPlayer(next);
    if (step === 0 && next.x > 42) {
      setStep(1);
      setMessage("Moment captured: your teammate is already committed. Choose the next read.");
    }
    if (step >= 2 && next.x < 36 && next.y > 62) {
      setStep(3);
      setMessage("Safe layer restored. Replay Method can now compare this decision in later matches.");
    }
  };

  const pointFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = fieldRef.current?.getBoundingClientRect();
    if (!bounds) return null;
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * 100,
      y: ((event.clientY - bounds.top) / bounds.height) * 100,
    };
  };

  const chooseRead = (choice: Exclude<Read, null>) => {
    setRead(choice);
    setStep(2);
    if (choice === "challenge") setMessage("Counter-evidence flags the dive: both blue cars attack the same ball. Now drag back into the cyan target.");
    if (choice === "shadow") setMessage("Shadowing preserves time, but the support lane is still narrow. Drag into the cyan target to restore coverage.");
    if (choice === "rotate") setMessage("Best-supported read: rotate behind the play. Drag into the cyan target to lock the correction.");
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

  const runProof = () => {
    setProofRunning(true);
    setMessage("Replaying the corrected shape across the next matches…");
    setPlayer({ x: 52, y: 49 });
    window.setTimeout(() => setPlayer({ x: 41, y: 60 }), 420);
    window.setTimeout(() => setPlayer({ x: 29, y: 72 }), 840);
    window.setTimeout(() => {
      setProofRunning(false);
      setMessage("Proof loop complete: coverage held in the example recheck. Real reports only say this when replay evidence supports it.");
    }, 1280);
  };

  const reset = () => {
    setPlayer({ x: 25, y: 68 });
    setStep(0);
    setRead(null);
    setProofRunning(false);
    setMessage("Drag the highlighted blue car toward the ball. Touch and keyboard work too.");
  };

  return <div className="arena-console">
    <div className="arena-console-head">
      <div><small>REPLAY METHOD · PLAYABLE PRODUCT WALKTHROUGH</small><strong>2v2 decision lab</strong></div>
      <span><i /> ROCKET LEAGUE ENGINE</span>
    </div>

    <div
      ref={fieldRef}
      className={`decision-field step-${step} ${dragging ? "is-dragging" : ""} ${proofRunning ? "is-proving" : ""}`}
      onPointerMove={event => { if (dragging) { const point = pointFromPointer(event); if (point) movePlayer(point); } }}
      onPointerUp={event => { setDragging(false); event.currentTarget.releasePointerCapture?.(event.pointerId); }}
      onPointerCancel={() => setDragging(false)}
    >
      <span className="field-half" /><span className="field-circle" /><span className="field-goal left" /><span className="field-goal right" />
      <span className="field-zone blue" /><span className="field-zone red" />
      {step >= 2 && <span className="rotation-target"><b>SAFE LAYER</b><small>DRAG HERE</small></span>}
      <i className="arena-ball" />
      <button
        type="button"
        className="arena-car blue controlled"
        aria-label="Controlled blue car. Drag it or use the arrow keys."
        style={{ left: `${player.x}%`, top: `${player.y}%` }}
        onPointerDown={event => { setDragging(true); event.currentTarget.parentElement?.setPointerCapture?.(event.pointerId); }}
        onKeyDown={keyboardMove}
      ><span>YOU</span></button>
      <i className="arena-car blue teammate"><span>B2</span></i>
      <i className="arena-car red opponent-one"><span>R1</span></i>
      <i className="arena-car red opponent-two"><span>R2</span></i>
      <span className="decision-vector" />
      <div className="field-hud"><span>BLUE 0</span><b>4:18</b><span>0 RED</span></div>
    </div>

    <div className="arena-progress" aria-label="Walkthrough progress">
      {steps.map((label, index) => <button type="button" className={index === step ? "active" : index < step ? "done" : ""} onClick={() => setStep(index)} key={label}><span>0{index + 1}</span><b>{label}</b></button>)}
    </div>

    <div className="arena-mission" aria-live="polite">
      <div><small>MISSION 0{step + 1}</small><strong>{steps[step]}</strong><p>{message}</p></div>
      <b>{step === 0 ? "DRAG" : step === 1 ? "READ" : step === 2 ? "ROTATE" : "PROOF"}</b>
    </div>

    {step === 1 && <div className="read-actions" role="group" aria-label="Choose the next illustrative action">
      <button type="button" className={read === "challenge" ? "selected" : ""} aria-pressed={read === "challenge"} onClick={() => chooseRead("challenge")}><span>01</span><b>Challenge</b><small>Fast, but duplicates coverage</small></button>
      <button type="button" className={read === "shadow" ? "selected" : ""} aria-pressed={read === "shadow"} onClick={() => chooseRead("shadow")}><span>02</span><b>Shadow</b><small>Preserve time and options</small></button>
      <button type="button" className={read === "rotate" ? "selected" : ""} aria-pressed={read === "rotate"} onClick={() => chooseRead("rotate")}><span>03</span><b>Rotate behind</b><small>Restore the safe layer</small></button>
    </div>}

    <div className="arena-footer">
      <button type="button" onClick={step === 3 ? runProof : reset} disabled={proofRunning}><span>{step === 3 ? proofRunning ? "RUNNING PROOF LOOP" : "RUN THE PROOF LOOP" : "RESET THE PLAY"}</span><i>→</i></button>
      <small>Playable example—not a claimed diagnosis. Real coaching remains evidence gated.</small>
    </div>
  </div>;
}
