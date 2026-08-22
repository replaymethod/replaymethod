"use client";

import { useEffect, useState } from "react";

const stages = [
  {
    label: "Verify",
    short: "File + player",
    title: "Prove the input belongs to a real match.",
    copy: "Format, match structure and exact player identity are checked before any gameplay claim is allowed.",
    metric: "INPUT BOUNDARY",
    value: "VERIFIED",
  },
  {
    label: "Map",
    short: "Build timeline",
    title: "Turn the replay into a decision timeline.",
    copy: "Ball, cars, boost, touches and match phases become inspectable state—not a generic score or chat prompt.",
    metric: "EVIDENCE LAYERS",
    value: "03",
  },
  {
    label: "Test",
    short: "Challenge patterns",
    title: "Try to disprove every candidate pattern.",
    copy: "Repeated decisions are tested with exclusions and counter-evidence. Weak signals stay private and inconclusive.",
    metric: "PUBLIC CLAIMS",
    value: "GATED",
  },
  {
    label: "Focus",
    short: "One next rule",
    title: "Ship one useful correction—or stop.",
    copy: "A supported finding becomes one queue rule and a measurable follow-up. Otherwise the report explains why it stopped.",
    metric: "PLAYER LOAD",
    value: "ONE FOCUS",
  },
] as const;

export default function InteractiveEvidencePipeline({ label }: { label: string }) {
  const [active, setActive] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    if (active >= stages.length - 1) {
      const done = window.setTimeout(() => setRunning(false), 650);
      return () => window.clearTimeout(done);
    }
    const timer = window.setTimeout(() => setActive(value => value + 1), 760);
    return () => window.clearTimeout(timer);
  }, [active, running]);

  const runWalkthrough = () => {
    setActive(0);
    setRunning(true);
  };

  const stage = stages[active];

  return <div className={`evidence-console interactive ${running ? "is-running" : ""}`}>
    <div className="evidence-console-head">
      <div><small>REPLAY METHOD · LIVE PRODUCT WALKTHROUGH</small><strong>{label}</strong></div>
      <span><i /> EVIDENCE GATED</span>
    </div>

    <div className="pipeline-arena" aria-hidden="true">
      <span className="pipeline-midline" />
      <span className="pipeline-goal left" />
      <span className="pipeline-goal right" />
      <i className="pipeline-ball" />
      <i className="pipeline-car one" />
      <i className="pipeline-car two" />
      <i className="pipeline-car three" />
      <span className="pipeline-scan" />
      <div className="pipeline-hud"><span>ILLUSTRATIVE FRAME</span><b>{String(active + 1).padStart(2, "0")} / 04</b></div>
    </div>

    <div className="evidence-route pipeline-tabs" role="tablist" aria-label="Explore the replay evidence pipeline">
      {stages.map((item, index) => <button
        type="button"
        role="tab"
        aria-selected={active === index}
        aria-controls="pipeline-stage-panel"
        className={active === index ? "active" : index < active ? "done" : ""}
        key={item.label}
        onClick={() => { setRunning(false); setActive(index); }}
      ><span>{String(index + 1).padStart(2, "0")}</span><b>{item.label}</b><small>{item.short}</small></button>)}
    </div>

    <div className="pipeline-stage-panel" id="pipeline-stage-panel" role="tabpanel" aria-live="polite">
      <div><span>{stage.metric}</span><b>{stage.value}</b></div>
      <section><small>STAGE {String(active + 1).padStart(2, "0")}</small><strong>{stage.title}</strong><p>{stage.copy}</p></section>
    </div>

    <button className="pipeline-run" type="button" onClick={runWalkthrough} disabled={running}>
      <span>{running ? "RUNNING EVIDENCE WALKTHROUGH" : active === stages.length - 1 ? "RUN AGAIN" : "RUN THE SAMPLE PIPELINE"}</span><i>{running ? `${Math.round(((active + 1) / stages.length) * 100)}%` : "→"}</i>
    </button>
    <small className="evidence-disclaimer">Interactive workflow preview. The arena and values illustrate product behavior, not a claimed player result.</small>
  </div>;
}
