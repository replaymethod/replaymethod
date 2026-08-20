"use client";

import { useState } from "react";

const patterns = [
  {
    category: "TIMING",
    title: "Late to the moment",
    description: "I react after the key moment has already turned.",
    hypothesis: "Your replay may show setup decisions that leave you reacting after the key moment.",
  },
  {
    category: "COMMITMENT",
    title: "One commit too many",
    description: "I spend position or resources before the outcome is secure.",
    hypothesis: "Your replay may show position or resources being committed before the outcome is secure.",
  },
  {
    category: "OPTIONS",
    title: "No safe option left",
    description: "Earlier choices leave me with no useful next move.",
    hypothesis: "Your replay may show earlier pathing or resource choices removing the safest next play.",
  },
  {
    category: "RECURRENCE",
    title: "Same rank, same losses",
    description: "The result changes, but the same ceiling returns.",
    hypothesis: "Your replay may reveal a high-cost decision repeating even when the final result changes.",
  },
] as const;

const pressureContexts = [
  { key: "close", label: "Score is close", detail: "Pressure rises", phrase: "when the score is close" },
  { key: "mistake", label: "After one mistake", detail: "Decisions speed up", phrase: "after one mistake" },
  { key: "late", label: "Late in the session", detail: "Focus drops", phrase: "late in the session" },
] as const;

type HardstuckHookProps = {
  analysisHref?: string;
  onAnalysisStart?: () => void;
  onPatternSelect?: (pattern: number) => void;
  requestOnly?: boolean;
  intakeClosed?: boolean;
};

export default function HardstuckHook({
  analysisHref = "/analyze",
  onAnalysisStart,
  onPatternSelect,
  requestOnly = false,
  intakeClosed = false,
}: HardstuckHookProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [context, setContext] = useState<number | null>(null);
  const selectedPattern = selected === null ? null : patterns[selected];
  const selectedContext = context === null ? null : pressureContexts[context];
  const hypothesis = selectedPattern
    ? `${selectedPattern.title}${selectedContext ? ` · ${selectedContext.label}` : ""}`
    : "";
  const selectedAnalysisHref = selectedPattern && !analysisHref.startsWith("#")
    ? `${analysisHref}${analysisHref.includes("?") ? "&" : "?"}hypothesis=${encodeURIComponent(hypothesis)}`
    : analysisHref;

  return (
    <section className="hardstuck-hook" aria-labelledby="hardstuck-title">
      <div className="shell hardstuck-shell">
        <div className="hardstuck-copy">
          <span className="kicker">10-SECOND HARDSTUCK CHECK</span>
          <h2 id="hardstuck-title">What keeps happening in your losses?</h2>
          <p>Pick the closest pattern. Your replay decides whether the hypothesis is actually true.</p>
        </div>

        <div className="hardstuck-game">
          <fieldset className="hardstuck-options">
            <legend className="sr-only">Choose a recurring match problem</legend>
            {patterns.map((pattern, index) => {
              const isSelected = selected === index;

              return (
                <button
                  type="button"
                  key={pattern.title}
                  className={isSelected ? "active" : ""}
                  onClick={() => { setSelected(index); setContext(null); onPatternSelect?.(index + 1); }}
                  aria-pressed={isSelected}
                  aria-controls="hardstuck-result"
                >
                  <span className="hardstuck-option-number">0{index + 1}</span>
                  <span className="hardstuck-option-copy">
                    <small>{pattern.category}</small>
                    <strong>{pattern.title}</strong>
                    <span>{pattern.description}</span>
                  </span>
                  <span className="hardstuck-option-state" aria-hidden="true">
                    {isSelected ? "LOCK" : "→"}
                  </span>
                </button>
              );
            })}
          </fieldset>

          <div className="hardstuck-console" data-selected={selected ?? "idle"}>
            <div className="hardstuck-console-head">
              <span>HYPOTHESIS CONSOLE</span>
              <span className="hardstuck-console-status">
                <i aria-hidden="true" />
                {selected === null ? "WAITING FOR INPUT" : selectedContext ? "HYPOTHESIS ARMED" : `PATTERN 0${selected + 1} LOCKED`}
              </span>
            </div>

            <div className={`hypothesis-calibrator ${selectedPattern ? "ready" : ""}`}>
              <div><span>CALIBRATE THE HYPOTHESIS</span><b>{selectedPattern ? "When does it usually break?" : "Choose a pattern to unlock"}</b></div>
              <div role="group" aria-label="Choose when the pattern usually happens">
                {pressureContexts.map((item, index) => <button type="button" disabled={!selectedPattern} className={context === index ? "active" : ""} aria-pressed={context === index} onClick={() => setContext(index)} key={item.key}><span>0{index + 1}</span><b>{item.label}</b><small>{item.detail}</small></button>)}
              </div>
            </div>

            <div className="hardstuck-signal-map" aria-hidden="true">
              <span className="hardstuck-scanline" />
              <span className="hardstuck-signal-path" />
              {patterns.map((pattern, index) => (
              <span
                className={`hardstuck-signal-node ${selected === index ? "active" : ""}`}
                key={pattern.title}
                style={{ left: `${8 + index * 28}%` }}
              >
                  0{index + 1}
                </span>
              ))}
              <span className="hardstuck-signal-marker" />
            </div>

            <div
              id="hardstuck-result"
              className={`hardstuck-result ${selectedPattern ? "revealed" : ""}`}
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              <span>{selectedContext ? "HYPOTHESIS READY TO TEST" : selectedPattern ? "POSSIBLE SIGNAL" : "SELECT A RECURRING PATTERN"}</span>
              <strong>
                {selectedPattern
                  ? `${selectedPattern.hypothesis}${selectedContext ? ` You notice it most ${selectedContext.phrase}.` : ""}`
                  : "The match may contain a repeated decision your final score never shows."}
              </strong>
              <p>
                {selectedPattern
                  ? selectedContext ? "Locked as a test—not a diagnosis. The replay still has to support frequency, impact and counter-evidence." : "Add the pressure context, then let match evidence decide whether the pattern is real and worth fixing."
                  : "Choose the closest match. We will treat it as a hypothesis until the replay supports it."}
              </p>
            </div>

            <a className="hardstuck-cta" href={selectedAnalysisHref} onClick={onAnalysisStart}>
              {intakeClosed
                ? selectedPattern ? "Save this for replay beta access" : "Join the replay beta list"
                : requestOnly
                ? selectedPattern ? "Carry this into my Riot request" : "Save a Riot beta request"
                : selectedPattern ? "Test this in the replay beta" : "Start a replay evidence check"}
              <span aria-hidden="true">→</span>
            </a>
            <small className="hardstuck-trust">{intakeClosed ? "Quality gate in progress · no file · no card" : requestOnly ? "Official access pending · private request · no card" : "One real match · private status · no card"}</small>
          </div>
        </div>
      </div>
    </section>
  );
}
