import { describe, expect, it } from "vitest";

import { evaluateLexiGuess, selectLexiHintLetter } from "@/lib/lexi";

describe("Lexi hints", () => {
  const guesses = [
    { guess: "crane", evaluation: evaluateLexiGuess("level", "crane") },
    { guess: "spoil", evaluation: evaluateLexiGuess("level", "spoil") },
  ];

  it("requires two accepted guesses and allows at most one hint", () => {
    expect(selectLexiHintLetter({ answer: "level", guesses: guesses.slice(0, 1), hintsUsed: 0, status: "in_progress" }))
      .toEqual({ ok: false, error: "not_enough_guesses" });
    expect(selectLexiHintLetter({ answer: "level", guesses, hintsUsed: 0, status: "in_progress" }))
      .toEqual({ ok: true, letter: "v" });
    expect(selectLexiHintLetter({ answer: "level", guesses, hintsUsed: 1, status: "in_progress" }))
      .toEqual({ ok: false, error: "already_used" });
  });

  it("returns no_hint_available when every answer letter is already discovered", () => {
    const discovered = [
      { guess: "lever", evaluation: evaluateLexiGuess("level", "lever") },
      { guess: "vowel", evaluation: evaluateLexiGuess("level", "vowel") },
    ];
    expect(selectLexiHintLetter({ answer: "level", guesses: discovered, hintsUsed: 0, status: "in_progress" }))
      .toEqual({ ok: false, error: "no_hint_available" });
  });
});
