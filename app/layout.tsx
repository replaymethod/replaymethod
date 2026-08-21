import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://replaymethod.xyz"),
  title: "Replay Method — Stop guessing why you're stuck",
  description: "Replay Method turns supported match evidence into one clear focus for your next game. Evidence first. No invented results.",
  applicationName: "Replay Method",
  alternates: { canonical: "/" },
  keywords: ["competitive gaming improvement", "League of Legends coaching", "VALORANT coaching", "Rocket League replay analysis", "replay review", "VOD review"],
  openGraph: {
    type: "website",
    siteName: "Replay Method",
    title: "Replay Method — Stop guessing why you're stuck",
    description: "Evidence → one focus → next match. A trustworthy improvement loop for competitive players.",
    images: [{ url: "/og-takeover.png", width: 1731, height: 909, alt: "Replay Method — Stop guessing why you're stuck." }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Replay Method — Stop guessing why you're stuck",
    description: "Evidence → one focus → next match. A trustworthy improvement loop for competitive players.",
    images: ["/og-takeover.png"]
  },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" }
};

export const viewport: Viewport = { themeColor: "#03040a", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body id="top">{children}</body></html>;
}
