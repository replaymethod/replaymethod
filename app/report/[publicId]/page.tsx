import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getDatabase } from "../../../db";
import { loadPublicReport } from "../../../lib/report-data";
import { loadE2eReportFixture } from "../../../lib/e2e-report-fixtures";
import { paidCheckoutReadiness } from "../../../lib/subsystem-controls.mjs";
import ReportClient from "./ReportClient";
import { canAccessAnalysis } from "../../../lib/report-access.mjs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Private match report — Replay Method",
  robots: { index: false, follow: false }
};

export default async function ReportPage({ params, searchParams }: { params: Promise<{ publicId: string }>; searchParams: Promise<{ delivery?: string; access?: string }> }) {
  const { publicId } = await params;
  let e2eFixturesEnabled = false;
  let checkoutOpen = false;
  try {
    const { env } = await import("cloudflare:workers");
    const runtime = env as unknown as Record<string, unknown> & { REPLAYMETHOD_E2E_FIXTURES?: string };
    e2eFixturesEnabled = runtime.REPLAYMETHOD_E2E_FIXTURES === "true";
    checkoutOpen = paidCheckoutReadiness(runtime).ready;
  } catch { /* Only the local E2E server defines this fail-closed binding. */ }
  const query = await searchParams;
  const requestHeaders = await headers();
  const accessToken = typeof query.access === "string" && query.access
    ? query.access
    : requestHeaders.get("x-report-access") || "";
  const authorized = e2eFixturesEnabled && Boolean(loadE2eReportFixture(publicId))
    ? true
    : await canAccessAnalysis(await getDatabase(), publicId, accessToken, requestHeaders.get("cookie") || "");
  if (!authorized) notFound();
  const report = e2eFixturesEnabled ? loadE2eReportFixture(publicId) || await loadPublicReport(publicId) : await loadPublicReport(publicId);
  if (!report) notFound();
  return <ReportClient initial={report} accessToken={accessToken} delivery={query.delivery === "email" ? "email" : "link"} checkoutOpen={checkoutOpen} />;
}
