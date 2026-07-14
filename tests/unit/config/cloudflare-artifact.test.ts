import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { finalizeArtifact, MARKER_PATH, validateArtifact } from "../../../scripts/lib/cloudflare-artifact.mjs";

const SHA = "14a8b0127ab54a4c8a689e0dab17627c14ca2d45";
function fixture(environment: "production" | "preview" | "staging") {
  const root = mkdtempSync(join(tmpdir(), "puzzgrind-artifact-"));
  const id = "build-id";
  mkdirSync(join(root, ".next"), { recursive: true });
  mkdirSync(join(root, ".open-next", "cache", id), { recursive: true });
  writeFileSync(join(root, ".next", "BUILD_ID"), id);
  writeFileSync(join(root, ".open-next", "worker.js"), "worker");
  const production = environment === "production";
  const home = production ? '<link href="https://puzzgrind.com/" rel="canonical"/><meta content="https://puzzgrind.com/" property="og:url"/>' : '<meta name="robots" content="noindex,nofollow"/>';
  const privacy = production ? '<link rel="canonical" href="https://puzzgrind.com/privacy"/>' : '<meta name="robots" content="noindex,nofollow"/>';
  const robots = production ? "User-Agent: *\nAllow: /\nDisallow: /api/\nDisallow: /sudoku/share/\nSitemap: https://puzzgrind.com/sitemap.xml\n" : "User-Agent: *\nDisallow: /\n";
  for (const [name, value] of [["index.cache", { html: home }], ["privacy.cache", { html: privacy }], ["robots.txt.cache", { body: robots }]] as const) writeFileSync(join(root, ".open-next", "cache", id, name), JSON.stringify(value));
  finalizeArtifact({ environment, gitSha: SHA, root });
  return root;
}

describe("Cloudflare artifact provenance guard", () => {
  it.each(["production", "preview", "staging"] as const)("accepts a valid %s artifact", (environment) => {
    expect(validateArtifact({ environment, expectedGitSha: SHA, root: fixture(environment) }).environment).toBe(environment);
  });
  it.each(["preview", "staging"] as const)("rejects a %s artifact as Production", (environment) => {
    expect(() => validateArtifact({ environment: "production", expectedGitSha: SHA, root: fixture(environment) })).toThrow(/expected production/);
  });
  it("rejects marker environment and Git SHA mismatches", () => {
    const root = fixture("production");
    const markerPath = join(root, ".open-next", "assets", MARKER_PATH);
    const marker = JSON.parse(readFileSync(markerPath, "utf8"));
    writeFileSync(markerPath, JSON.stringify({ ...marker, environment: "preview" }));
    expect(() => validateArtifact({ environment: "production", expectedGitSha: SHA, root })).toThrow(/expected production/);
    writeFileSync(markerPath, JSON.stringify(marker));
    expect(() => validateArtifact({ environment: "production", expectedGitSha: "0".repeat(40), root })).toThrow(/Git SHA/);
  });
  it("rejects stale uploaded cache even if the marker is present", () => {
    const root = fixture("production");
    const marker = JSON.parse(readFileSync(join(root, ".open-next", "assets", MARKER_PATH), "utf8"));
    const [relative] = Object.keys(marker.files);
    const path = join(root, ".open-next", "assets", relative);
    writeFileSync(path, JSON.stringify({ html: '<meta name="robots" content="noindex"/>' }));
    expect(createHash("sha256").update(readFileSync(path)).digest("hex")).not.toBe(marker.files[relative]);
    expect(() => validateArtifact({ environment: "production", expectedGitSha: SHA, root })).toThrow(/digest/);
  });
});
