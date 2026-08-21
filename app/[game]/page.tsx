import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Landing, { GameKey } from "../components/Landing";
import { paidCheckoutReadiness, subsystemEnabled } from "../../lib/subsystem-controls.mjs";

const allowed: GameKey[] = ["league", "valorant", "rocket-league"];
const meta: Record<string, { title: string; description: string }> = {
  league: { title: "Replay Method for League of Legends — Evidence-based improvement", description: "Explore the League coaching method and preserve an opt-in beta request while official Riot production access is pending." },
  valorant: { title: "Replay Method for VALORANT — Evidence-based improvement", description: "Explore the VALORANT coaching method and preserve an opt-in beta request while official Riot production access is pending." },
  "rocket-league": { title: "Replay Method for Rocket League — Evidence-gated replay beta", description: "Join the Rocket League replay beta while the evidence engine completes its public quality gate." }
};

export async function generateMetadata({ params }: { params: Promise<{ game: string }> }): Promise<Metadata> {
  const { game } = await params;
  return meta[game] ? { ...meta[game], alternates: { canonical: `/${game}` } } : {};
}

export default async function GamePage({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
  if (!allowed.includes(game as GameKey)) notFound();
  let checkoutOpen = false;
  let engineOpen = false;
  let calibrationOpen = false;
  try {
    const { env } = await import("cloudflare:workers");
    const runtime = env as unknown as Record<string, unknown> & { RL_ENGINE_ENABLED?: string; RL_PUBLIC_DETECTORS_ENABLED?: string; RL_CALIBRATION_INTAKE_ENABLED?: string };
    checkoutOpen = paidCheckoutReadiness(runtime).ready;
    engineOpen = subsystemEnabled(runtime.RL_ENGINE_ENABLED) && subsystemEnabled(runtime.RL_PUBLIC_DETECTORS_ENABLED);
    calibrationOpen = subsystemEnabled(runtime.RL_CALIBRATION_INTAKE_ENABLED);
  } catch { /* Local and static previews keep checkout safely closed. */ }
  return <Landing game={game as GameKey} checkoutOpen={checkoutOpen} engineOpen={engineOpen} calibrationOpen={calibrationOpen} />;
}
