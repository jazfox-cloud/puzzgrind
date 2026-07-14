import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const ARTIFACT_ENVIRONMENTS = ["preview", "staging", "production"];
export const MARKER_PATH = "cdn-cgi/puzzgrind/build-environment.json";
const CACHE_ROOT = "cdn-cgi/_next_cache";
const CACHE_FILES = ["index.cache", "privacy.cache", "robots.txt.cache", "sitemap.xml.cache"];
const DEPLOYMENT_SENSITIVE_ROUTES = ["/", "/privacy", "/robots.txt", "/sitemap.xml"];
const HTML_CACHE_CONTROL = "public, max-age=0, must-revalidate";
const CDN_CACHE_CONTROL = "no-store";
const STATIC_ASSET_CACHE_CONTROL = "public, max-age=31536000, immutable";

export function cleanArtifacts(root = process.cwd()) {
  rmSync(join(root, ".next"), { recursive: true, force: true });
  rmSync(join(root, ".open-next"), { recursive: true, force: true });
}

export function resolveGitSha(root = process.cwd(), source = process.env) {
  const ciSha = source.WORKERS_CI_COMMIT_SHA?.trim();
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  if (ciSha && ciSha !== head) throw new Error(`Git SHA mismatch: WORKERS_CI_COMMIT_SHA=${ciSha}, HEAD=${head}`);
  return ciSha || head;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function cacheFile(assets, buildId, name) {
  return join(assets, CACHE_ROOT, buildId, name);
}

function validateCachePolicyFiles(root) {
  const routesManifestPath = join(root, ".next", "routes-manifest.json");
  if (!existsSync(routesManifestPath)) fail(routesManifestPath, "missing routes manifest");
  const routesManifest = JSON.parse(readFileSync(routesManifestPath, "utf8"));
  for (const route of DEPLOYMENT_SENSITIVE_ROUTES) {
    const rule = routesManifest.headers?.find((entry) => entry.source === route);
    if (!rule) fail(routesManifestPath, `missing cache policy for ${route}`);
    const headers = Object.fromEntries(rule.headers.map(({ key, value }) => [key.toLowerCase(), value]));
    if (headers["cache-control"] !== HTML_CACHE_CONTROL) fail(routesManifestPath, `${route} Cache-Control is not deployment-safe`);
    if (headers["cdn-cache-control"] !== CDN_CACHE_CONTROL) fail(routesManifestPath, `${route} CDN-Cache-Control is not no-store`);
    if (headers["cloudflare-cdn-cache-control"] !== CDN_CACHE_CONTROL) fail(routesManifestPath, `${route} Cloudflare-CDN-Cache-Control is not no-store`);
  }

  const staticHeadersPath = join(root, ".open-next", "assets", "_headers");
  if (!existsSync(staticHeadersPath)) fail(staticHeadersPath, "missing static asset cache policy");
  const staticHeaders = readFileSync(staticHeadersPath, "utf8");
  if (!staticHeaders.includes("/_next/static/*") || !staticHeaders.includes(`Cache-Control: ${STATIC_ASSET_CACHE_CONTROL}`)) {
    fail(staticHeadersPath, "fingerprinted Next assets are not immutable");
  }

  const openNextConfigPath = join(root, ".open-next", "server-functions", "default", "open-next.config.mjs");
  if (!existsSync(openNextConfigPath)) fail(openNextConfigPath, "missing bundled OpenNext configuration");
  const openNextConfig = readFileSync(openNextConfigPath, "utf8");
  if (!openNextConfig.includes('CACHE_DIR = "cdn-cgi/_next_cache"') || !openNextConfig.includes('NAME = "cf-static-assets-incremental-cache"')) {
    fail(openNextConfigPath, "OpenNext incremental cache is not Build-ID-versioned static assets");
  }

  const handlerPath = join(root, ".open-next", "server-functions", "default", "handler.mjs");
  if (!existsSync(handlerPath)) fail(handlerPath, "missing server bundle");
  const handler = readFileSync(handlerPath, "utf8");
  if (handler.includes("__PUZZGRIND_BUILD_APP_ENV__") || handler.includes("process.env.BUILD_APP_ENV") || handler.includes("BUILD_APP_ENV?.trim")) {
    fail(handlerPath, "server bundle still resolves BUILD_APP_ENV at runtime");
  }
}

export function finalizeArtifact({ environment, gitSha, root = process.cwd() }) {
  if (!ARTIFACT_ENVIRONMENTS.includes(environment)) throw new Error(`Unsupported artifact environment: ${environment}`);
  const buildId = readFileSync(join(root, ".next", "BUILD_ID"), "utf8").trim();
  const sourceCache = join(root, ".open-next", "cache");
  const assets = join(root, ".open-next", "assets");
  const uploadedCache = join(assets, CACHE_ROOT);
  if (!existsSync(join(sourceCache, buildId))) throw new Error(`Missing OpenNext cache for build ${buildId}: ${sourceCache}`);
  rmSync(uploadedCache, { recursive: true, force: true });
  mkdirSync(uploadedCache, { recursive: true });
  cpSync(sourceCache, uploadedCache, { recursive: true });

  const files = {};
  for (const name of CACHE_FILES) {
    const path = cacheFile(assets, buildId, name);
    files[`${CACHE_ROOT}/${buildId}/${name}`] = sha256(readFileSync(path));
  }
  const marker = {
    environment,
    gitSha,
    schemaVersion: 2,
    buildId,
    files,
    cachePolicy: {
      strategy: "shared-html-bypass",
      html: HTML_CACHE_CONTROL,
      cdn: CDN_CACHE_CONTROL,
      staticAssets: STATIC_ASSET_CACHE_CONTROL,
    },
  };
  const markerFile = join(assets, MARKER_PATH);
  mkdirSync(resolve(markerFile, ".."), { recursive: true });
  writeFileSync(markerFile, `${JSON.stringify(marker, null, 2)}\n`);
  return marker;
}

function occurrences(value, needle) {
  return value.split(needle).length - 1;
}

function fail(path, message) {
  throw new Error(`Artifact validation failed: ${message} (${path})`);
}

export function validateArtifact({ environment, expectedGitSha, root = process.cwd() }) {
  const assets = join(root, ".open-next", "assets");
  const markerFile = join(assets, MARKER_PATH);
  if (!existsSync(markerFile)) fail(markerFile, "missing build-environment marker");
  const marker = JSON.parse(readFileSync(markerFile, "utf8"));
  if (marker.schemaVersion !== 2) fail(markerFile, "unsupported marker schema");
  if (marker.environment !== environment) fail(markerFile, `expected ${environment}, found ${marker.environment}`);
  if (marker.gitSha !== expectedGitSha) fail(markerFile, `expected Git SHA ${expectedGitSha}, found ${marker.gitSha}`);
  if (marker.cachePolicy?.strategy !== "shared-html-bypass") fail(markerFile, "missing shared HTML cache bypass policy");
  if (marker.cachePolicy?.html !== HTML_CACHE_CONTROL || marker.cachePolicy?.cdn !== CDN_CACHE_CONTROL) fail(markerFile, "unsafe HTML cache policy");
  if (marker.cachePolicy?.staticAssets !== STATIC_ASSET_CACHE_CONTROL) fail(markerFile, "unsafe static asset cache policy");
  validateCachePolicyFiles(root);

  const paths = Object.fromEntries(CACHE_FILES.map((name) => [name, cacheFile(assets, marker.buildId, name)]));
  for (const path of Object.values(paths)) if (!existsSync(path)) fail(path, "missing uploaded cache entry");
  for (const [relative, digest] of Object.entries(marker.files ?? {})) {
    const path = join(assets, relative);
    if (!existsSync(path) || sha256(readFileSync(path)) !== digest) fail(path, "content does not match marker digest");
  }
  const home = JSON.parse(readFileSync(paths["index.cache"], "utf8")).html ?? "";
  const privacy = JSON.parse(readFileSync(paths["privacy.cache"], "utf8")).html ?? "";
  const robots = JSON.parse(readFileSync(paths["robots.txt.cache"], "utf8")).body ?? "";
  const sitemap = JSON.parse(readFileSync(paths["sitemap.xml.cache"], "utf8")).body ?? "";

  if (environment === "production") {
    if (occurrences(home, 'href="https://puzzgrind.com/" rel="canonical"') + occurrences(home, 'rel="canonical" href="https://puzzgrind.com/"') !== 1) fail(paths["index.cache"], "home canonical is not exactly Production URL");
    if (!home.includes('content="https://puzzgrind.com/" property="og:url"') && !home.includes('property="og:url" content="https://puzzgrind.com/"')) fail(paths["index.cache"], "home og:url is missing");
    if (!privacy.includes('rel="canonical" href="https://puzzgrind.com/privacy"') && !privacy.includes('href="https://puzzgrind.com/privacy" rel="canonical"')) fail(paths["privacy.cache"], "privacy canonical is missing");
    if (home.includes("noindex") || privacy.includes("noindex")) fail(paths["index.cache"], "Production page contains noindex");
    for (const rule of ["Allow: /", "Disallow: /api/", "Disallow: /sudoku/share/", "Sitemap: https://puzzgrind.com/sitemap.xml"]) if (!robots.includes(rule)) fail(paths["robots.txt.cache"], `missing ${rule}`);
    if (/^Disallow: \/$/m.test(robots)) fail(paths["robots.txt.cache"], "Production robots blocks the entire site");
    for (const url of ["https://puzzgrind.com/", "https://puzzgrind.com/sudoku", "https://puzzgrind.com/privacy"]) if (!sitemap.includes(`<loc>${url}</loc>`)) fail(paths["sitemap.xml.cache"], `missing ${url}`);
  } else {
    if (home.includes('rel="canonical"') || privacy.includes('rel="canonical"')) fail(paths["index.cache"], `${environment} contains canonical`);
    if (home.includes('property="og:url"') || privacy.includes('property="og:url"')) fail(paths["index.cache"], `${environment} contains og:url`);
    if (!home.includes("noindex") || !privacy.includes("noindex")) fail(paths["index.cache"], `${environment} is missing noindex`);
    if (!/^Disallow: \/$/m.test(robots)) fail(paths["robots.txt.cache"], `${environment} robots is not site-wide disallow`);
  }
  if (!existsSync(join(root, ".open-next", "worker.js"))) fail(join(root, ".open-next", "worker.js"), "missing Worker bundle");
  return marker;
}
