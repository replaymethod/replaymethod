"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { trackProductEvent } from "../../../lib/client-analytics";

export default function BillingSuccessPage() {
  const [state, setState] = useState<"checking" | "active" | "pending">("checking");

  useEffect(() => {
    let stopped = false;
    let attempts = 0;
    const check = async () => {
      try {
        const response = await fetch("/api/billing/status", { cache: "no-store" });
        const payload = await response.json() as { billing?: { planKey?: string | null } };
        if (!stopped && response.ok && payload.billing?.planKey) {
          if (!sessionStorage.getItem("replaymethod-paid-activation-recorded")) {
            sessionStorage.setItem("replaymethod-paid-activation-recorded", "1");
            trackProductEvent("paid_activation", "general", "billing_confirmed");
          }
          return setState("active");
        }
      } catch { /* the webhook can still complete after this page loads */ }
      attempts += 1;
      if (!stopped && attempts < 4) window.setTimeout(check, 1200);
      else if (!stopped) setState("pending");
    };
    void check();
    return () => { stopped = true; };
  }, []);

  return (
    <main className="billing-result-page">
      <section>
        <span>SECURE CHECKOUT RETURN</span>
        <h1>{state === "active" ? "Your improvement loop is active." : "Your payment is being confirmed."}</h1>
        <p>{state === "active" ? "Your new analysis allowance is ready. Subscription state and renewals are managed securely through Stripe." : "Stripe confirmation can take a few seconds. You can safely continue to your private history; access will update automatically."}</p>
        <div>
          <Link href="/analyze">Start an analysis →</Link>
          <Link href="/reports">View reports and billing</Link>
        </div>
      </section>
    </main>
  );
}
