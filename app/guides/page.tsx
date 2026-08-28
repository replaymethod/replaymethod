import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Rocket League replay review guide — Replay Method",
  description: "A focused Rocket League replay review system for spacing, challenges, boost paths and recoveries.",
  alternates: { canonical: "/guides/rocket-league-replay-review-checklist" },
  robots: { index: false, follow: true }
};

export default function GuidesPage() {
  permanentRedirect("/guides/rocket-league-replay-review-checklist");
}
