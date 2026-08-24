import type { Metadata } from "next";
import BatchAnalyzeFlow from "./BatchAnalyzeFlow";
import { isAnalysisGame } from "../../lib/analysis";
import { subsystemEnabled } from "../../lib/subsystem-controls.mjs";

export const metadata: Metadata = {
  title: "Free 10-replay analysis — Replay Method",
  description: "Upload exactly ten ranked Rocket League PC replays from the same player and playlist to get one evidence-backed cross-match plan.",
  alternates: { canonical: "/analyze" }
};

export default async function AnalyzePage({ searchParams }: { searchParams: Promise<{ game?: string; hypothesis?: string; platform?: string; freeAnalysisUsed?: string }> }) {
  const query = await searchParams;
  const initialGame = query.game && isAnalysisGame(query.game) ? query.game : null;
  const initialHypothesis = query.hypothesis?.trim().slice(0, 120) || "";
  const initialPlatform = ["pc", "ps5", "xbox", "switch"].includes(query.platform || "") ? query.platform as "pc" | "ps5" | "xbox" | "switch" : null;
  const initialFreeAnalysisUsed = process.env.REPLAYMETHOD_E2E_FIXTURES === "true" && query.freeAnalysisUsed === "1";
  let engineOpen = false;
  let videoOpen = false;
  try {
    const { env } = await import("cloudflare:workers");
    const runtime = env as unknown as { RL_ENGINE_ENABLED?: string; RL_VIDEO_ANALYSIS_ENABLED?: string };
    engineOpen = subsystemEnabled(runtime.RL_ENGINE_ENABLED);
    videoOpen = subsystemEnabled(runtime.RL_VIDEO_ANALYSIS_ENABLED);
  } catch { /* Local and static previews keep replay intake safely closed. */ }
  void initialGame; void initialHypothesis; void initialPlatform; void videoOpen;
  return <BatchAnalyzeFlow engineOpen={engineOpen} initialFreeAnalysisUsed={initialFreeAnalysisUsed} />;
}
