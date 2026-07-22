import { describe, expect, it } from "vitest";

import { submitLexiGuess } from "@/lib/lexi";
import type { LexiGameState } from "@/lib/lexi";

const allowed = new Set(["crane", "slate", "level", "lemon", "cider", "proud", "flame"]);
const initial: LexiGameState = { guesses: [], status: "in_progress" };

describe("Lexi game transitions", () => {
  it("rejects duplicate accepted guesses without changing state or consuming an attempt", () => {
    const first = submitLexiGuess({ answer: "level", rawGuess: "CRANE", state: initial, isAllowedGuess: (word) => allowed.has(word) });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const duplicate = submitLexiGuess({ answer: "level", rawGuess: " crane ", state: first.state, isAllowedGuess: (word) => allowed.has(word) });
    expect(duplicate).toEqual({ ok: false, error: "duplicate_guess", state: first.state });
    expect(duplicate.state.guesses).toHaveLength(1);
  });

  it("does not consume invalid guesses and marks wins", () => {
    expect(submitLexiGuess({ answer: "level", rawGuess: "nope", state: initial, isAllowedGuess: () => true }))
      .toEqual({ ok: false, error: "invalid_word", state: initial });
    const won = submitLexiGuess({ answer: "level", rawGuess: "LEVEL", state: initial, isAllowedGuess: (word) => allowed.has(word) });
    expect(won.ok && won.state.status).toBe("won");
  });

  it("marks a loss after six distinct valid guesses", () => {
    let state = initial;
    for (const guess of ["crane", "slate", "lemon", "cider", "proud", "flame"]) {
      const result = submitLexiGuess({ answer: "level", rawGuess: guess, state, isAllowedGuess: (word) => allowed.has(word) });
      expect(result.ok).toBe(true);
      if (result.ok) state = result.state;
    }
    expect(state.status).toBe("lost");
  });
});
