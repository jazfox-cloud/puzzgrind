import { resolveGitSha, validateArtifact } from "./lib/cloudflare-artifact.mjs";

const environment = process.argv[2];
if (!environment) throw new Error("Usage: validate-cloudflare-artifact.mjs <preview|staging|production> [gitSha]");
const marker = validateArtifact({ environment, expectedGitSha: process.argv[3] ?? resolveGitSha() });
console.log(`Artifact guard passed: ${marker.environment} / ${marker.gitSha} / ${marker.buildId}`);
