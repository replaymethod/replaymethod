"use client";

import { useEffect, useRef, useState } from "react";
import { trackProductEvent, type AnalyticsGame } from "../../lib/client-analytics";

type PaidPlan = "quarterly" | "monthly";

const plans: Array<{
  key: PaidPlan;
  number: string;
  eyebrow: string;
  price: string;
  period: string;
  equivalent: string;
  saving: string;
  fit: string;
  cta: string;
  featured?: boolean;
}> = [
  {
    key: "quarterly",
    number: "02",
    eyebrow: "3-MONTH CYCLE",
    price: "$27",
    period: "every 3 months",
    equivalent: "$9/month effective · $27 charged today and at renewal",
    saving: "Save $9 vs three monthly payments (25%)",
    fit: "For giving one focused change enough matches to become measurable.",
    cta: "Choose the 3-month cycle →",
    featured: true,
  },
  {
    key: "monthly",
    number: "03",
    eyebrow: "MONTH TO MONTH",
    price: "$12",
    period: "per month",
    equivalent: "$12 charged today and monthly",
    saving: "Maximum flexibility",
    fit: "For continuing the improvement loop without a longer commitment.",
    cta: "Choose monthly →",
  },
];

const paidFeatures = [
  "4 completed analyses every 30 days",
  "Cross-match pattern memory",
  "Automatic focus follow-up",
  "Progress proof over time",
  "Unused analyses do not roll over",
];

export default function PricingLadder({ analysisHref, game, requestOnly = false }: { analysisHref: string; game: AnalyticsGame; requestOnly?: boolean }) {
  const [loading, setLoading] = useState<PaidPlan | null>(null);
  const [error, setError] = useState("");
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("checkout") === "canceled") {
      const timer = window.setTimeout(() => setError("Checkout canceled. No plan was started and no charge was made."), 0);
      return () => window.clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      trackProductEvent("pricing_viewed", game, "pricing_section");
      observer.disconnect();
    }, { threshold: .25 });
    observer.observe(section);
    return () => observer.disconnect();
  }, [game]);

  async function checkout(plan: PaidPlan) {
    trackProductEvent("upgrade_intent", game, `pricing_${plan}`);
    setLoading(plan);
    setError("");

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const payload = await response.json().catch(() => ({})) as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error || "Secure checkout is not available yet.");
      trackProductEvent("checkout_started", game, `pricing_${plan}`);
      window.location.assign(payload.url);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Secure checkout is not available yet.");
      setLoading(null);
    }
  }

  return (
    <section ref={sectionRef} className="pricing-ladder shell" id="pricing" aria-labelledby="pricing-title">
      <div className="pricing-heading">
        <span className="kicker">START WITH PROOF. PAY ONLY TO CONTINUE.</span>
        <h2 id="pricing-title">{requestOnly ? "Official access first. Payment comes later." : "One supported diagnosis first. Then choose your pace."}</h2>
        <p>{requestOnly ? "League and VALORANT paid access cannot begin until official opt-in ingestion is active. You can preserve a free beta request without a card today." : "The first completed, full-quality analysis is free with no card. Paid plans use the same evidence standard and add frequency, private history and progress checks."}</p>
      </div>

      <div className="pricing-grid">
        <a className="pricing-card free" href={analysisHref} aria-label={requestOnly ? "Save a free Riot access beta request" : "Start one free Replay Method evidence check"}>
          <div className="pricing-rank"><span>01</span>START WITH PROOF</div>
          <div className="pricing-price"><b>$0</b><span>{requestOnly ? "access request" : "first evidence check"}</span></div>
          <p className="pricing-equivalent">{requestOnly ? "Private request · no card · no renewal" : "Verified outcome · no card · no renewal"}</p>
          <strong className="pricing-saving">{requestOnly ? "Official ingestion remains pending" : "Experience the quality standard first"}</strong>
          <p className="pricing-fit">{requestOnly ? "Preserve your opt-in interest without pretending a public profile is authorized match evidence." : "Receive a report only when one real match supports a reliable finding; otherwise see the honest blocked state."}</p>
          <ul>
            {requestOnly ? <><li>Private beta request</li><li>Game and goal context</li><li>Official-access boundary</li><li>Recoverable status link</li></> : <><li>Evidence-gated report</li><li>One supported primary finding</li><li>One next-queue rule</li><li>Private report history</li></>}
          </ul>
          <strong className="pricing-free-cta">{requestOnly ? "Save my beta request →" : "Start my evidence check →"}</strong>
        </a>

        {plans.map(plan => (
          <article className={`pricing-card ${plan.featured ? "featured" : ""}`} key={plan.key} aria-busy={loading === plan.key}>
            <div className="pricing-rank"><span>{plan.number}</span>{plan.eyebrow}</div>
            {plan.featured && <strong className="pricing-badge">RECOMMENDED · SAVE 25%</strong>}
            <div className="pricing-price"><b>{plan.price}</b><span>{plan.period}</span></div>
            <p className="pricing-equivalent">{plan.equivalent}</p>
            <strong className="pricing-saving">{plan.saving}</strong>
            <p className="pricing-fit">{plan.fit}</p>
            <ul>{paidFeatures.map(feature => <li key={feature}>{feature}</li>)}</ul>
            <button type="button" onClick={() => checkout(plan.key)} disabled={loading !== null}>
              {loading === plan.key ? "Opening secure checkout…" : plan.cta}
            </button>
          </article>
        ))}
      </div>

      <div className="pricing-trust">
        <p><strong>Clear renewal.</strong> Monthly renews at $12 each month. The 3-month cycle renews at $27 every three months until canceled.</p>
        <p><strong>Simple cancellation.</strong> Cancel through the customer portal before renewal; paid access continues to period end and completed reports remain readable.</p>
        <p><strong>No rank guarantee.</strong> Coaching can improve decision quality, not promise a competitive result. If you are under 18, ask a parent or guardian before purchasing.</p>
      </div>
      <p className="pricing-error" role="alert" aria-live="polite">{error}</p>
    </section>
  );
}
