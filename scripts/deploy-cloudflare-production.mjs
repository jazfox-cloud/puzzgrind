import { spawnSync } from "node:child_process";

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(process.execPath, ["scripts/validate-cloudflare-deploy.mjs", "production"]);
run(process.execPath, ["scripts/build-cloudflare-artifact.mjs", "production"]);
run(process.execPath, ["scripts/validate-cloudflare-artifact.mjs", "production"]);
const bin = process.platform === "win32" ? "node_modules/.bin/opennextjs-cloudflare.cmd" : "node_modules/.bin/opennextjs-cloudflare";
run(bin, ["deploy", "--env", "production"]);
run(process.execPath, ["scripts/smoke-production.mjs"]);
