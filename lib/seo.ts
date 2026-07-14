import type { Metadata } from "next";

import type { AppEnvironment } from "@/lib/build-environment";
import { SITE, siteUrl } from "@/lib/site";

export type { AppEnvironment } from "@/lib/build-environment";

export const HOME_SEO = {
  title: "Daily Sudoku with Explainable Hints",
  description: "Play one shared Sudoku every day with hints that explain the next logical step instead of revealing the answer.",
  path: "/",
} as const;

export const SUDOKU_SEO = {
  title: "Daily Sudoku with Logical Hints",
  description: "Play today's shared Sudoku with notes, saved progress, and explainable hints that teach the logic behind each move.",
  path: "/sudoku",
} as const;

export const PRIVACY_SEO = {
  title: "Privacy and Analytics",
  description: "Learn how optional Google Analytics works on PuzzGrind and how to accept, reject, or withdraw analytics consent.",
  path: "/privacy",
} as const;

export const NOINDEX_ROBOTS = { index: false, follow: false, noarchive: true } as const;

export const WEBSITE_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE.name,
  url: siteUrl("/"),
  description: HOME_SEO.description,
} as const;

export const SUDOKU_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "PuzzGrind Daily Sudoku",
  url: siteUrl("/sudoku"),
  description: SUDOKU_SEO.description,
  applicationCategory: "GameApplication",
  operatingSystem: "Web",
} as const;

export function isIndexableEnvironment(environment: AppEnvironment) {
  return environment === "production";
}

export function robotsMetadata(environment: AppEnvironment): Metadata["robots"] {
  return isIndexableEnvironment(environment)
    ? undefined
    : NOINDEX_ROBOTS;
}

export function createRootMetadata(environment: AppEnvironment): Metadata {
  return {
    metadataBase: new URL(SITE.origin),
    applicationName: SITE.name,
    title: { default: SITE.defaultTitle, template: SITE.titleTemplate },
    description: SITE.defaultDescription,
    alternates: undefined,
    openGraph: {
      type: "website",
      siteName: SITE.name,
      locale: SITE.locale,
      title: SITE.defaultTitle,
      description: SITE.defaultDescription,
      url: undefined,
      images: [{ url: siteUrl(SITE.socialImagePath), width: 1200, height: 630, alt: "PuzzGrind Daily Sudoku" }],
    },
    twitter: {
      card: SITE.twitterCard,
      title: SITE.defaultTitle,
      description: SITE.defaultDescription,
      images: [siteUrl(SITE.socialImagePath)],
    },
    robots: robotsMetadata(environment),
    icons: {
      icon: [{ url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" }],
      apple: [{ url: "/icons/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
      shortcut: ["/favicon.svg"],
    },
    manifest: "/manifest.webmanifest",
  };
}

export function createPageMetadata(
  page: { title: string; description: string; path: string },
  environment: AppEnvironment,
): Metadata {
  const indexable = isIndexableEnvironment(environment);
  const canonical = siteUrl(page.path);
  const socialImage = siteUrl(SITE.socialImagePath);
  return {
    title: { absolute: `${page.title} | ${SITE.name}` },
    description: page.description,
    alternates: indexable && page.path !== "/" ? { canonical } : undefined,
    openGraph: {
      type: "website",
      siteName: SITE.name,
      locale: SITE.locale,
      title: `${page.title} | ${SITE.name}`,
      description: page.description,
      url: indexable && page.path !== "/" ? canonical : undefined,
      images: [{ url: socialImage, width: 1200, height: 630, alt: "PuzzGrind Daily Sudoku" }],
    },
    twitter: {
      card: SITE.twitterCard,
      title: `${page.title} | ${SITE.name}`,
      description: page.description,
      images: [socialImage],
    },
    robots: robotsMetadata(environment),
  };
}

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
