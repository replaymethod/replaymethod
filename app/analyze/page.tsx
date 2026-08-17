import type { Metadata } from "next";
import AnalyzeFlow from "./AnalyzeFlow";
import { isAnalysisGame } from "../../lib/analysis";

export const metadata: Metadata = {
  title: "Free match analysis — Replay Method",
  description: "Submit a real League of Legends, VALORANT or Rocket League match and get one focused Replay Method diagnosis free.",
  alternates: { canonical: "/analyze" }
};

export default async function AnalyzePage({ searchParams }: { searchParams: Promise<{ game?: string }> }) {
  const query = await searchParams;
  const initialGame = query.game && isAnalysisGame(query.game) ? query.game : null;
  return <AnalyzeFlow initialGame={initialGame} />;
}
