import type { MetadataRoute } from "next";
import { guides } from "./guides/data";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://replaymethod.xyz";
  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/analyze`, changeFrequency: "weekly", priority: .95 },
    { url: `${base}/climb-check`, changeFrequency: "monthly", priority: .9 },
    { url: `${base}/league`, changeFrequency: "weekly", priority: .85 },
    { url: `${base}/valorant`, changeFrequency: "weekly", priority: .85 },
    { url: `${base}/rocket-league`, changeFrequency: "weekly", priority: .85 },
    { url: `${base}/rocket-league-beta`, changeFrequency: "weekly", priority: .7 },
    { url: `${base}/replay-upload`, changeFrequency: "monthly", priority: .8 },
    { url: `${base}/guides`, changeFrequency: "weekly", priority: .8 },
    ...guides.map(guide => ({ url: `${base}/guides/${guide.slug}`, changeFrequency: "monthly" as const, priority: .75 })),
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: .2 },
    { url: `${base}/beta-terms`, changeFrequency: "yearly", priority: .2 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: .2 }
  ];
}
