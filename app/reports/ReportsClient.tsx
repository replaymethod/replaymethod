"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ReportSummary = { publicId: string; gameLabel: string; currentRank: string; targetRank: string | null; status: string; createdAt: string; highestImpactMistake: string | null };

export default function ReportsClient() {
  const [reports, setReports] = useState<ReportSummary[] | null>(null);
  useEffect(() => {
    const ids = JSON.parse(localStorage.getItem("replaymethod-report-ids") || "[]") as string[];
    if (!ids.length) { queueMicrotask(() => setReports([])); return; }
    void fetch("/api/analyses/history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) }).then(response => response.json()).then((data: { reports?: ReportSummary[] }) => setReports((data.reports || []).sort((a, b) => ids.indexOf(a.publicId) - ids.indexOf(b.publicId)))).catch(() => setReports([]));
  }, []);

  const statusTitle = (report: ReportSummary) => report.highestImpactMistake || ({ analyzing: "Analysis in progress", received: "Evidence received", blocked: "Analysis paused — evidence preserved", failed: "Analysis needs attention" }[report.status] ?? "Report pending");
  return <main className="reports-page"><nav className="tool-nav shell"><Link className="brand" href="/"><span className="logo">↻</span><span>replay<span>method</span></span></Link><Link href="/analyze">New analysis</Link></nav><section className="reports-shell shell"><span>DEVICE-SAVED HISTORY</span><h1>Your reports.</h1><p>These private links were started on this device. The reports themselves are stored securely by Replay Method.</p>{reports === null ? <div className="reports-empty">Loading reports…</div> : reports.length === 0 ? <div className="reports-empty"><b>No reports on this device yet.</b><p>Submit one real match and the private report will appear here.</p><Link href="/analyze">Start my free analysis →</Link></div> : <div className="reports-list">{reports.map(report => <Link key={report.publicId} href={`/report/${report.publicId}`}><div><span>{report.gameLabel}</span><b>{statusTitle(report)}</b><small>{report.currentRank}{report.targetRank ? ` → ${report.targetRank}` : ""} · {new Date(`${report.createdAt}Z`).toLocaleDateString("en-GB", { dateStyle: "medium" })}</small></div><i className={report.status}>{report.status} →</i></Link>)}</div>}</section></main>;
}
