import type { Metadata } from "next";
import ClimbCheck from "../components/ClimbCheck";

export const metadata: Metadata = {
  title: "Free Climb Leak Check — League, VALORANT & Rocket League",
  description: "A free 60-second self-review to find the repeated decision that may be keeping you hardstuck in League of Legends, VALORANT or Rocket League.",
  alternates: { canonical: "/climb-check" },
  openGraph: { title: "Free Climb Leak Check | Replay Method", description: "Pick your game, find a likely leak and leave with one next-queue focus." }
};

export default function ClimbCheckPage() { return <ClimbCheck />; }
