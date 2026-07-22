import { describe, expect, it } from "vitest";

import { isValidLexiWord, normalizeLexiInput, normalizeValidLexiWord } from "@/lib/lexi";

describe("Lexi word normalization", () => {
  it("normalizes case and surrounding whitespace", () => {
    expect(normalizeLexiInput("  Crane  ")).toBe("crane");
    expect(normalizeValidLexiWord("LEVEL")).toBe("level");
  });

  it("accepts only five lowercase ASCII letters after normalization", () => {
    expect(isValidLexiWord("crane")).toBe(true);
    for (const value of ["four", "longer", "a-bcd", "ab cd", "caféx", "abc1d", "Äbcde"]) {
      expect(normalizeValidLexiWord(value)).toBeNull();
    }
  });
});
