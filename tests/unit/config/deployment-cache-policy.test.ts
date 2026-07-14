import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import nextConfig from "../../../next.config";

const SAFE_ROUTES = ["/", "/privacy", "/robots.txt", "/sitemap.xml"];

describe("deployment cache isolation", () => {
  it("bypasses shared CDN caching for deployment-sensitive routes", async () => {
    const rules = await nextConfig.headers?.();
    expect(rules).toHaveLength(SAFE_ROUTES.length);
    for (const source of SAFE_ROUTES) {
      const rule = rules?.find((entry) => entry.source === source);
      expect(Object.fromEntries(rule?.headers.map(({ key, value }) => [key.toLowerCase(), value]) ?? [])).toEqual({
        "cache-control": "public, max-age=0, must-revalidate",
        "cdn-cache-control": "no-store",
        "cloudflare-cdn-cache-control": "no-store",
      });
    }
  });

  it("keeps fingerprinted Next assets immutable without applying that policy to HTML", () => {
    const headers = readFileSync(join(process.cwd(), "public", "_headers"), "utf8");
    expect(headers).toContain("/_next/static/*");
    expect(headers).toContain("Cache-Control: public, max-age=31536000, immutable");
    expect(headers).not.toMatch(/^\/\s*$/mu);
    expect(headers).not.toContain("/privacy");
  });
});
