import type { Metadata } from "next";
import ReportsClient from "./ReportsClient";

export const metadata: Metadata = { title: "My reports — Replay Method", robots: { index: false, follow: false } };
export default function ReportsPage() { return <ReportsClient />; }
