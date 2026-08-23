import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Replay Method",
    short_name: "Replay Method",
    description: "Evidence-first Rocket League replay coaching.",
    start_url: "/",
    display: "standalone",
    background_color: "#03040a",
    theme_color: "#03040a",
    icons: [
      { src: "/brand/replay-method-mark-v12-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/replay-method-mark-v12-512.png", sizes: "512x512", type: "image/png" }
    ]
  };
}
