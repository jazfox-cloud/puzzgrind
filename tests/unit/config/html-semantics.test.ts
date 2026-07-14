import { describe, expect, it } from "vitest";

import { differingPageSemanticFields, extractPageSemantics } from "../../../scripts/lib/html-semantics.mjs";

type PageOptions = {
  canonical?: string;
  description?: string;
  main?: string;
  ogUrl?: string;
  robots?: string | null;
  scripts?: string;
  title?: string;
};

const PRODUCTION_URL = "https://puzzgrind.com/";

function page({
  canonical = PRODUCTION_URL,
  description = "Daily &amp; logical puzzles",
  main = "<h1>Play smarter</h1><p>One puzzle at a time.</p>",
  ogUrl = PRODUCTION_URL,
  robots = null,
  scripts = '<script nonce="first">self.__next_f.push(["standard"])</script>',
  title = "PuzzGrind",
}: PageOptions = {}) {
  const robotsMeta = robots === null ? "" : `<meta name="robots" content="${robots}">`;
  return `<!doctype html><html><head><title>${title}</title><meta name="description" content="${description}"><link rel="canonical" href="${canonical}"><meta property="og:url" content="${ogUrl}">${robotsMeta}</head><body><main>${main}</main>${scripts}</body></html>`;
}

function differences(left: string, right: string) {
  return differingPageSemanticFields(extractPageSemantics(left), extractPageSemantics(right));
}

describe("stable page semantics", () => {
  it("ignores Next hydration and RSC differences when SEO and visible content match", () => {
    const standard = page({ scripts: '<script nonce="one">self.__next_f.push(["standard-flight"])</script><script src="a.js"></script>' });
    const busted = page({ scripts: '<script src="b.js"></script><script nonce="two">self.__next_f.push(["busted-flight"])</script>' });
    expect(differences(standard, busted)).toEqual([]);
  });

  it("supports metadata attribute order, quote, and case variations", () => {
    const variant = `<!doctype html><HTML><HEAD><TITLE>PuzzGrind</TITLE><META CONTENT='Daily &amp; logical puzzles' NAME='DESCRIPTION'><LINK HREF='${PRODUCTION_URL}' REL='CANONICAL'><META CONTENT='${PRODUCTION_URL}' PROPERTY='OG:URL'></HEAD><BODY><MAIN>\n<h1> Play smarter </h1> <p>One puzzle at a time.</p>\n</MAIN></BODY></HTML>`;
    expect(differences(page(), variant)).toEqual([]);
  });

  it("normalizes visible text whitespace and common and numeric entities", () => {
    const standard = page({ main: "<p>Privacy &amp; analytics &#8212; optional&#x20;choice</p>" });
    const variant = page({ main: "<p> Privacy &amp; analytics\n— optional choice </p>" });
    expect(differences(standard, variant)).toEqual([]);
  });

  it("removes scripts, styles, templates, comments, hidden framework content, and tags from main text", () => {
    const standard = page({ main: "<h1>Visible</h1><p>content</p>" });
    const variant = page({ main: "<!-- hidden --><style>.different{}</style><script>different()</script><template>different</template><div hidden>framework state</div><h1>Visible</h1><p>content</p>" });
    expect(differences(standard, variant)).toEqual([]);
  });

  it.each([
    ["canonical", page({ canonical: "https://preview.example/" })],
    ["ogUrl", page({ ogUrl: "https://preview.example/" })],
    ["title", page({ title: "Preview PuzzGrind" })],
    ["description", page({ description: "Preview description" })],
    ["robots", page({ robots: "noindex, nofollow" })],
    ["mainText", page({ main: "<h1>Different visible page</h1>" })],
  ])("reports a changed %s field", (field, variant) => {
    expect(differences(page(), variant)).toEqual([field]);
  });

  it("detects a Preview page instead of accepting Production semantics", () => {
    const preview = page({ canonical: "https://preview.example/", ogUrl: "https://preview.example/", robots: "noindex, nofollow" });
    expect(differences(page(), preview)).toEqual(["canonical", "ogUrl", "robots"]);
  });

  it("treats an omitted robots meta as the stable indexable default", () => {
    expect(extractPageSemantics(page()).robots).toBe("");
  });

  it("rejects missing main", () => {
    expect(() => extractPageSemantics(page().replace(/<main>[\s\S]*?<\/main>/u, ""))).toThrow("Expected a <main> element");
  });

  it("rejects duplicate canonicals", () => {
    expect(() => extractPageSemantics(page().replace("</head>", `<link rel="canonical" href="${PRODUCTION_URL}"></head>`))).toThrow(
      "Expected exactly one canonical link, found 2",
    );
  });

  it.each([
    ["canonical", /<link rel="canonical"[^>]*>/u],
    ["og:url", /<meta property="og:url"[^>]*>/u],
    ["title", /<title>[\s\S]*?<\/title>/u],
    ["description", /<meta name="description"[^>]*>/u],
  ])("rejects missing required %s metadata", (_label, pattern) => {
    expect(() => extractPageSemantics(page().replace(pattern, ""))).toThrow();
  });
});
