import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://replaymethod.xyz"),
  title: "Replay Method — Turn every match into progress",
  description: "AI coaching that turns your real matches into one clear diagnosis, one focused training plan and measurable progress.",
  applicationName: "Replay Method",
  alternates: { canonical: "/" },
  keywords: ["AI gaming coach", "League of Legends coaching", "VALORANT coaching", "Rocket League replay analysis", "rank up", "VOD review"],
  openGraph: {
    type: "website",
    siteName: "Replay Method",
    title: "Replay Method — Turn every match into progress",
    description: "Replay. Reveal. Practice. Prove. Stop grinding blind and fix the repeated decision keeping you hardstuck.",
    images: [{ url: "/og.png", width: 1672, height: 939, alt: "Replay Method — Stop losing for the same reason." }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Replay Method — Turn every match into progress",
    description: "AI coaching for players who are done grinding blind.",
    images: ["/og.png"]
  },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" }
};

export const viewport: Viewport = { themeColor: "#03040a", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body id="top">{children}</body></html>;
}
