import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import manifest from "@/app/manifest";
import NotFound from "@/app/not-found";
import { createRobots } from "@/app/robots";
import sitemap from "@/app/sitemap";
import { JsonLd } from "@/components/JsonLd";
import {
  createPageMetadata,
  createRootMetadata,
  HOME_SEO,
  LEXI_JSON_LD,
  LEXI_SEO,
  NOINDEX_ROBOTS,
  PRIVACY_SEO,
  serializeJsonLd,
  SUDOKU_JSON_LD,
  SUDOKU_SEO,
  WEBSITE_JSON_LD,
} from "@/lib/seo";
import { SITE, siteUrl } from "@/lib/site";

describe("SEO foundation", () => {
  it("centralizes the immutable Production origin and stable social image", () => {
    expect(SITE.origin).toBe("https://puzzgrind.com");
    expect(siteUrl("/sudoku")).toBe("https://puzzgrind.com/sudoku");
    expect(siteUrl(SITE.socialImagePath)).toBe("https://puzzgrind.com/og/puzzgrind-social.png");
  });

  it("creates indexable Production metadata with canonical and social tags", () => {
    const root = createRootMetadata("production");
    const home = createPageMetadata(HOME_SEO, "production");
    const sudoku = createPageMetadata(SUDOKU_SEO, "production");
    const privacy = createPageMetadata(PRIVACY_SEO, "production");
    const lexi = createPageMetadata(LEXI_SEO, "production");
    expect(root.metadataBase?.toString()).toBe("https://puzzgrind.com/");
    expect(root.robots).toBeUndefined();
    expect(root.alternates).toBeUndefined();
    expect(home.alternates).toBeUndefined();
    expect(home.openGraph?.url).toBeUndefined();
    expect(sudoku.alternates?.canonical).toBe("https://puzzgrind.com/sudoku");
    expect(sudoku.openGraph?.url).toBe("https://puzzgrind.com/sudoku");
    expect(privacy.alternates?.canonical).toBe("https://puzzgrind.com/privacy");
    expect(lexi.alternates?.canonical).toBe("https://puzzgrind.com/games/lexi-daily");
    expect(home.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it.each(["preview", "staging"] as const)("makes %s metadata non-indexable without a Production canonical", (environment) => {
    const metadata = createPageMetadata(HOME_SEO, environment);
    expect(metadata.robots).toEqual(NOINDEX_ROBOTS);
    expect(metadata.alternates).toBeUndefined();
    expect(metadata.openGraph?.url).toBeUndefined();
  });

  it("returns simple, consistent robots rules for Production and non-production", () => {
    expect(createRobots("production")).toEqual({
      rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/sudoku/share/"] },
      sitemap: "https://puzzgrind.com/sitemap.xml",
      host: "https://puzzgrind.com",
    });
    expect(createRobots("preview")).toEqual({ rules: { userAgent: "*", disallow: "/" } });
    expect(createRobots("staging")).toEqual({ rules: { userAgent: "*", disallow: "/" } });
  });

  it("limits the sitemap to the four public Production URLs", () => {
    expect(sitemap().map(({ url }) => url)).toEqual([
      "https://puzzgrind.com/",
      "https://puzzgrind.com/sudoku",
      "https://puzzgrind.com/games/lexi-daily",
      "https://puzzgrind.com/privacy",
    ]);
  });

  it("uses valid, factual JSON-LD without ratings or user claims", () => {
    expect(WEBSITE_JSON_LD).toMatchObject({ "@context": "https://schema.org", "@type": "WebSite" });
    expect(SUDOKU_JSON_LD).toMatchObject({
      "@context": "https://schema.org",
      "@type": "WebApplication",
      applicationCategory: "GameApplication",
      operatingSystem: "Web",
    });
    expect(LEXI_JSON_LD).toMatchObject({ "@type": "WebApplication", applicationCategory: "GameApplication" });
    expect(serializeJsonLd({ value: "</script>" })).not.toContain("<");
    expect(renderToStaticMarkup(createElement(JsonLd, { data: WEBSITE_JSON_LD }))).toContain("application/ld+json");
  });

  it("keeps share pages noindex and removes Host-header URL construction", () => {
    const source = readFileSync("app/sudoku/share/[token]/page.tsx", "utf8");
    expect(source).toContain("robots: NOINDEX_ROBOTS");
    expect(source).not.toContain("x-forwarded-host");
    expect(source).not.toContain("headers()");
  });

  it("provides a basic manifest and a noindex recovery page", () => {
    expect(manifest()).toMatchObject({
      name: "PuzzGrind",
      short_name: "PuzzGrind",
      start_url: "/",
      display: "standalone",
    });
    expect(manifest().icons).toHaveLength(2);
    const notFoundHtml = renderToStaticMarkup(createElement(NotFound));
    expect(notFoundHtml).toContain("This square is empty");
    expect(notFoundHtml).toContain('href="/sudoku"');
    expect(notFoundHtml).toContain('href="/games/lexi-daily"');
  });
});
