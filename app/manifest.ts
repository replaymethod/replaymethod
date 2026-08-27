import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Replay Method",
    short_name: "Replay Method",
    description: "Evidence-first Rocket League replay coaching.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f4f0",
    theme_color: "#f4f4f0",
    icons: [
      { src: "/brand/replay-method-mark-v13-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/replay-method-mark-v13-512.png", sizes: "512x512", type: "image/png" }
    ]
  };
}
