"use client";

import { useState } from "react";

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

export default function PricingLadder({ analysisHref }: { analysisHref: string }) {
  const [loading, setLoading] = useState<PaidPlan | null>(null);
  const [error, setError] = useState("");

  async function checkout(plan: PaidPlan) {
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
      window.location.assign(payload.url);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Secure checkout is not available yet.");
      setLoading(null);
    }
  }

  return (
    <section className="pricing-ladder shell" id="pricing" aria-labelledby="pricing-title">
      <div className="pricing-heading">
        <span className="kicker">START WITH PROOF. PAY ONLY TO CONTINUE.</span>
        <h2 id="pricing-title">One real diagnosis first. Then choose your pace.</h2>
        <p>The first full-quality analysis is free with no card. Paid plans use the same coaching engine and add frequency, private history and progress checks.</p>
      </div>

      <div className="pricing-grid">
        <a className="pricing-card free" href={analysisHref} aria-label="Start one free Replay Method diagnosis">
          <div className="pricing-rank"><span>01</span>START WITH PROOF</div>
          <div className="pricing-price"><b>$0</b><span>first diagnosis</span></div>
          <p className="pricing-equivalent">One complete report · no card · no renewal</p>
          <strong className="pricing-saving">Experience the real product first</strong>
          <p className="pricing-fit">Discover the highest-impact repeated weakness supported by one real match.</p>
          <ul>
            <li>Full evidence-backed report</li>
            <li>Your primary repeated mistake</li>
            <li>One next-queue rule</li>
            <li>Private report history</li>
          </ul>
          <strong className="pricing-free-cta">Analyze my first match →</strong>
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
