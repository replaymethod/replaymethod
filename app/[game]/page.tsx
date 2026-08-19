import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Landing, { GameKey } from "../components/Landing";

const allowed: GameKey[] = ["league", "valorant", "rocket-league"];
const meta: Record<string, { title: string; description: string }> = {
  league: { title: "Replay Method for League of Legends — Evidence-based improvement", description: "Explore the League coaching method and preserve an opt-in beta request while official Riot production access is pending." },
  valorant: { title: "Replay Method for VALORANT — Evidence-based improvement", description: "Explore the VALORANT coaching method and preserve an opt-in beta request while official Riot production access is pending." },
  "rocket-league": { title: "Replay Method for Rocket League — Evidence-gated replay beta", description: "Upload an original PC replay to an evidence-gated beta that parses real match data and stops when a reliable finding is not supported." }
};

export async function generateMetadata({ params }: { params: Promise<{ game: string }> }): Promise<Metadata> {
  const { game } = await params;
  return meta[game] ? { ...meta[game], alternates: { canonical: `/${game}` } } : {};
}

export default async function GamePage({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
  if (!allowed.includes(game as GameKey)) notFound();
  return <Landing game={game as GameKey} />;
}
