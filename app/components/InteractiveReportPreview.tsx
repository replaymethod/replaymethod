"use client";

import { KeyboardEvent, useState } from "react";

type DemoTab = "diagnosis" | "plan" | "verify";

type PreviewConfig = {
  label: string;
  diagnosis: string;
  plan: string;
  evidence: string;
  rule: string;
  verify: string;
};

const tabs: Array<{ key: DemoTab; label: string; mission: string }> = [
  { key: "diagnosis", label: "Evidence", mission: "Inspect the moment" },
  { key: "plan", label: "One focus", mission: "Lock the queue rule" },
  { key: "verify", label: "Proof", mission: "Check the next matches" },
];

const moments = [
  { time: "3:42", label: "Lane collapse", detail: "Both cars enter the same channel while the safe layer behind the play disappears." },
  { time: "2:18", label: "Repeat signal", detail: "The same commitment shape returns after a neutral reset, increasing confidence that it is not a one-off." },
  { time: "0:54", label: "Counter-example", detail: "A deeper hold preserves two options. The report keeps this evidence so it does not overstate the pattern." },
] as const;

export default function InteractiveReportPreview({ config }: { config: PreviewConfig }) {
  const [tab, setTab] = useState<DemoTab>("diagnosis");
  const [moment, setMoment] = useState(0);
  const tabIndex = tabs.findIndex(item => item.key === tab);

  const moveTab = (event: KeyboardEvent<HTMLButtonElement>, current: DemoTab) => {
    const currentIndex = tabs.findIndex(item => item.key === current);
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (currentIndex + 1) % tabs.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = tabs.length - 1;
    else return;
    event.preventDefault();
    const next = tabs[nextIndex].key;
    setTab(next);
    document.getElementById(`demo-tab-${next}`)?.focus();
  };

  const advance = () => setTab(tabs[(tabIndex + 1) % tabs.length].key);

  return <div className="product-demo interactive-report">
    <div className="demo-sidebar">
      <span>EXAMPLE PLAYER REPORT</span><strong>{config.label}</strong>
      <div className="report-mission"><small>MISSION PROGRESS</small><b>{String(tabIndex + 1).padStart(2, "0")} / 03</b><i><span style={{ width: `${((tabIndex + 1) / 3) * 100}%` }} /></i></div>
      <div className="demo-tabs" role="tablist" aria-label="Example report views">
        {tabs.map((item, index) => <button id={`demo-tab-${item.key}`} role="tab" aria-selected={tab === item.key} aria-controls={`demo-panel-${item.key}`} tabIndex={tab === item.key ? 0 : -1} className={tab === item.key ? "active" : ""} onKeyDown={event => moveTab(event, item.key)} onClick={() => setTab(item.key)} key={item.key}><span>0{index + 1}</span><b>{item.label}</b><small>{item.mission}</small></button>)}
      </div>
      <small>Illustrative product preview—not a claimed player result.</small>
    </div>

    <div className="demo-main">
      {tab === "diagnosis" && <div className="demo-panel" id="demo-panel-diagnosis" role="tabpanel" aria-labelledby="demo-tab-diagnosis">
        <div className="demo-status"><span>PRIMARY PATTERN · EXAMPLE</span><b>Counter-evidence retained</b></div>
        <h3>{config.diagnosis}</h3><p>{config.evidence}</p>
        <div className="moment-player">
          <div className="moment-viewport" aria-hidden="true"><span className="moment-field-line" /><i className={`moment-ball m${moment}`} /><i className="moment-player-dot player" /><i className="moment-player-dot teammate" /><i className="moment-player-dot opponent" /><b>{moments[moment].time}</b></div>
          <div className="moment-copy" aria-live="polite"><small>EVIDENCE MOMENT {moment + 1}</small><strong>{moments[moment].label}</strong><p>{moments[moment].detail}</p></div>
        </div>
        <div className="moment-controls" role="group" aria-label="Choose an illustrative evidence moment">{moments.map((item, index) => <button type="button" className={moment === index ? "active" : ""} aria-pressed={moment === index} onClick={() => setMoment(index)} key={item.time}><span>{item.time}</span><b>{index === 2 ? "Counter" : `Signal 0${index + 1}`}</b></button>)}</div>
      </div>}

      {tab === "plan" && <div className="demo-panel" id="demo-panel-plan" role="tabpanel" aria-labelledby="demo-tab-plan">
        <div className="demo-status cyan"><span>NEXT-QUEUE MISSION</span><b>One focus. No overload.</b></div><h3>{config.rule}</h3><p>{config.plan}</p>
        <div className="focus-mission"><span>BEFORE QUEUE</span><b>Read the rule once.</b><i>30 sec</i></div>
        <div className="focus-mission"><span>IN MATCH</span><b>Recognize the decision; do not chase a score.</b><i>1 cue</i></div>
        <div className="focus-mission"><span>AFTER MATCH</span><b>Mark followed, missed or not applicable.</b><i>3 states</i></div>
      </div>}

      {tab === "verify" && <div className="demo-panel" id="demo-panel-verify" role="tabpanel" aria-labelledby="demo-tab-verify">
        <div className="demo-status green"><span>FOCUS TREND · EXAMPLE</span><b>Behavior before rank</b></div><h3>{config.verify}</h3><p>A rank graph alone cannot show whether the underlying habit changed. Replay Method checks the same supported decision first.</p>
        <div className="verify-quest"><div className="active"><span>01</span><b>Baseline</b><small>Signal found</small></div><i>→</i><div><span>02</span><b>Practice</b><small>Rule carried</small></div><i>→</i><div><span>03</span><b>Recheck</b><small>Compare evidence</small></div></div>
        <div className="verify-chart"><div><span>MATCH 01</span><b style={{ height: "34%" }}>34%</b></div><div><span>MATCH 02</span><b style={{ height: "51%" }}>51%</b></div><div><span>MATCH 03</span><b style={{ height: "72%" }}>72%</b></div></div><small className="demo-disclaimer">Example values for interaction only. Improvement is not guaranteed.</small>
      </div>}

      <button className="report-advance" type="button" onClick={advance}><span>{tabIndex === tabs.length - 1 ? "RESTART THE WALKTHROUGH" : `NEXT: ${tabs[tabIndex + 1].mission.toUpperCase()}`}</span><i>→</i></button>
    </div>
  </div>;
}
