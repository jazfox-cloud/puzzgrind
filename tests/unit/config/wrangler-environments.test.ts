import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

type RateLimitConfig = { name: string; namespace_id: string };
type EnvironmentConfig = {
  vars: { APP_ENV: string };
  ratelimits: RateLimitConfig[];
  d1_databases: Array<{ database_id: string }>;
};

const config = JSON.parse(readFileSync("wrangler.jsonc", "utf8")) as EnvironmentConfig & {
  env: { production: EnvironmentConfig; staging: EnvironmentConfig };
};
const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts: Record<string, string>;
};

describe("Wrangler environment isolation", () => {
  it("makes the unqualified Git Preview configuration preview-safe", () => {
    expect(config.vars.APP_ENV).toBe("preview");
    expect(config.ratelimits.map((binding) => binding.namespace_id)).toEqual([
      "3101", "3102", "3103", "3104", "3105", "3106",
    ]);
    expect(config.d1_databases[0]?.database_id).toBe(config.env.staging.d1_databases[0]?.database_id);
    expect(config.d1_databases[0]?.database_id).not.toBe(config.env.production.d1_databases[0]?.database_id);
  });

  it("keeps preview, staging, and production rate-limit namespaces distinct", () => {
    const namespaces = [config.ratelimits, config.env.staging.ratelimits, config.env.production.ratelimits]
      .map((bindings) => new Set(bindings.map((binding) => binding.namespace_id)));
    expect(namespaces.every((set) => set.size === 6)).toBe(true);
    expect([...namespaces[0]].some((id) => namespaces[1].has(id) || namespaces[2].has(id))).toBe(false);
    expect([...namespaces[1]].some((id) => namespaces[2].has(id))).toBe(false);
  });

  it("labels all deployed targets explicitly", () => {
    expect(config.vars.APP_ENV).toBe("preview");
    expect(config.env.staging.vars.APP_ENV).toBe("staging");
    expect(config.env.production.vars.APP_ENV).toBe("production");
  });

  it("requires the guarded, explicit Production environment in the deploy script", () => {
    const deploy = packageJson.scripts.deploy;
    expect(deploy).toContain("validate-cloudflare-deploy.mjs production");
    expect(deploy).toContain("deploy --env production");
    expect(deploy).not.toContain("versions upload");
  });

  it("passes the Production guard only with an explicit Production target", () => {
    expect(execFileSync(process.execPath, ["scripts/validate-cloudflare-deploy.mjs", "production"], {
      encoding: "utf8",
    })).toContain("Production deploy guard passed");
    expect(() => execFileSync(process.execPath, ["scripts/validate-cloudflare-deploy.mjs"], {
      stdio: "pipe",
    })).toThrow();
    expect(() => execFileSync(process.execPath, ["scripts/validate-cloudflare-deploy.mjs", "preview"], {
      stdio: "pipe",
    })).toThrow();
  });
});
