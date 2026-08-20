"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { trackProductEvent } from "../../lib/client-analytics";

type ReportSummary = {
  publicId: string;
  gameLabel: string;
  currentRank: string;
  targetRank: string | null;
  status: string;
  hasBillingAccount: boolean;
  createdAt: string;
  highestImpactMistake: string | null;
};

type BillingSnapshot = {
  planKey: "quarterly" | "monthly" | null;
  status: string;
  hasBillingAccount: boolean;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  paymentGrace: boolean;
  used: number;
  limit: number;
  windowEnd: string;
};

export default function ReportsClient() {
  const [reports, setReports] = useState<ReportSummary[] | null>(null);
  const [historyMode, setHistoryMode] = useState<"loading" | "verified" | "device">("loading");
  const [billing, setBilling] = useState<BillingSnapshot | null>(null);
  const [portalState, setPortalState] = useState<"idle" | "loading">("idle");
  const [portalError, setPortalError] = useState("");
  const [privacyState, setPrivacyState] = useState<"idle" | "deleting" | "error">("idle");
  const [privacyError, setPrivacyError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/analyses/history", { cache: "no-store" });
        const data = await response.json() as { reports?: ReportSummary[]; authenticated?: boolean };
        if (data.authenticated) {
          setHistoryMode("verified");
          setReports(data.reports || []);
          try {
            const billingResponse = await fetch("/api/billing/status", { cache: "no-store" });
            const billingData = await billingResponse.json() as { billing?: BillingSnapshot };
            if (billingResponse.ok && billingData.billing) setBilling(billingData.billing);
          } catch { /* report history remains usable if billing status is unavailable */ }
          return;
        }
      } catch { /* device-saved private links remain available */ }

      let ids: string[] = [];
      try { ids = JSON.parse(localStorage.getItem("replaymethod-report-ids") || "[]") as string[]; } catch { /* ignore malformed device storage */ }
      setHistoryMode("device");
      if (!ids.length) return setReports([]);
      try {
        const response = await fetch("/api/analyses/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        });
        const data = await response.json() as { reports?: ReportSummary[] };
        setReports((data.reports || []).sort((a, b) => ids.indexOf(a.publicId) - ids.indexOf(b.publicId)));
      } catch { setReports([]); }
    })();
  }, []);

  async function openPortal() {
    setPortalState("loading");
    setPortalError("");
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const payload = await response.json() as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error || "Subscription management is unavailable.");
      window.location.assign(payload.url);
    } catch (error) {
      setPortalError(error instanceof Error ? error.message : "Subscription management is unavailable.");
      setPortalState("idle");
    }
  }

  async function deleteAccountData() {
    const confirmation = window.prompt("This permanently deletes your verified account, reports and stored replay files. Type DELETE MY DATA to continue.");
    if (confirmation !== "DELETE MY DATA") return;
    setPrivacyState("deleting");
    setPrivacyError("");
    try {
      const response = await fetch("/api/player/data", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });
      const result = await response.json() as { deleted?: boolean; error?: string };
      if (!response.ok || !result.deleted) throw new Error(result.error || "Account deletion could not be completed.");
      localStorage.removeItem("replaymethod-report-ids");
      window.location.assign("/?account=deleted");
    } catch (error) {
      setPrivacyState("error");
      setPrivacyError(error instanceof Error ? error.message : "Account deletion could not be completed.");
    }
  }

  const statusTitle = (report: ReportSummary) => report.highestImpactMistake || ({
    analyzing: "Analysis in progress",
    received: "Evidence received",
    blocked: "Analysis paused — evidence preserved",
    failed: "Analysis needs attention",
  }[report.status] ?? "Report pending");
  const planName = billing?.planKey === "quarterly" ? "3-month cycle" : billing?.planKey === "monthly" ? "Monthly" : billing?.hasBillingAccount ? "No active plan" : "Free proof";
  const trackNewAnalysis = () => trackProductEvent(reports?.length ? "followup_started" : "analysis_start", "general", reports?.length ? "history_followup" : "history_empty");

  return (
    <main className="reports-page">
      <nav className="tool-nav shell">
        <Link className="brand" href="/"><span className="logo">↻</span><span>replay<span>method</span></span></Link>
        <Link href="/analyze" onClick={trackNewAnalysis}>New analysis</Link>
      </nav>
      <section className="reports-shell shell">
        <span>{historyMode === "verified" ? "EMAIL-VERIFIED HISTORY" : "DEVICE-SAVED HISTORY"}</span>
        <h1>Your reports.</h1>
        <p>{historyMode === "verified" ? "This device has secure access to the reports owned by your verified email. No password or public profile is required." : "These private links were started on this device. Open the one-time verification link emailed with an analysis to securely connect your history."}</p>

        {historyMode === "verified" && billing && (
          <aside className="billing-summary" aria-label="Analysis allowance and subscription">
            <div>
              <span>{planName.toUpperCase()}</span>
              <strong>{billing.used} of {billing.limit} analyses used</strong>
              <small>
                {billing.planKey
                  ? `${billing.cancelAtPeriodEnd ? "Access ends" : "Current billing period ends"} ${new Date(billing.currentPeriodEnd || billing.windowEnd).toLocaleDateString("en-GB", { dateStyle: "medium" })}`
                  : billing.hasBillingAccount
                    ? "Paid access is inactive. Your completed reports remain readable."
                    : "Your first completed diagnosis is free. No card or renewal."}
              </small>
              {billing.paymentGrace && <p role="alert">Payment recovery is in progress. Update your payment method to keep access uninterrupted.</p>}
            </div>
            {billing.hasBillingAccount ? (
              <button type="button" onClick={openPortal} disabled={portalState === "loading"}>
                {portalState === "loading" ? "Opening secure portal…" : "Manage subscription"}
              </button>
            ) : <Link href="/#pricing" onClick={() => trackProductEvent("upgrade_intent", "general", "history_billing")}>Compare paid plans →</Link>}
            {portalError && <p className="billing-error" role="alert">{portalError}</p>}
          </aside>
        )}

        {reports === null ? <div className="reports-empty">Loading reports…</div> : reports.length === 0 ? (
          <div className="reports-empty">
            <b>No reports available here yet.</b>
            <p>Submit one real match and the private report will appear here. Email verification connects later reports on this device.</p>
            <Link href="/analyze" onClick={trackNewAnalysis}>Start my free analysis →</Link>
          </div>
        ) : (
          <div className="reports-list">
            {reports.map(report => (
              <Link key={report.publicId} href={`/report/${report.publicId}`}>
                <div><span>{report.gameLabel}</span><b>{statusTitle(report)}</b><small>{report.currentRank}{report.targetRank ? ` → ${report.targetRank}` : ""} · {new Date(`${report.createdAt}Z`).toLocaleDateString("en-GB", { dateStyle: "medium" })}</small></div>
                <i className={report.status}>{report.status} →</i>
              </Link>
            ))}
          </div>
        )}
        {historyMode === "verified" && <aside className="privacy-controls" aria-label="Account data controls">
          <div><span>YOUR DATA</span><strong>Export or permanently delete your verified account.</strong><p>The export omits security secrets and provider identifiers. Deletion removes stored replay files, reports and waitlist records; an active paid period must end first.</p></div>
          <div><a href="/api/player/data" download>Download my data</a><button type="button" onClick={deleteAccountData} disabled={privacyState === "deleting"}>{privacyState === "deleting" ? "Deleting…" : "Delete my data"}</button></div>
          {privacyError && <p className="privacy-error" role="alert">{privacyError}</p>}
        </aside>}
      </section>
    </main>
  );
}
