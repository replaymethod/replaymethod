import type { Metadata } from "next";
import AnalyzeFlow from "./AnalyzeFlow";
import { isAnalysisGame } from "../../lib/analysis";

export const metadata: Metadata = {
  title: "Match evidence & access beta — Replay Method",
  description: "Upload a Rocket League replay to the evidence-gated beta or preserve an opt-in League or VALORANT request while official Riot access is pending.",
  alternates: { canonical: "/analyze" }
};

export default async function AnalyzePage({ searchParams }: { searchParams: Promise<{ game?: string; hypothesis?: string }> }) {
  const query = await searchParams;
  const initialGame = query.game && isAnalysisGame(query.game) ? query.game : null;
  const initialHypothesis = query.hypothesis?.trim().slice(0, 120) || "";
  return <AnalyzeFlow initialGame={initialGame} initialHypothesis={initialHypothesis} />;
}
