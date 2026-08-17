import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadPublicReport } from "../../../lib/report-data";
import ReportClient from "./ReportClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Private match report — Replay Method",
  robots: { index: false, follow: false }
};

export default async function ReportPage({ params, searchParams }: { params: Promise<{ publicId: string }>; searchParams: Promise<{ delivery?: string }> }) {
  const { publicId } = await params;
  const report = await loadPublicReport(publicId);
  if (!report) notFound();
  const query = await searchParams;
  return <ReportClient initial={report} delivery={query.delivery === "email" ? "email" : "link"} />;
}
