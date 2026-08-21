import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadPublicReport } from "../../../lib/report-data";
import { loadE2eReportFixture } from "../../../lib/e2e-report-fixtures";
import { paidCheckoutReadiness } from "../../../lib/subsystem-controls.mjs";
import ReportClient from "./ReportClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Private match report — Replay Method",
  robots: { index: false, follow: false }
};

export default async function ReportPage({ params, searchParams }: { params: Promise<{ publicId: string }>; searchParams: Promise<{ delivery?: string }> }) {
  const { publicId } = await params;
  let e2eFixturesEnabled = false;
  let checkoutOpen = false;
  try {
    const { env } = await import("cloudflare:workers");
    const runtime = env as unknown as Record<string, unknown> & { REPLAYMETHOD_E2E_FIXTURES?: string };
    e2eFixturesEnabled = runtime.REPLAYMETHOD_E2E_FIXTURES === "true";
    checkoutOpen = paidCheckoutReadiness(runtime).ready;
  } catch { /* Only the local E2E server defines this fail-closed binding. */ }
  const report = e2eFixturesEnabled ? loadE2eReportFixture(publicId) || await loadPublicReport(publicId) : await loadPublicReport(publicId);
  if (!report) notFound();
  const query = await searchParams;
  return <ReportClient initial={report} delivery={query.delivery === "email" ? "email" : "link"} checkoutOpen={checkoutOpen} />;
}
