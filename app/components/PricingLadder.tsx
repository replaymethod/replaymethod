"use client";

import { useState } from "react";

type PaidPlan = "annual" | "semiannual" | "quarterly" | "monthly";

const plans: Array<{
  key: PaidPlan;
  eyebrow: string;
  price: string;
  period: string;
  equivalent: string;
  saving: string;
  fit: string;
  featured?: boolean;
}> = [
  {
    key: "annual",
    eyebrow: "BEST COMMITMENT",
    price: "$89",
    period: "12 months",
    equivalent: "$7.42/month",
    saving: "Save 38% vs monthly",
    fit: "For players who want a full season of measured improvement.",
    featured: true,
  },
  {
    key: "semiannual",
    eyebrow: "SERIOUS CLIMB",
    price: "$49",
    period: "6 months",
    equivalent: "$8.17/month",
    saving: "Save 32% vs monthly",
    fit: "For rebuilding repeated habits across a meaningful rank push.",
  },
  {
    key: "quarterly",
    eyebrow: "FOCUSED RESET",
    price: "$27",
    period: "3 months",
    equivalent: "$9/month",
    saving: "Save 25% vs monthly",
    fit: "For correcting one clear weakness over a focused training block.",
  },
  {
    key: "monthly",
    eyebrow: "FLEXIBLE",
    price: "$12",
    period: "1 month",
    equivalent: "$12/month",
    saving: "Cancel before renewal",
    fit: "For testing the ongoing improvement loop with maximum flexibility.",
  },
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
      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error || "Checkout is not available yet.");
      window.location.assign(payload.url);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Checkout is not available yet.");
      setLoading(null);
    }
  }

  return (
    <section className="pricing-ladder shell" id="pricing" aria-labelledby="pricing-title">
      <div className="pricing-heading">
        <span className="kicker">START FREE. COMMIT ONLY WHEN THE EVIDENCE EARNS IT.</span>
        <h2 id="pricing-title">Choose the length of your climb.</h2>
        <p>The paid plans use the same coaching engine. Longer plans cost less per month because lasting decisions need more than one good session.</p>
      </div>

      <div className="pricing-grid">
        {plans.map((plan, index) => (
          <article className={`pricing-card ${plan.featured ? "featured" : ""}`} key={plan.key}>
            <div className="pricing-rank"><span>0{index + 1}</span>{plan.eyebrow}</div>
            {plan.featured && <strong className="pricing-badge">BEST VALUE</strong>}
            <div className="pricing-price"><b>{plan.price}</b><span>/ {plan.period}</span></div>
            <p className="pricing-equivalent">{plan.equivalent} · billed upfront</p>
            <strong className="pricing-saving">{plan.saving}</strong>
            <p className="pricing-fit">{plan.fit}</p>
            <ul>
              <li>4 full analyses every 30 days</li>
              <li>Cross-match pattern memory</li>
              <li>Automatic focus follow-up</li>
              <li>Progress proof over time</li>
            </ul>
            <button type="button" onClick={() => checkout(plan.key)} disabled={loading !== null}>
              {loading === plan.key ? "Opening secure checkout…" : `Choose ${plan.period} →`}
            </button>
          </article>
        ))}

        <a className="pricing-card free" href={analysisHref}>
          <div className="pricing-rank"><span>05</span>START HERE</div>
          <div className="pricing-price"><b>$0</b><span>/ first diagnosis</span></div>
          <p className="pricing-equivalent">No card. No automatic charge.</p>
          <strong className="pricing-saving">Experience the real product first</strong>
          <p className="pricing-fit">For discovering the highest-impact repeated weakness in one real match.</p>
          <ul>
            <li>1 full evidence-backed report</li>
            <li>Your primary repeated mistake</li>
            <li>One next-queue rule</li>
            <li>Private report</li>
          </ul>
          <strong className="pricing-free-cta">Analyze my first match →</strong>
        </a>
      </div>

      <div className="pricing-trust">
        <p>Paid plans renew for the same term until cancelled before renewal. Manage or cancel through the customer portal.</p>
        <p>Coaching improves decision quality; it cannot guarantee a rank. If you are under 18, ask a parent or guardian before purchasing.</p>
      </div>
      <p className="pricing-error" role="alert" aria-live="polite">{error}</p>
    </section>
  );
}
