import type { MetadataRoute } from "next";
import { guides } from "./guides/data";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://replaymethod.xyz";
  const now = new Date();
  return [
    { url: base, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/analyze`, lastModified: now, changeFrequency: "weekly", priority: .95 },
    { url: `${base}/climb-check`, lastModified: now, changeFrequency: "monthly", priority: .9 },
    { url: `${base}/league`, lastModified: now, changeFrequency: "weekly", priority: .85 },
    { url: `${base}/valorant`, lastModified: now, changeFrequency: "weekly", priority: .85 },
    { url: `${base}/rocket-league`, lastModified: now, changeFrequency: "weekly", priority: .85 },
    { url: `${base}/guides`, lastModified: now, changeFrequency: "weekly", priority: .8 },
    ...guides.map(guide => ({ url: `${base}/guides/${guide.slug}`, lastModified: now, changeFrequency: "monthly" as const, priority: .75 })),
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: .2 },
    { url: `${base}/beta-terms`, lastModified: now, changeFrequency: "yearly", priority: .2 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "yearly", priority: .2 }
  ];
}
