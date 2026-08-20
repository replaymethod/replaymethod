import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadPublicReport } from "../../../lib/report-data";
import { loadE2eReportFixture } from "../../../lib/e2e-report-fixtures";
import ReportClient from "./ReportClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Private match report — Replay Method",
  robots: { index: false, follow: false }
};

export default async function ReportPage({ params, searchParams }: { params: Promise<{ publicId: string }>; searchParams: Promise<{ delivery?: string }> }) {
  const { publicId } = await params;
  let e2eFixturesEnabled = false;
  try {
    const { env } = await import("cloudflare:workers");
    e2eFixturesEnabled = (env as unknown as { REPLAYMETHOD_E2E_FIXTURES?: string }).REPLAYMETHOD_E2E_FIXTURES === "true";
  } catch { /* Only the local E2E server defines this fail-closed binding. */ }
  const report = e2eFixturesEnabled ? loadE2eReportFixture(publicId) || await loadPublicReport(publicId) : await loadPublicReport(publicId);
  if (!report) notFound();
  const query = await searchParams;
  return <ReportClient initial={report} delivery={query.delivery === "email" ? "email" : "link"} />;
}
