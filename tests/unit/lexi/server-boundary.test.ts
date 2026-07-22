// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { VALID_LEXI_GUESS_COUNT, validLexiGuesses } from "@/lib/lexi/server/lexicon";

function filesBelow(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const full = resolve(path, entry.name);
    return entry.isDirectory() ? filesBelow(full) : [full];
  });
}

describe("Lexi server-only word list", () => {
  it("loads the pinned list once as a server Set", () => {
    expect(VALID_LEXI_GUESS_COUNT).toBe(5_097);
    expect(validLexiGuesses).toBeInstanceOf(Set);
    expect(validLexiGuesses.has("aback")).toBe(true);
  });

  it("is not imported by Client Components or copied to public assets", () => {
    const root = process.cwd();
    const sourceFiles = filesBelow(resolve(root, "app")).concat(filesBelow(resolve(root, "components")));
    for (const file of sourceFiles.filter((name) => /\.(?:ts|tsx|js|jsx)$/u.test(name))) {
      const source = readFileSync(file, "utf8");
      if (/^["']use client["']/u.test(source.trimStart())) {
        expect(source, file).not.toMatch(/lib\/lexi\/server|valid-guesses/u);
      }
    }
    for (const file of filesBelow(resolve(root, "public"))) {
      if (!/\.(?:json|js|txt|html|map)$/u.test(file)) continue;
      expect(readFileSync(file, "utf8"), file).not.toContain("aback\nabaft\nabase");
    }
  });
});
