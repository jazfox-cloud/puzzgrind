import type { MetadataRoute } from "next";

import { getAppEnvironment, isIndexableEnvironment } from "@/lib/seo";
import { SITE, siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export function createRobots(environment: ReturnType<typeof getAppEnvironment>): MetadataRoute.Robots {
  if (!isIndexableEnvironment(environment)) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/sudoku/share/"] },
    sitemap: siteUrl("/sitemap.xml"),
    host: SITE.origin,
  };
}

export default function robots(): MetadataRoute.Robots {
  return createRobots(getAppEnvironment());
}
