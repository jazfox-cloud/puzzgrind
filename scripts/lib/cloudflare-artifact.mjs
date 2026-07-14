import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const ARTIFACT_ENVIRONMENTS = ["preview", "staging", "production"];
export const MARKER_PATH = "cdn-cgi/puzzgrind/build-environment.json";
const CACHE_ROOT = "cdn-cgi/_next_cache";

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
  for (const name of ["index.cache", "privacy.cache", "robots.txt.cache"]) {
    const path = cacheFile(assets, buildId, name);
    files[`${CACHE_ROOT}/${buildId}/${name}`] = sha256(readFileSync(path));
  }
  const marker = { environment, gitSha, schemaVersion: 1, buildId, files };
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
  if (marker.schemaVersion !== 1) fail(markerFile, "unsupported marker schema");
  if (marker.environment !== environment) fail(markerFile, `expected ${environment}, found ${marker.environment}`);
  if (marker.gitSha !== expectedGitSha) fail(markerFile, `expected Git SHA ${expectedGitSha}, found ${marker.gitSha}`);

  const paths = Object.fromEntries(["index.cache", "privacy.cache", "robots.txt.cache"].map((name) => [name, cacheFile(assets, marker.buildId, name)]));
  for (const path of Object.values(paths)) if (!existsSync(path)) fail(path, "missing uploaded cache entry");
  for (const [relative, digest] of Object.entries(marker.files ?? {})) {
    const path = join(assets, relative);
    if (!existsSync(path) || sha256(readFileSync(path)) !== digest) fail(path, "content does not match marker digest");
  }
  const home = JSON.parse(readFileSync(paths["index.cache"], "utf8")).html ?? "";
  const privacy = JSON.parse(readFileSync(paths["privacy.cache"], "utf8")).html ?? "";
  const robots = JSON.parse(readFileSync(paths["robots.txt.cache"], "utf8")).body ?? "";

  if (environment === "production") {
    if (occurrences(home, 'href="https://puzzgrind.com/" rel="canonical"') + occurrences(home, 'rel="canonical" href="https://puzzgrind.com/"') !== 1) fail(paths["index.cache"], "home canonical is not exactly Production URL");
    if (!home.includes('content="https://puzzgrind.com/" property="og:url"') && !home.includes('property="og:url" content="https://puzzgrind.com/"')) fail(paths["index.cache"], "home og:url is missing");
    if (!privacy.includes('rel="canonical" href="https://puzzgrind.com/privacy"') && !privacy.includes('href="https://puzzgrind.com/privacy" rel="canonical"')) fail(paths["privacy.cache"], "privacy canonical is missing");
    if (home.includes("noindex") || privacy.includes("noindex")) fail(paths["index.cache"], "Production page contains noindex");
    for (const rule of ["Allow: /", "Disallow: /api/", "Disallow: /sudoku/share/", "Sitemap: https://puzzgrind.com/sitemap.xml"]) if (!robots.includes(rule)) fail(paths["robots.txt.cache"], `missing ${rule}`);
    if (/^Disallow: \/$/m.test(robots)) fail(paths["robots.txt.cache"], "Production robots blocks the entire site");
  } else {
    if (home.includes('rel="canonical"') || privacy.includes('rel="canonical"')) fail(paths["index.cache"], `${environment} contains canonical`);
    if (home.includes('property="og:url"') || privacy.includes('property="og:url"')) fail(paths["index.cache"], `${environment} contains og:url`);
    if (!home.includes("noindex") || !privacy.includes("noindex")) fail(paths["index.cache"], `${environment} is missing noindex`);
    if (!/^Disallow: \/$/m.test(robots)) fail(paths["robots.txt.cache"], `${environment} robots is not site-wide disallow`);
  }
  if (!existsSync(join(root, ".open-next", "worker.js"))) fail(join(root, ".open-next", "worker.js"), "missing Worker bundle");
  return marker;
}
