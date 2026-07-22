import { describe, expect, it } from "vitest";

import { aggregateKeyboardStates, evaluateLexiGuess } from "@/lib/lexi";

describe("Lexi evaluation", () => {
  it("uses two passes so duplicate letters never overclaim matches", () => {
    expect(evaluateLexiGuess("level", "eerie")).toEqual([
      "present", "correct", "absent", "absent", "absent",
    ]);
    expect(evaluateLexiGuess("apple", "allee")).toEqual([
      "correct", "present", "absent", "absent", "correct",
    ]);
  });

  it("aggregates keyboard states with correct above present above absent", () => {
    expect(aggregateKeyboardStates([
      { guess: "eerie", evaluation: evaluateLexiGuess("level", "eerie") },
      { guess: "lemon", evaluation: evaluateLexiGuess("level", "lemon") },
    ])).toMatchObject({ e: "correct", l: "correct", r: "absent" });
  });
});
