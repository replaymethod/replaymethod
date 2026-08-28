import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

const archivedGameRoutes = ["league", "valorant", "rocket-league"];
const meta: Record<string, { title: string; description: string }> = {
  "rocket-league": { title: "Replay Method for Rocket League — Evidence-gated replay beta", description: "Join the Rocket League replay beta while the evidence engine completes its public quality gate." }
};

export async function generateMetadata({ params }: { params: Promise<{ game: string }> }): Promise<Metadata> {
  const { game } = await params;
  return meta[game] ? { ...meta[game], alternates: { canonical: `/${game}` } } : {};
}

export default async function GamePage({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
  if (!archivedGameRoutes.includes(game)) notFound();
  permanentRedirect("/");
}
