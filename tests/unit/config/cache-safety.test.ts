import { describe, expect, it } from "vitest";

import { evaluateHtmlCacheSafety } from "../../../scripts/lib/cache-safety.mjs";

function expectSafe(cacheControl: string, cdnCacheControl = "", cloudflareCdnCacheControl = "") {
  expect(evaluateHtmlCacheSafety({ cacheControl, cdnCacheControl, cloudflareCdnCacheControl })).toMatchObject({ safe: true });
}

function expectUnsafe(cacheControl: string, cdnCacheControl = "", cloudflareCdnCacheControl = "") {
  expect(evaluateHtmlCacheSafety({ cacheControl, cdnCacheControl, cloudflareCdnCacheControl })).toMatchObject({ safe: false });
}

describe("semantic HTML cache safety", () => {
  it.each([
    ["PR #9 Production response", "private, no-cache, no-store, max-age=0, must-revalidate"],
    ["private zero TTL", "private, max-age=0"],
    ["no-store", "no-store"],
    ["case, order, and whitespace variations", "  MUST-REVALIDATE , MAX-AGE = 0, PRIVATE  "],
  ])("accepts %s", (_label, cacheControl) => {
    expectSafe(cacheControl);
  });

  it("accepts public zero TTL with CDN-Cache-Control no-store", () => {
    expectSafe("public, max-age=0", "no-store");
  });

  it("accepts public zero TTL with Cloudflare-CDN-Cache-Control no-store", () => {
    expectSafe("public, max-age=0", "", "no-store");
  });

  it("accepts private no-store when CDN-specific headers are missing", () => {
    expectSafe("private, no-store");
  });

  it("accepts private no-store with explicit CDN no-store", () => {
    expectSafe("private, no-store", "no-store");
  });

  it.each([
    ["old one-year shared cache regression", "public, max-age=0, s-maxage=31536000, must-revalidate", "", ""],
    ["private response with shared cache TTL", "private, no-store, s-maxage=60", "", ""],
    ["positive public browser TTL", "public, max-age=60", "no-store", ""],
    ["one-year public browser TTL", "public, max-age=31536000", "no-store", ""],
    ["public immutable HTML", "public, immutable", "no-store", ""],
    ["private immutable HTML", "private, immutable", "", ""],
    ["empty Cache-Control", "", "", ""],
    ["public zero TTL without CDN no-store", "public, max-age=0", "", ""],
    ["positive CDN TTL", "private, no-store", "max-age=60", ""],
    ["positive Cloudflare CDN TTL", "private, no-store", "", "public, max-age=31536000"],
    ["ambiguous public CDN policy", "private, no-store", "public", ""],
    ["zero-TTL CDN policy without no-store", "private, no-store", "max-age=0", ""],
    ["private Cloudflare CDN policy without no-store", "private, no-store", "", "private"],
    ["one safe and one ambiguous CDN policy", "public, max-age=0", "no-store", "public"],
  ])("rejects %s", (_label, cacheControl, cdnCacheControl, cloudflareCdnCacheControl) => {
    expectUnsafe(cacheControl, cdnCacheControl, cloudflareCdnCacheControl);
  });
});
