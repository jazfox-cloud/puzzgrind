import { resolveGitSha } from "./lib/cloudflare-artifact.mjs";
import { evaluateHtmlCacheSafety } from "./lib/cache-safety.mjs";
import { differingPageSemanticFields, extractPageSemantics } from "./lib/html-semantics.mjs";

const ORIGIN = "https://puzzgrind.com";
const HTTP_ORIGIN = "http://puzzgrind.com";

function fail(label, message) {
  throw new Error(`Production smoke failed: ${label} ${message}`);
}

function assertDeploymentSafeCache(response, label) {
  const headers = {
    cacheControl: response.headers.get("cache-control") ?? "",
    cdnCacheControl: response.headers.get("cdn-cache-control") ?? "",
    cloudflareCdnCacheControl: response.headers.get("cloudflare-cdn-cache-control") ?? "",
  };
  const result = evaluateHtmlCacheSafety(headers);
  if (!result.safe) fail(label, `returned unsafe cache policy (${result.reason}): ${JSON.stringify(headers)}`);
}

function assertProductionHtml(html, canonical, label) {
  let semantics;
  try {
    semantics = extractPageSemantics(html);
  } catch (error) {
    fail(label, `has invalid page semantics: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (semantics.canonical !== canonical) fail(label, `has canonical ${JSON.stringify(semantics.canonical)}, expected ${JSON.stringify(canonical)}`);
  if (semantics.ogUrl !== canonical) fail(label, `has og:url ${JSON.stringify(semantics.ogUrl)}, expected ${JSON.stringify(canonical)}`);
  if (semantics.robots.toLowerCase().split(/[\s,]+/u).includes("noindex")) fail(label, "contains noindex");
  return semantics;
}

async function read(path, query) {
  const url = new URL(path, ORIGIN);
  if (query) url.searchParams.set("deploy-check", query);
  const response = await fetch(url, { redirect: "manual" });
  const body = await response.text();
  return { body, response };
}

async function assertHttpsRedirect(path) {
  const source = new URL(path, HTTP_ORIGIN);
  source.searchParams.set("redirect-check", "1");
  const expected = new URL(path, ORIGIN);
  expected.searchParams.set("redirect-check", "1");
  const response = await fetch(source, { redirect: "manual" });
  const location = response.headers.get("location");
  if (![301, 308].includes(response.status)) fail(source.href, `returned ${response.status}, expected 301 or 308`);
  if (location !== expected.href) fail(source.href, `redirected to ${JSON.stringify(location)}, expected ${JSON.stringify(expected.href)}`);
  console.log(`Production smoke: ${source.href} -> ${response.status} ${location}`);
}

const gitSha = resolveGitSha();
for (const path of ["/", "/sudoku", "/privacy"]) await assertHttpsRedirect(path);
for (const [path, canonical] of [["/", `${ORIGIN}/`], ["/privacy", `${ORIGIN}/privacy`]]) {
  const standard = await read(path);
  const busted = await read(path, gitSha);
  if (standard.response.status !== 200 || busted.response.status !== 200) fail(path, `returned ${standard.response.status}/${busted.response.status}`);
  assertDeploymentSafeCache(standard.response, path);
  assertDeploymentSafeCache(busted.response, `${path}?deploy-check`);
  const standardSemantics = assertProductionHtml(standard.body, canonical, path);
  const bustedSemantics = assertProductionHtml(busted.body, canonical, `${path}?deploy-check`);
  const differences = differingPageSemanticFields(standardSemantics, bustedSemantics);
  if (differences.length > 0) fail(path, `standard and cache-busted page semantics differ: ${differences.join(", ")}`);
  console.log(`Production smoke: ${path} standard/cache-busted SEO and cache policy match`);
}

const robots = await read("/robots.txt");
if (robots.response.status !== 200) fail("/robots.txt", `returned ${robots.response.status}`);
assertDeploymentSafeCache(robots.response, "/robots.txt");
for (const rule of ["Allow: /", "Disallow: /api/", "Disallow: /sudoku/share/", "Sitemap: https://puzzgrind.com/sitemap.xml"]) {
  if (!robots.body.includes(rule)) fail("/robots.txt", `is missing ${rule}`);
}
if (/^Disallow: \/$/m.test(robots.body)) fail("/robots.txt", "blocks the entire site");

const sitemap = await read("/sitemap.xml");
if (sitemap.response.status !== 200) fail("/sitemap.xml", `returned ${sitemap.response.status}`);
assertDeploymentSafeCache(sitemap.response, "/sitemap.xml");
for (const url of [`${ORIGIN}/`, `${ORIGIN}/sudoku`, `${ORIGIN}/privacy`]) {
  if (!sitemap.body.includes(`<loc>${url}</loc>`)) fail("/sitemap.xml", `is missing ${url}`);
}

const assetPath = robots.body && (await read("/")).body.match(/\/_next\/static\/[^"']+\.js/u)?.[0];
if (!assetPath) fail("/_next/static", "could not find a fingerprinted JavaScript asset");
const asset = await read(assetPath);
const assetCache = asset.response.headers.get("cache-control")?.toLowerCase() ?? "";
if (asset.response.status !== 200 || !assetCache.includes("max-age=31536000") || !assetCache.includes("immutable")) {
  fail(assetPath, `is not immutable (${asset.response.status}, ${JSON.stringify(assetCache)})`);
}

for (const [path, expected] of [["/sudoku", 200], ["/api/health", 200], ["/api/health/db", 200]]) {
  const { response } = await read(path);
  if (response.status !== expected) fail(path, `returned ${response.status}`);
  console.log(`Production smoke: ${path} -> ${response.status}`);
}

console.log("Production smoke: robots, sitemap, and immutable static assets passed");
