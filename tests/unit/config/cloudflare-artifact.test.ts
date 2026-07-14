import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { finalizeArtifact, MARKER_PATH, validateArtifact } from "../../../scripts/lib/cloudflare-artifact.mjs";

const SHA = "14a8b0127ab54a4c8a689e0dab17627c14ca2d45";
function fixture(environment: "production" | "preview" | "staging") {
  const root = mkdtempSync(join(tmpdir(), "puzzgrind-artifact-"));
  const id = "build-id";
  mkdirSync(join(root, ".next"), { recursive: true });
  mkdirSync(join(root, ".open-next", "cache", id), { recursive: true });
  mkdirSync(join(root, ".open-next", "assets"), { recursive: true });
  mkdirSync(join(root, ".open-next", "server-functions", "default"), { recursive: true });
  writeFileSync(join(root, ".next", "BUILD_ID"), id);
  writeFileSync(join(root, ".open-next", "worker.js"), "worker");
  writeFileSync(join(root, ".open-next", "server-functions", "default", "handler.mjs"), "const buildEnvironment = 'frozen';");
  writeFileSync(
    join(root, ".open-next", "server-functions", "default", "open-next.config.mjs"),
    'var CACHE_DIR = "cdn-cgi/_next_cache"; var NAME = "cf-static-assets-incremental-cache";',
  );
  writeFileSync(join(root, ".next", "routes-manifest.json"), JSON.stringify({
    headers: ["/", "/privacy", "/robots.txt", "/sitemap.xml"].map((source) => ({
      source,
      headers: [
        { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        { key: "CDN-Cache-Control", value: "no-store" },
        { key: "Cloudflare-CDN-Cache-Control", value: "no-store" },
      ],
    })),
  }));
  writeFileSync(join(root, ".open-next", "assets", "_headers"), "/_next/static/*\n  Cache-Control: public, max-age=31536000, immutable\n");
  const production = environment === "production";
  const home = production ? '<link href="https://puzzgrind.com/" rel="canonical"/><meta content="https://puzzgrind.com/" property="og:url"/>' : '<meta name="robots" content="noindex,nofollow"/>';
  const privacy = production ? '<link rel="canonical" href="https://puzzgrind.com/privacy"/>' : '<meta name="robots" content="noindex,nofollow"/>';
  const robots = production ? "User-Agent: *\nAllow: /\nDisallow: /api/\nDisallow: /sudoku/share/\nSitemap: https://puzzgrind.com/sitemap.xml\n" : "User-Agent: *\nDisallow: /\n";
  const sitemap = '<urlset><url><loc>https://puzzgrind.com/</loc></url><url><loc>https://puzzgrind.com/sudoku</loc></url><url><loc>https://puzzgrind.com/privacy</loc></url></urlset>';
  for (const [name, value] of [["index.cache", { html: home }], ["privacy.cache", { html: privacy }], ["robots.txt.cache", { body: robots }], ["sitemap.xml.cache", { body: sitemap }]] as const) writeFileSync(join(root, ".open-next", "cache", id, name), JSON.stringify(value));
  finalizeArtifact({ environment, gitSha: SHA, root });
  return root;
}

describe("Cloudflare artifact provenance guard", () => {
  it.each(["production", "preview", "staging"] as const)("accepts a valid %s artifact", (environment) => {
    expect(validateArtifact({ environment, expectedGitSha: SHA, root: fixture(environment) }).environment).toBe(environment);
  });
  it.each(["preview", "staging"] as const)("rejects a %s artifact as Production", (environment) => {
    expect(() => validateArtifact({ environment: "production", expectedGitSha: SHA, root: fixture(environment) })).toThrow(/expected production/);
  });
  it("rejects marker environment and Git SHA mismatches", () => {
    const root = fixture("production");
    const markerPath = join(root, ".open-next", "assets", MARKER_PATH);
    const marker = JSON.parse(readFileSync(markerPath, "utf8"));
    writeFileSync(markerPath, JSON.stringify({ ...marker, environment: "preview" }));
    expect(() => validateArtifact({ environment: "production", expectedGitSha: SHA, root })).toThrow(/expected production/);
    writeFileSync(markerPath, JSON.stringify(marker));
    expect(() => validateArtifact({ environment: "production", expectedGitSha: "0".repeat(40), root })).toThrow(/Git SHA/);
  });
  it("rejects stale uploaded cache even if the marker is present", () => {
    const root = fixture("production");
    const marker = JSON.parse(readFileSync(join(root, ".open-next", "assets", MARKER_PATH), "utf8"));
    const [relative] = Object.keys(marker.files);
    const path = join(root, ".open-next", "assets", relative);
    writeFileSync(path, JSON.stringify({ html: '<meta name="robots" content="noindex"/>' }));
    expect(createHash("sha256").update(readFileSync(path)).digest("hex")).not.toBe(marker.files[relative]);
    expect(() => validateArtifact({ environment: "production", expectedGitSha: SHA, root })).toThrow(/digest/);
  });
  it("records every deployment-sensitive cache entry and the cache bypass policy", () => {
    const root = fixture("production");
    const marker = JSON.parse(readFileSync(join(root, ".open-next", "assets", MARKER_PATH), "utf8"));
    expect(Object.keys(marker.files)).toEqual(expect.arrayContaining([
      expect.stringMatching(/index\.cache$/u),
      expect.stringMatching(/privacy\.cache$/u),
      expect.stringMatching(/robots\.txt\.cache$/u),
      expect.stringMatching(/sitemap\.xml\.cache$/u),
    ]));
    expect(marker.cachePolicy).toEqual({
      strategy: "shared-html-bypass",
      html: "public, max-age=0, must-revalidate",
      cdn: "no-store",
      staticAssets: "public, max-age=31536000, immutable",
    });
  });
  it("rejects a long-lived shared cache policy for a deployment-sensitive route", () => {
    const root = fixture("production");
    const path = join(root, ".next", "routes-manifest.json");
    const manifest = JSON.parse(readFileSync(path, "utf8"));
    manifest.headers[0].headers[0].value = "s-maxage=31536000";
    writeFileSync(path, JSON.stringify(manifest));
    expect(() => validateArtifact({ environment: "production", expectedGitSha: SHA, root })).toThrow(/not deployment-safe/);
  });
  it("rejects an artifact that loses immutable caching for fingerprinted assets", () => {
    const root = fixture("production");
    writeFileSync(join(root, ".open-next", "assets", "_headers"), "");
    expect(() => validateArtifact({ environment: "production", expectedGitSha: SHA, root })).toThrow(/not immutable/);
  });
  it("rejects an artifact without the Build-ID-versioned OpenNext cache adapter", () => {
    const root = fixture("production");
    writeFileSync(join(root, ".open-next", "server-functions", "default", "open-next.config.mjs"), "dummy incremental cache");
    expect(() => validateArtifact({ environment: "production", expectedGitSha: SHA, root })).toThrow(/not Build-ID-versioned/);
  });
  it("rejects a server bundle that can re-resolve the build environment at runtime", () => {
    const root = fixture("production");
    writeFileSync(join(root, ".open-next", "server-functions", "default", "handler.mjs"), "process.env.BUILD_APP_ENV");
    expect(() => validateArtifact({ environment: "production", expectedGitSha: SHA, root })).toThrow(/at runtime/);
  });
  it("keeps Preview and rollback artifacts out of the shared HTML cache", () => {
    const sharedCache = new Map<string, string>();
    const store = (value: string, cdnCacheControl: string) => {
      if (cdnCacheControl !== "no-store") sharedCache.set("https://puzzgrind.com/", value);
    };
    store("production-a", "no-store");
    store("preview-b", "no-store");
    expect(sharedCache.has("https://puzzgrind.com/")).toBe(false);
    expect(validateArtifact({ environment: "production", expectedGitSha: SHA, root: fixture("production") }).cachePolicy.cdn).toBe("no-store");
  });
});
