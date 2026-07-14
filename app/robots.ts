import type { MetadataRoute } from "next";

import { getBuildAppEnvironment, type AppEnvironment } from "@/lib/build-environment";
import { isIndexableEnvironment } from "@/lib/seo";
import { SITE, siteUrl } from "@/lib/site";

export function createRobots(environment: AppEnvironment): MetadataRoute.Robots {
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
  return createRobots(getBuildAppEnvironment());
}
