import { spawnSync } from "node:child_process";
import { ARTIFACT_ENVIRONMENTS, cleanArtifacts, finalizeArtifact, resolveGitSha, validateArtifact } from "./lib/cloudflare-artifact.mjs";

const environment = process.argv[2];
if (!ARTIFACT_ENVIRONMENTS.includes(environment)) throw new Error("Usage: build-cloudflare-artifact.mjs <preview|staging|production>");
const gitSha = resolveGitSha();
cleanArtifacts();
const bin = process.platform === "win32" ? "node_modules/.bin/opennextjs-cloudflare.cmd" : "node_modules/.bin/opennextjs-cloudflare";
const result = spawnSync(bin, ["build"], { env: { ...process.env, BUILD_APP_ENV: environment }, stdio: "inherit" });
if (result.status !== 0) process.exit(result.status ?? 1);
finalizeArtifact({ environment, gitSha });
const marker = validateArtifact({ environment, expectedGitSha: gitSha });
console.log(`Cloudflare artifact ready: ${marker.environment} / ${marker.gitSha} / ${marker.buildId}`);
