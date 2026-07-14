import { describe, expect, it } from "vitest";

import { resolveBuildAppEnvironment } from "@/lib/build-environment";

describe("build-time environment contract", () => {
  it.each(["local", "test", "preview", "staging", "production"] as const)(
    "accepts the explicit %s environment",
    (environment) => {
      expect(resolveBuildAppEnvironment({ BUILD_APP_ENV: environment })).toBe(environment);
    },
  );

  it("rejects an invalid explicit environment instead of guessing", () => {
    expect(() => resolveBuildAppEnvironment({ BUILD_APP_ENV: "prod" })).toThrow(
      "Invalid BUILD_APP_ENV: prod",
    );
  });

  it("maps the Cloudflare production branch to production", () => {
    expect(resolveBuildAppEnvironment({ WORKERS_CI: "1", WORKERS_CI_BRANCH: "main" })).toBe(
      "production",
    );
  });

  it("maps every non-production Cloudflare branch to preview", () => {
    expect(
      resolveBuildAppEnvironment({
        WORKERS_CI: "1",
        WORKERS_CI_BRANCH: "perf/build-time-environment-static",
      }),
    ).toBe("preview");
  });

  it("fails a Cloudflare build without branch provenance", () => {
    expect(() => resolveBuildAppEnvironment({ WORKERS_CI: "1" })).toThrow(
      "WORKERS_CI_BRANCH is required",
    );
  });

  it("uses test under the test runner and otherwise fails safe to local", () => {
    expect(resolveBuildAppEnvironment({ NODE_ENV: "test" })).toBe("test");
    expect(resolveBuildAppEnvironment({})).toBe("local");
  });
});
