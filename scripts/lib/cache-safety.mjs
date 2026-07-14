function parseDirectives(value) {
  return value
    .split(",")
    .map((directive) => directive.trim().toLowerCase())
    .filter(Boolean)
    .map((directive) => {
      const separator = directive.indexOf("=");
      if (separator === -1) return { name: directive, value: undefined };
      return {
        name: directive.slice(0, separator).trim(),
        value: directive.slice(separator + 1).trim().replace(/^"|"$/gu, ""),
      };
    });
}

function inspectDirectives(value, label) {
  const directives = parseDirectives(value);
  if (directives.some(({ name }) => name === "s-maxage")) return `${label} contains s-maxage`;
  if (directives.some(({ name }) => name === "immutable")) return `${label} contains immutable`;

  for (const directive of directives.filter(({ name }) => name === "max-age")) {
    if (directive.value !== "0") return `${label} contains non-zero max-age`;
  }
  return undefined;
}

function inspectCdnDirectives(value, label) {
  if (!value) return undefined;
  const directives = parseDirectives(value);
  if (directives.some(({ name }) => name === "public")) return `${label} contains public`;
  if (directives.some(({ name }) => name === "max-age")) return `${label} contains max-age`;
  if (directives.some(({ name }) => name === "s-maxage")) return `${label} contains s-maxage`;
  if (directives.some(({ name }) => name === "immutable")) return `${label} contains immutable`;
  if (!directives.some(({ name }) => name === "no-store")) return `${label} does not explicitly contain no-store`;
  return undefined;
}

function hasDirective(value, name, expectedValue) {
  return parseDirectives(value).some((directive) => {
    if (directive.name !== name) return false;
    return expectedValue === undefined || directive.value === expectedValue;
  });
}

export function evaluateHtmlCacheSafety({ cacheControl = "", cdnCacheControl = "", cloudflareCdnCacheControl = "" }) {
  const browser = cacheControl.trim();
  const cdnHeaders = [
    ["CDN-Cache-Control", cdnCacheControl.trim()],
    ["Cloudflare-CDN-Cache-Control", cloudflareCdnCacheControl.trim()],
  ];

  const browserIssue = inspectDirectives(browser, "Cache-Control");
  if (browserIssue) return { safe: false, reason: browserIssue };
  for (const [label, value] of cdnHeaders) {
    const issue = inspectCdnDirectives(value, label);
    if (issue) return { safe: false, reason: issue };
  }

  const browserIsPrivate = hasDirective(browser, "private") || hasDirective(browser, "no-store");
  if (browserIsPrivate) return { safe: true, reason: "browser cache is private or disabled" };

  const browserIsZeroTtlPublic = hasDirective(browser, "public") && hasDirective(browser, "max-age", "0");
  const cdnIsDisabled = cdnHeaders.some(([, value]) => hasDirective(value, "no-store"));
  if (browserIsZeroTtlPublic && cdnIsDisabled) return { safe: true, reason: "public browser cache has zero TTL and CDN storage is disabled" };

  if (!browser) return { safe: false, reason: "Cache-Control is missing" };
  if (browserIsZeroTtlPublic) return { safe: false, reason: "public zero-TTL response is missing CDN no-store" };
  return { safe: false, reason: "Cache-Control is not private, no-store, or public with zero TTL" };
}
