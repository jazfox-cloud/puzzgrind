import { spawnSync } from "node:child_process";
import { cleanArtifacts } from "./lib/cloudflare-artifact.mjs";

if (process.env.WORKERS_CI !== "1" || !process.env.WORKERS_CI_BRANCH) throw new Error("WORKERS_CI=1 and WORKERS_CI_BRANCH are required");
if (process.env.WORKERS_CI_BRANCH === "main") {
  const guard = spawnSync(process.execPath, ["scripts/validate-cloudflare-deploy.mjs", "production"], { stdio: "inherit" });
  if (guard.status !== 0) process.exit(guard.status ?? 1);
  cleanArtifacts();
  console.log("Production OpenNext build deferred to pnpm deploy (single-artifact strategy A).");
} else {
  const build = spawnSync(process.execPath, ["scripts/build-cloudflare-artifact.mjs", "preview"], { stdio: "inherit" });
  if (build.status !== 0) process.exit(build.status ?? 1);
}
