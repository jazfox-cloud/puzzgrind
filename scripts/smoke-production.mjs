import { resolveGitSha } from "./lib/cloudflare-artifact.mjs";

const ORIGIN = "https://puzzgrind.com";
const SAFE_CACHE_CONTROL = "public, max-age=0, must-revalidate";

function occurrences(value, needle) {
  return value.split(needle).length - 1;
}

function fail(label, message) {
  throw new Error(`Production smoke failed: ${label} ${message}`);
}

function assertDeploymentSafeCache(response, label) {
  const cacheControl = response.headers.get("cache-control")?.toLowerCase() ?? "";
  const cdnCacheControl = response.headers.get("cdn-cache-control")?.toLowerCase() ?? "";
  if (cacheControl !== SAFE_CACHE_CONTROL) fail(label, `returned unsafe Cache-Control ${JSON.stringify(cacheControl)}`);
  if (cdnCacheControl !== "no-store") fail(label, `returned unsafe CDN-Cache-Control ${JSON.stringify(cdnCacheControl)}`);
  if (cacheControl.includes("s-maxage") || cacheControl.includes("31536000")) fail(label, "returned a long-lived shared cache directive");
}

function assertProductionHtml(html, canonical, label) {
  const canonicalForms = [`rel="canonical" href="${canonical}"`, `href="${canonical}" rel="canonical"`];
  const canonicalCount = canonicalForms.reduce((count, form) => count + occurrences(html, form), 0);
  if (canonicalCount !== 1) fail(label, `has ${canonicalCount} Production canonicals`);
  if (html.toLowerCase().includes("noindex")) fail(label, "contains noindex");
}

async function read(path, query) {
  const url = new URL(path, ORIGIN);
  if (query) url.searchParams.set("deploy-check", query);
  const response = await fetch(url, { redirect: "manual" });
  const body = await response.text();
  return { body, response };
}

const gitSha = resolveGitSha();
for (const [path, canonical] of [["/", `${ORIGIN}/`], ["/privacy", `${ORIGIN}/privacy`]]) {
  const standard = await read(path);
  const busted = await read(path, gitSha);
  if (standard.response.status !== 200 || busted.response.status !== 200) fail(path, `returned ${standard.response.status}/${busted.response.status}`);
  assertDeploymentSafeCache(standard.response, path);
  assertDeploymentSafeCache(busted.response, `${path}?deploy-check`);
  assertProductionHtml(standard.body, canonical, path);
  assertProductionHtml(busted.body, canonical, `${path}?deploy-check`);
  if (standard.body !== busted.body) fail(path, "standard and cache-busted HTML differ");
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
