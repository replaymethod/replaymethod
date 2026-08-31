import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./customer-system.css";
import "./premium-pass.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://replaymethod.xyz"),
  title: "Replay Method — Turn repeated mistakes into focused improvement",
  description: "Upload ten ranked Rocket League PC replays from the same player and playlist. Get one evidence-backed cross-match focus, or an honest abstention.",
  applicationName: "Replay Method",
  alternates: { canonical: "/" },
  keywords: ["Rocket League replay analysis", "Rocket League coaching", "Rocket League replay review", "ranked improvement", "replay review"],
  openGraph: {
    type: "website",
    siteName: "Replay Method",
    title: "Replay Method — Turn repeated mistakes into focused improvement",
    description: "Upload ten ranked Rocket League replays. See what keeps happening and get one focus for your next session.",
    images: [{ url: "/brand/og-replay-method-v16-1200x630.png", width: 1200, height: 630, alt: "Replay Method — Turn repeated mistakes into focused improvement." }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Replay Method — Turn repeated mistakes into focused improvement",
    description: "Upload ten ranked Rocket League replays. See what keeps happening and get one focus for your next session.",
    images: ["/brand/og-replay-method-v16-1200x630.png"]
  },
  icons: {
    icon: [
      { url: "/brand/replay-method-mark-v16-16.png", sizes: "16x16", type: "image/png" },
      { url: "/brand/replay-method-mark-v16-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/replay-method-mark-v16-48.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" }
    ],
    shortcut: "/brand/replay-method-mark-v16-32.png",
    apple: [{ url: "/brand/replay-method-apple-touch-v16-180.png", sizes: "180x180", type: "image/png" }]
  },
  verification: { google: process.env.GOOGLE_SITE_VERIFICATION }
};

export const viewport: Viewport = { themeColor: "#f4f4f0", colorScheme: "light" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body id="top">{children}</body></html>;
}
