"use client";

import { CSSProperties, useEffect, useMemo, useState } from "react";

type Read = "challenge" | "rotate" | "boost";

const reads: { id: Read; key: string; title: string; detail: string }[] = [
  { id: "challenge", key: "A", title: "Challenge now", detail: "Attack before the opponent settles." },
  { id: "rotate", key: "B", title: "Rotate through back post", detail: "Preserve the net and two useful options." },
  { id: "boost", key: "C", title: "Leave for corner boost", detail: "Trade coverage for a full tank." },
];

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export default function ReplayArenaWalkthrough() {
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [read, setRead] = useState<Read | null>(null);
  const [evidence, setEvidence] = useState(true);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setFrame(value => {
        const next = clamp(value + 1);
        if (next >= 72) setPlaying(false);
        return next;
      });
    }, 72);
    return () => window.clearInterval(timer);
  }, [playing]);

  const decisionReady = frame >= 58;
  const correct = read === "rotate";
  const phase = frame < 30 ? "BUILDUP" : frame < 58 ? "PRESSURE" : frame < 76 ? "DECISION WINDOW" : "OUTCOME";
  const clock = useMemo(() => {
    const seconds = Math.max(0, 247 - Math.round(frame * .15));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }, [frame]);

  const restart = () => {
    setFrame(0);
    setRead(null);
    setLocked(false);
    setPlaying(true);
  };

  const choose = (choice: Read) => {
    setPlaying(false);
    setFrame(value => Math.max(value, 68));
    setRead(choice);
    setLocked(false);
  };

  const positions = {
    you: { left: `${22 + frame * .24}%`, top: `${78 - frame * .27}%` },
    mate: { left: `${39 + frame * .13}%`, top: `${38 + frame * .03}%` },
    o1: { left: `${64 - frame * .07}%`, top: `${37 + frame * .05}%` },
    o2: { left: `${76 - frame * .05}%`, top: `${67 - frame * .08}%` },
    ball: { left: `${58 - frame * .045}%`, top: `${44 + frame * .015}%` },
  } satisfies Record<string, CSSProperties>;

  return <div className={`replay-lens ${locked ? "is-locked" : ""}`}>
    <header className="lens-head">
      <div><small>INTERACTIVE REPLAY LENS · ILLUSTRATIVE MATCH</small><strong>Find the decision before the goal.</strong></div>
      <div className="lens-live"><i /> ANALYSIS PREVIEW</div>
    </header>

    <div className="lens-workspace">
      <div className="lens-stage">
        <div className="lens-stage-top">
          <span><i>{phase}</i><b>{clock}</b></span>
          <button type="button" className={evidence ? "active" : ""} aria-pressed={evidence} onClick={() => setEvidence(value => !value)}><i /> EVIDENCE LAYER</button>
        </div>

        <div className={`lens-field ${evidence ? "show-evidence" : ""}`}>
          <span className="lens-stripes" /><span className="lens-midline" /><span className="lens-circle" />
          <span className="lens-net blue" /><span className="lens-net orange" />
          <span className="lens-danger"><i /> NET COVERAGE</span>
          <span className="lens-lane lane-you" /><span className="lens-lane lane-mate" />
          <i className="lens-ball" style={positions.ball}><span /></i>
          <i className="lens-car you" style={positions.you}><span>YOU</span></i>
          <i className="lens-car mate" style={positions.mate}><span>MATE</span></i>
          <i className="lens-car rival one" style={positions.o1}><span>O1</span></i>
          <i className="lens-car rival two" style={positions.o2}><span>O2</span></i>
          {decisionReady && <div className="lens-freeze"><i /> DECISION FOUND · 0.7s BEFORE COMMIT</div>}
        </div>

        <div className="lens-transport">
          <button type="button" aria-label={playing ? "Pause replay" : "Play replay"} onClick={() => { if (frame >= 100) setFrame(0); setPlaying(value => !value); }}>{playing ? "Ⅱ" : "▶"}</button>
          <span>{clock}</span>
          <div><input type="range" min="0" max="100" value={frame} aria-label="Replay timeline" onChange={event => { setPlaying(false); setRead(null); setLocked(false); setFrame(Number(event.target.value)); }} style={{ "--lens-progress": `${frame}%` } as CSSProperties} /><i className="setup" /><i className="decision" /><i className="goal" /></div>
          <button type="button" aria-label="Restart replay" onClick={restart}>↻</button>
        </div>
        <div className="lens-timeline-labels"><span>SETUP</span><span>TEAMMATE COMMITS</span><span>GOAL</span></div>
      </div>

      <aside className="lens-readout">
        <div className="lens-readout-head"><span>REPLAY METHOD READ</span><b>{locked ? "CUE LOCKED" : decisionReady ? "YOUR DECISION" : "SCANNING MATCH"}</b><small>{locked ? "Ready for next queue" : decisionReady ? "Choose the safest next action" : "Press play. We stop before the outcome."}</small></div>

        <div className="lens-signals">
          <div><span>LANE OVERLAP</span><b className={decisionReady ? "warn" : ""}>{decisionReady ? "HIGH" : "—"}</b><i><em style={{ width: decisionReady ? "84%" : "18%" }} /></i></div>
          <div><span>NET COVERAGE</span><b className={decisionReady ? "warn" : ""}>{decisionReady ? "OPEN" : "—"}</b><i><em style={{ width: decisionReady ? "27%" : "74%" }} /></i></div>
          <div><span>YOUR BOOST</span><b>{decisionReady ? "41" : "—"}</b><i><em style={{ width: decisionReady ? "41%" : "50%" }} /></i></div>
        </div>

        {!decisionReady ? <button type="button" className="lens-start" onClick={restart}><span>PLAY THE 8-SECOND REPLAY</span><i>▶</i></button> : <div className="lens-choices">
          {reads.map(choice => <button type="button" className={read === choice.id ? choice.id === "rotate" ? "correct" : "wrong" : ""} onClick={() => choose(choice.id)} key={choice.id}><i>{choice.key}</i><div><b>{choice.title}</b><small>{choice.detail}</small></div></button>)}
        </div>}

        {read && <div className={`lens-result ${correct ? "correct" : "wrong"}`} aria-live="polite"><span>{correct ? "CLEAN READ" : "REWIND"}</span><b>{correct ? "You preserve two options instead of duplicating the commit." : read === "challenge" ? "Your teammate is already on the ball. A second challenge removes the last defender." : "Forty-one boost is enough. Leaving the net is the expensive trade."}</b>{correct && !locked && <button type="button" onClick={() => setLocked(true)}>LOCK NEXT-MATCH CUE <i>→</i></button>}{locked && <p><i>✓</i> When teammate crosses the ball line, hold back post until the play resets.</p>}</div>}
      </aside>
    </div>

    <footer className="lens-footer"><span><i>01</i> WATCH THE SETUP</span><span><i>02</i> MAKE THE READ</span><span><i>03</i> LOCK ONE CUE</span><b>Outcome ≠ decision</b></footer>
  </div>;
}
