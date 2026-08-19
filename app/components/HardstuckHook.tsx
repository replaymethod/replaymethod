"use client";

import { useState } from "react";

const patterns = [
  {
    label: "I arrive late",
    signal: "Your routes may be trading position for full boost.",
  },
  {
    label: "I overcommit",
    signal: "Your spacing may collapse before possession is secure.",
  },
  {
    label: "I run out of boost",
    signal: "The issue may be pathing rather than boost usage.",
  },
  {
    label: "I win but don’t climb",
    signal: "A repeated high-cost decision may be hidden inside average results.",
  },
] as const;

export default function HardstuckHook() {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <section className="hardstuck-hook" aria-labelledby="hardstuck-title">
      <div className="shell hardstuck-shell">
        <div className="hardstuck-copy">
          <span className="kicker">10-SECOND HARDSTUCK CHECK</span>
          <h2 id="hardstuck-title">What keeps happening in your losses?</h2>
          <p>Pick the pattern that feels familiar. Your replay tells us whether the hypothesis is actually true.</p>
        </div>

        <div className="hardstuck-game" role="group" aria-label="Choose a recurring match problem">
          <div className="hardstuck-options">
            {patterns.map((pattern, index) => (
              <button
                type="button"
                key={pattern.label}
                className={selected === index ? "active" : ""}
                onClick={() => setSelected(index)}
                aria-pressed={selected === index}
              >
                <span>0{index + 1}</span>
                {pattern.label}
              </button>
            ))}
          </div>

          <div className={`hardstuck-result ${selected !== null ? "revealed" : ""}`} aria-live="polite">
            <span>{selected === null ? "SELECT A PATTERN" : "POSSIBLE SIGNAL"}</span>
            <strong>
              {selected === null
                ? "One repeated decision can cost more rank than ten flashy mechanics gain."
                : patterns[selected].signal}
            </strong>
            <p>{selected === null ? "Choose one above." : "That is a hypothesis—not a diagnosis. The match evidence decides."}</p>
            <a href="#quick-replay">Test it on my replay →</a>
          </div>
        </div>
      </div>
    </section>
  );
}
