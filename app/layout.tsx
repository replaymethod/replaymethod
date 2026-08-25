import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://replaymethod.xyz"),
  title: "Replay Method — See the mistake you keep repeating",
  description: "Upload ten ranked Rocket League PC replays from the same player and playlist. Get one evidence-backed cross-match focus, or an honest abstention.",
  applicationName: "Replay Method",
  alternates: { canonical: "/" },
  keywords: ["competitive gaming improvement", "League of Legends coaching", "VALORANT coaching", "Rocket League replay analysis", "replay review", "VOD review"],
  openGraph: {
    type: "website",
    siteName: "Replay Method",
    title: "Replay Method — See the mistake you keep repeating",
    description: "Upload ten ranked Rocket League replays. See what keeps happening and get one focus for your next session.",
    images: [{ url: "/brand/og-replay-method-v12-1200x630.png", width: 1200, height: 630, alt: "Replay Method — Stop grinding blind." }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Replay Method — See the mistake you keep repeating",
    description: "Upload ten ranked Rocket League replays. See what keeps happening and get one focus for your next session.",
    images: ["/brand/og-replay-method-v12-1200x630.png"]
  },
  icons: {
    icon: [
      { url: "/brand/replay-method-mark-v12-16.png", sizes: "16x16", type: "image/png" },
      { url: "/brand/replay-method-mark-v12-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/replay-method-mark-v12-48.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" }
    ],
    shortcut: "/brand/replay-method-mark-v12-32.png",
    apple: [{ url: "/brand/replay-method-apple-touch-v12-180.png", sizes: "180x180", type: "image/png" }]
  },
  verification: { google: process.env.GOOGLE_SITE_VERIFICATION }
};

export const viewport: Viewport = { themeColor: "#f3f2ee", colorScheme: "light" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body id="top">{children}</body></html>;
}
