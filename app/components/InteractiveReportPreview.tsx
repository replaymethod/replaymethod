"use client";

import { KeyboardEvent, useEffect, useState } from "react";

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
  const [scrub, setScrub] = useState(18);
  const [playing, setPlaying] = useState(false);
  const [missionChecks, setMissionChecks] = useState([false, false, false]);
  const [proofMatch, setProofMatch] = useState(0);
  const tabIndex = tabs.findIndex(item => item.key === tab);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setScrub(value => {
      const next = Math.min(100, value + 4);
      setMoment(next < 38 ? 0 : next < 72 ? 1 : 2);
      if (next === 100) setPlaying(false);
      return next;
    }), 90);
    return () => window.clearInterval(timer);
  }, [playing]);

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
        <div className="report-scrubber"><button type="button" onClick={() => { if (scrub >= 100) setScrub(0); setPlaying(value => !value); }} aria-pressed={playing}>{playing ? "PAUSE" : scrub >= 100 ? "REPLAY" : "PLAY"}</button><input aria-label="Scrub the illustrative replay" type="range" min="0" max="100" value={scrub} onChange={event => { const value = Number(event.target.value); setPlaying(false); setScrub(value); setMoment(value < 38 ? 0 : value < 72 ? 1 : 2); }} /><b>{String(Math.round(scrub)).padStart(2, "0")}%</b></div>
        <div className="moment-controls" role="group" aria-label="Choose an illustrative evidence moment">{moments.map((item, index) => <button type="button" className={moment === index ? "active" : ""} aria-pressed={moment === index} onClick={() => { setMoment(index); setScrub([18, 54, 86][index]); setPlaying(false); }} key={item.time}><span>{item.time}</span><b>{index === 2 ? "Counter" : `Signal 0${index + 1}`}</b></button>)}</div>
      </div>}

      {tab === "plan" && <div className="demo-panel" id="demo-panel-plan" role="tabpanel" aria-labelledby="demo-tab-plan">
        <div className="demo-status cyan"><span>NEXT-QUEUE MISSION</span><b>One focus. No overload.</b></div><h3>{config.rule}</h3><p>{config.plan}</p>
        {[["BEFORE QUEUE", "Read the rule once.", "30 sec"], ["IN MATCH", "Recognize the decision; do not chase a score.", "1 cue"], ["AFTER MATCH", "Mark followed, missed or not applicable.", "3 states"]].map((mission, index) => <button type="button" className={`focus-mission ${missionChecks[index] ? "completed" : ""}`} aria-pressed={missionChecks[index]} onClick={() => setMissionChecks(values => values.map((value, itemIndex) => itemIndex === index ? !value : value))} key={mission[0]}><span>{mission[0]}</span><b>{mission[1]}</b><i>{missionChecks[index] ? "DONE ✓" : mission[2]}</i></button>)}
        <div className="focus-progress"><span><i style={{ width: `${(missionChecks.filter(Boolean).length / 3) * 100}%` }} /></span><b>{missionChecks.filter(Boolean).length} / 3 mission actions locked</b></div>
      </div>}

      {tab === "verify" && <div className="demo-panel" id="demo-panel-verify" role="tabpanel" aria-labelledby="demo-tab-verify">
        <div className="demo-status green"><span>FOCUS TREND · EXAMPLE</span><b>Behavior before rank</b></div><h3>{config.verify}</h3><p>A rank graph alone cannot show whether the underlying habit changed. Replay Method checks the same supported decision first.</p>
        <div className="verify-quest">{[["01", "Baseline", "Signal found"], ["02", "Practice", "Rule carried"], ["03", "Recheck", "Compare evidence"]].map((item, index) => <span className={proofMatch === index ? "active" : ""} key={item[0]}><button type="button" onClick={() => setProofMatch(index)}><em>{item[0]}</em><b>{item[1]}</b><small>{item[2]}</small></button>{index < 2 && <i>→</i>}</span>)}</div>
        <div className="proof-readout" aria-live="polite"><span>SELECTED MATCH 0{proofMatch + 1}</span><b>{["Baseline mapped: the duplicate-commit signal appears in 34% of supported windows.", "Practice carried: the queue rule is visible, but coverage still breaks under pressure.", "Recheck: safe-layer coverage holds more often in this illustrative comparison."][proofMatch]}</b></div>
        <div className="verify-chart">{[34, 51, 72].map((value, index) => <button type="button" className={proofMatch === index ? "active" : ""} onClick={() => setProofMatch(index)} aria-label={`Inspect illustrative match ${index + 1}, ${value} percent`} key={value}><span>MATCH 0{index + 1}</span><b style={{ height: `${value}%` }}>{value}%</b></button>)}</div><small className="demo-disclaimer">Example values for interaction only. Improvement is not guaranteed.</small>
      </div>}

      <button className="report-advance" type="button" onClick={advance}><span>{tabIndex === tabs.length - 1 ? "RESTART THE WALKTHROUGH" : `NEXT: ${tabs[tabIndex + 1].mission.toUpperCase()}`}</span><i>→</i></button>
    </div>
  </div>;
}
