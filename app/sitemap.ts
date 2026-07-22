import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: siteUrl("/sudoku"), changeFrequency: "daily", priority: 0.9 },
    { url: siteUrl("/games/lexi-daily"), changeFrequency: "daily", priority: 0.9 },
    { url: siteUrl("/privacy"), changeFrequency: "yearly", priority: 0.2 },
  ];
}
