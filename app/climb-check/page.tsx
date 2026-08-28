import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Rocket League replay review — Replay Method",
  description: "A focused Rocket League replay review system.",
  robots: { index: false, follow: true }
};

export default function ClimbCheckPage() {
  permanentRedirect("/guides/rocket-league-replay-review-checklist");
}
