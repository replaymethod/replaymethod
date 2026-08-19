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

type HardstuckHookProps = {
  analysisHref?: string;
  onAnalysisStart?: () => void;
};

export default function HardstuckHook({
  analysisHref = "/analyze",
  onAnalysisStart,
}: HardstuckHookProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const selectedPattern = selected === null ? null : patterns[selected];

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
                  onClick={() => setSelected(index)}
                  aria-pressed={isSelected}
                >
                  <span className="hardstuck-option-number">0{index + 1}</span>
                  <span className="hardstuck-option-copy">
                    <small>{pattern.category}</small>
                    <strong>{pattern.title}</strong>
                    <span>{pattern.description}</span>
                  </span>
                  <span className="hardstuck-option-state" aria-hidden="true">
                    {isSelected ? "✓" : "→"}
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
                {selected === null ? "WAITING FOR INPUT" : `PATTERN 0${selected + 1} LOCKED`}
              </span>
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
              className={`hardstuck-result ${selectedPattern ? "revealed" : ""}`}
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              <span>{selectedPattern ? "POSSIBLE SIGNAL" : "SELECT A RECURRING PATTERN"}</span>
              <strong>
                {selectedPattern
                  ? selectedPattern.hypothesis
                  : "The match may contain a repeated decision your final score never shows."}
              </strong>
              <p>
                {selectedPattern
                  ? "Hypothesis only. Match evidence decides whether it is real, frequent, and worth fixing."
                  : "Choose the closest match. We will treat it as a hypothesis until the replay supports it."}
              </p>
            </div>

            <a className="hardstuck-cta" href={analysisHref} onClick={onAnalysisStart}>
              {selectedPattern ? "Test this on my replay" : "Analyze my replay"}
              <span aria-hidden="true">→</span>
            </a>
            <small className="hardstuck-trust">One real match · private report · no card</small>
          </div>
        </div>
      </div>
    </section>
  );
}
