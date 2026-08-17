import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Landing, { GameKey } from "../components/Landing";

const allowed: GameKey[] = ["league", "valorant", "rocket-league"];
const meta: Record<string, { title: string; description: string }> = {
  league: { title: "Replay Method for League of Legends — Find what costs your LP", description: "AI coaching designed to find the macro, role and champion decisions keeping you hardstuck in League of Legends." },
  valorant: { title: "Replay Method for VALORANT — Find what costs your RR", description: "AI coaching designed to expose the fights, positioning and utility patterns quietly draining your VALORANT RR." },
  "rocket-league": { title: "Replay Method for Rocket League — Find what costs your MMR", description: "AI replay coaching designed to find the rotation, challenge and boost habits keeping you hardstuck in Rocket League." }
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
