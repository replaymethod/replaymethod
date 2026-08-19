"use client";

import { useEffect, useRef, useState } from "react";
import { trackProductEvent, type AnalyticsGame } from "../../lib/client-analytics";

type PaidPlan = "annual" | "semiannual" | "quarterly" | "monthly";
type PlanKey = PaidPlan | "free";

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
    key: "annual",
    number: "01",
    eyebrow: "12-MONTH CLIMB",
    price: "$89",
    period: "every 12 months",
    equivalent: "$7.42/month effective · $89 charged today and at renewal",
    saving: "Save $55 vs twelve monthly payments (38%)",
    fit: "For players committing to a full season of measured improvement.",
    cta: "Choose the 12-month climb →",
  },
  {
    key: "semiannual",
    number: "02",
    eyebrow: "6-MONTH CLIMB",
    price: "$49",
    period: "every 6 months",
    equivalent: "$8.17/month effective · $49 charged today and at renewal",
    saving: "Save $23 vs six monthly payments (32%)",
    fit: "For building and verifying more than one focused habit across a ranked split.",
    cta: "Choose the 6-month climb →",
  },
  {
    key: "quarterly",
    number: "03",
    eyebrow: "3-MONTH CYCLE",
    price: "$27",
    period: "every 3 months",
    equivalent: "$9/month effective · $27 charged today and at renewal",
    saving: "Save $9 vs three monthly payments (25%)",
    fit: "For giving one focused change enough matches to become measurable.",
    cta: "Choose the 3-month cycle →",
  },
  {
    key: "monthly",
    number: "04",
    eyebrow: "MONTH TO MONTH",
    price: "$12",
    period: "per month",
    equivalent: "$12 charged today and monthly",
    saving: "Maximum flexibility",
    fit: "For continuing the improvement loop without a longer commitment.",
    cta: "Choose monthly →",
    featured: true,
  },
];

const paidFeatures = [
  { mark: "4×", label: "Completed analyses every 30 days" },
  { mark: "MEM", label: "Cross-match pattern memory" },
  { mark: "LOOP", label: "Automatic focus follow-up" },
  { mark: "PROOF", label: "Behavioral progress verification" },
  { mark: "30D", label: "Allowance resets; no rollover" },
];

const mobileChoices: Array<{ key: PlanKey; label: string; price: string }> = [
  { key: "free", label: "Start free", price: "$0" },
  { key: "monthly", label: "Monthly", price: "$12" },
  { key: "quarterly", label: "3 months", price: "$27" },
  { key: "semiannual", label: "6 months", price: "$49" },
  { key: "annual", label: "12 months", price: "$89" },
];

export default function PricingLadder({ analysisHref, game, requestOnly = false, checkoutOpen = false, replayReady = true }: { analysisHref: string; game: AnalyticsGame; requestOnly?: boolean; checkoutOpen?: boolean; replayReady?: boolean }) {
  const [loading, setLoading] = useState<PaidPlan | null>(null);
  const [activePlan, setActivePlan] = useState<PlanKey>("free");
  const [error, setError] = useState("");
  const [adultPurchaser, setAdultPurchaser] = useState(false);
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
    if (!adultPurchaser) {
      setError("Paid beta access is available only to purchasers aged 18 or over.");
      return;
    }
    trackProductEvent("upgrade_intent", game, `pricing_${plan}`);
    setLoading(plan);
    setError("");

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan, adultPurchaser }),
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
        <span className="kicker">PROVE VALUE FIRST. THEN CHOOSE CADENCE.</span>
        <h2 id="pricing-title">{requestOnly ? "Official access first. Payment comes later." : "Start free. Commit only after the product earns it."}</h2>
        <p>{requestOnly ? "League and VALORANT paid access cannot begin until official opt-in ingestion is active. You can preserve a free beta request without a card today." : replayReady ? "The first supported analysis is free. Monthly is the lowest-risk paid next step; longer cycles lower the effective rate only for players who already want continued verification." : "Prices are shown for transparency, but checkout and replay intake remain closed until the production quality, tax and platform gates are complete. Joining the beta list is free."}</p>
      </div>
      <div className="pricing-mobile-tabs" role="tablist" aria-label="Choose a plan to compare">
        {mobileChoices.map(choice => <button type="button" role="tab" aria-selected={activePlan === choice.key} className={activePlan === choice.key ? "active" : ""} onClick={() => setActivePlan(choice.key)} key={choice.key}><span>{choice.label}</span><b>{choice.price}</b></button>)}
      </div>

      <div className="pricing-grid">
        {plans.map(plan => (
          <article className={`pricing-card ${plan.featured ? "featured" : ""} ${activePlan === plan.key ? "mobile-active" : ""}`} data-plan={plan.key} key={plan.key} aria-busy={loading === plan.key}>
            <div className="pricing-rank"><span>{plan.number}</span>{plan.eyebrow}</div>
            {plan.featured && <strong className="pricing-badge">LOWEST-RISK PAID START</strong>}
            {plan.key === "annual" && <strong className="pricing-badge">LOWEST EFFECTIVE RATE · SAVE 38%</strong>}
            <div className="pricing-price"><b>{plan.price}</b><span>{plan.period}</span></div>
            <p className="pricing-equivalent">{plan.equivalent}</p>
            <strong className="pricing-saving">{plan.saving}</strong>
            <p className="pricing-fit">{plan.fit}</p>
            <ul className="pricing-capabilities">{paidFeatures.map(feature => <li key={feature.label}><i>{feature.mark}</i><span>{feature.label}</span></li>)}</ul>
            <button type="button" onClick={requestOnly || !checkoutOpen ? undefined : () => checkout(plan.key)} disabled={requestOnly || !checkoutOpen || loading !== null}>
              {requestOnly ? "Official access required first" : !checkoutOpen ? "Paid beta opens after detector validation" : loading === plan.key ? "Opening secure checkout…" : plan.cta}
            </button>
          </article>
        ))}

        <a className={`pricing-card free ${activePlan === "free" ? "mobile-active" : ""}`} data-plan="free" href={analysisHref} aria-label={requestOnly ? "Save a free Riot access beta request" : replayReady ? "Start one free Replay Method evidence check" : "Join the free Replay Method replay beta list"}>
          <div className="pricing-rank"><span>05</span>START WITH PROOF</div>
          <div className="pricing-price"><b>$0</b><span>{requestOnly ? "access request" : replayReady ? "first evidence check" : "beta request"}</span></div>
          <p className="pricing-equivalent">{requestOnly ? "Private request · no card · no renewal" : replayReady ? "Verified outcome · no card · no renewal" : "First-access email · no file · no card"}</p>
          <strong className="pricing-saving">{requestOnly ? "Official ingestion remains pending" : replayReady ? "Experience the quality standard first" : "Production quality validation remains in progress"}</strong>
          <p className="pricing-fit">{requestOnly ? "Preserve your opt-in interest without pretending a public profile is authorized match evidence." : replayReady ? "Receive a report only when one real match supports a reliable finding; otherwise see the honest blocked state." : "Join the list now. Replay Method will invite you only after the real-replay engine is ready for public intake."}</p>
          <ul className="pricing-capabilities">
            {requestOnly ? <><li><i>REQ</i><span>Private beta request</span></li><li><i>CTX</i><span>Game and goal context</span></li><li><i>API</i><span>Official-access boundary</span></li><li><i>LINK</i><span>Recoverable status link</span></li></> : <><li><i>EV</i><span>Evidence-gated outcome</span></li><li><i>01</i><span>One supported primary finding</span></li><li><i>RULE</i><span>One next-queue rule</span></li><li><i>LINK</i><span>Private report history</span></li></>}
          </ul>
          <strong className="pricing-free-cta">{requestOnly ? "Save my beta request →" : replayReady ? "Start my evidence check →" : "Join the replay beta →"}</strong>
        </a>
      </div>

      {!requestOnly && !checkoutOpen && <p className="pricing-rollout"><strong>Plan comparison ready. Checkout intentionally closed.</strong> Paid access opens only after the Rocket League engine passes its public quality gate and tax, platform and production activation are separately approved. {replayReady ? "Start with the free evidence check today." : "Join the free beta list today."}</p>}
      {!requestOnly && checkoutOpen && <label className="pricing-adult"><input type="checkbox" checked={adultPurchaser} onChange={event => setAdultPurchaser(event.target.checked)} /><span><strong>18+ purchaser.</strong> I confirm that I am at least 18 and can enter this renewing subscription.</span></label>}

      <div className="pricing-trust">
        <p><strong>Clear renewal.</strong> Plans renew at the displayed total: $89 yearly, $49 every six months, $27 every three months or $12 monthly.</p>
        <p><strong>Simple cancellation.</strong> Cancel through the customer portal before renewal; paid access continues to period end and completed reports remain readable.</p>
        <p><strong>No rank guarantee.</strong> Coaching can improve decision quality, not promise a competitive result. Paid beta access is available only to purchasers aged 18 or over.</p>
      </div>
      <p className="pricing-error" role="alert" aria-live="polite">{error}</p>
    </section>
  );
}
