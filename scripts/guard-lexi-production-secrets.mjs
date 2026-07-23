import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const root = process.cwd();
const privatePath = ".private/lexi-production/guard-probe.json";
const runtimeRoots = ["app", "components", "lib"];
const deployFiles = ["next.config.ts", "open-next.config.ts", "scripts/build-cloudflare-artifact.mjs",
  "scripts/build-cloudflare-ci.mjs", "scripts/deploy-cloudflare-production.mjs"];
const forbiddenTrackedName = /(?:^|\/)\.private\/lexi-production\/|(?:approved|ordered)[-_.]answers.*\.(?:json|txt|csv|sql)$|date[-_.]answer.*\.(?:json|txt|csv|sql)$|production[-_.](?:schedule|seed)(?!.*audit).*\.(?:json|txt|csv|sql)$/iu;

function fail(message) {
  throw new Error(`Production answer secrecy guard failed: ${message}`);
}

function filesUnder(path) {
  if (!existsSync(path)) return [];
  const result = [];
  for (const name of readdirSync(path)) {
    const child = join(path, name);
    if (statSync(child).isDirectory()) result.push(...filesUnder(child));
    else result.push(child);
  }
  return result;
}

try {
  execFileSync("git", ["check-ignore", "-q", privatePath], { cwd: root });
} catch {
  fail(".private/lexi-production/ is not ignored by Git");
}

const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" })
  .split("\0").filter(Boolean);
const forbiddenTracked = tracked.filter((path) => forbiddenTrackedName.test(path));
if (forbiddenTracked.length > 0) fail(`forbidden Production answer artifact is tracked: ${forbiddenTracked.join(", ")}`);

for (const path of [...runtimeRoots.flatMap((entry) => filesUnder(resolve(root, entry))),
  ...deployFiles.map((entry) => resolve(root, entry)).filter(existsSync)]) {
  const content = readFileSync(path, "utf8");
  if (content.includes(".private/lexi-production")) {
    fail(`runtime/build code reads the private answer directory: ${relative(root, path)}`);
  }
}

const outputRoots = [
  { root: "public", extensions: new Set([".map", ".js", ".json", ".html", ".txt", ".xml"]) },
  { root: ".next/server/app", extensions: new Set([".html", ".rsc"]) },
  { root: ".open-next/assets", extensions: new Set([".map", ".js", ".json", ".html", ".txt", ".xml"]) },
];
for (const { root: outputRoot, extensions } of outputRoots) {
  for (const path of filesUnder(resolve(root, outputRoot))) {
    if (extensions.has(extname(path))) {
      const content = readFileSync(path, "utf8");
      if (content.includes(".private/lexi-production") ||
        content.includes("lexi-production-schedule-v1") ||
        content.includes("\"aback\",\"abaft\",\"abase\",\"abash\",\"abate\"") ||
        content.includes("adore\nalert\nalive\nalone\namber")) {
        fail(`private schedule or wordlist marker reached public/client output: ${relative(root, path)}`);
      }
    }
  }
}

console.log(JSON.stringify({
  privateDirectoryIgnored: true,
  forbiddenTrackedArtifacts: 0,
  runtimeReadsPrivateDirectory: false,
  publicOrClientScheduleOrWordlistMarkers: 0,
}, null, 2));
