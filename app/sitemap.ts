import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: siteUrl("/games/mini-sudoku"), changeFrequency: "monthly", priority: 0.8 },
    { url: siteUrl("/guides/6x6-sudoku-single-candidate"), changeFrequency: "monthly", priority: 0.6 },
    { url: siteUrl("/guides/6x6-sudoku-conflicts"), changeFrequency: "monthly", priority: 0.6 },
    { url: siteUrl("/sudoku"), changeFrequency: "daily", priority: 0.9 },
    { url: siteUrl("/games/lexi-daily"), changeFrequency: "daily", priority: 0.9 },
    { url: siteUrl("/privacy"), changeFrequency: "yearly", priority: 0.2 },
  ];
}
