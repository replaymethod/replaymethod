import type { Metadata } from "next";
import AnalyzeFlow from "./AnalyzeFlow";
import { isAnalysisGame } from "../../lib/analysis";
import { subsystemEnabled } from "../../lib/subsystem-controls.mjs";

export const metadata: Metadata = {
  title: "Match evidence & access beta — Replay Method",
  description: "Upload a Rocket League replay to the evidence-gated beta or preserve an opt-in League or VALORANT request while official Riot access is pending.",
  alternates: { canonical: "/analyze" }
};

export default async function AnalyzePage({ searchParams }: { searchParams: Promise<{ game?: string; hypothesis?: string; platform?: string }> }) {
  const query = await searchParams;
  const initialGame = query.game && isAnalysisGame(query.game) ? query.game : null;
  const initialHypothesis = query.hypothesis?.trim().slice(0, 120) || "";
  const initialPlatform = ["pc", "ps5", "xbox", "switch"].includes(query.platform || "") ? query.platform as "pc" | "ps5" | "xbox" | "switch" : null;
  let engineOpen = false;
  let videoOpen = false;
  try {
    const { env } = await import("cloudflare:workers");
    const runtime = env as unknown as { RL_ENGINE_ENABLED?: string; RL_VIDEO_ANALYSIS_ENABLED?: string };
    engineOpen = subsystemEnabled(runtime.RL_ENGINE_ENABLED);
    videoOpen = subsystemEnabled(runtime.RL_VIDEO_ANALYSIS_ENABLED);
  } catch { /* Local and static previews keep replay intake safely closed. */ }
  return <AnalyzeFlow initialGame={initialGame} initialHypothesis={initialHypothesis} initialPlatform={initialPlatform} engineOpen={engineOpen} videoOpen={videoOpen} />;
}
