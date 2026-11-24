// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("node:timers/promises", () => ({ setTimeout: async () => {} }));

const origin = "https://puzzgrind.com";
const nextCheck = new Error("Reached the next production smoke check");

async function runSmoke(directory: (sample: number) => string, directoryCanonical = origin + "/guides") {
  let guideRequests = 0;
  vi.resetModules();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.stubGlobal("fetch", async (input: URL) => {
    const url = new URL(input);
    if (url.protocol === "http:") {
      return new Response(null, {
        status: 301,
        headers: { location: origin + url.pathname + url.search },
      });
    }
    if (url.pathname === "/guides/6x6-sudoku-single-candidate") throw nextCheck;
    const canonical = url.pathname === "/guides" ? directoryCanonical : origin + url.pathname;
    const main = url.pathname === "/guides" ? directory(++guideRequests) : "Puzzle game";
    return new Response(
      `<title>PuzzGrind</title><meta name="description" content="Puzzle games"><link rel="canonical" href="${canonical}"><meta property="og:url" content="${canonical}"><main>${main}</main>`,
      { headers: { "cache-control": "private, no-store" } },
    );
  });
  const script = "../../../scripts/smoke-production.mjs";
  await import(script);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("production guides smoke", () => {
  it("continues when the directory responses agree on a fresh comparison", async () => {
    await expect(runSmoke((sample) => sample === 1 ? "Previous guides" : "Updated guides"))
      .rejects.toBe(nextCheck);
  });

  it("fails when the directory responses keep disagreeing", async () => {
    const directory = vi.fn((sample: number) => sample % 2 ? "Previous guides" : "Updated guides");
    await expect(runSmoke(directory)).rejects.toThrow("page semantics differ: mainText");
    expect(directory).toHaveBeenCalledTimes(6);
  });

  it("fails immediately when the directory canonical is wrong", async () => {
    const directory = vi.fn(() => "Updated guides");
    await expect(runSmoke(directory, origin)).rejects.toThrow("has canonical");
    expect(directory).toHaveBeenCalledTimes(2);
  });
});
