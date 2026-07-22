import { LEXI_MAX_ATTEMPTS } from "./constants";
import type { LexiGameStatus, LexiGuessResult } from "./constants";
import { evaluateLexiGuess } from "./evaluation";
import { normalizeValidLexiWord } from "./word";

export type LexiGameState = {
  guesses: LexiGuessResult[];
  status: LexiGameStatus;
};

export type LexiGuessTransition =
  | { error: "duplicate_guess" | "game_over" | "invalid_word"; ok: false; state: LexiGameState }
  | { ok: true; state: LexiGameState };

export function hasDuplicateGuess(guesses: readonly LexiGuessResult[], guess: string): boolean {
  return guesses.some((row) => row.guess === guess);
}

export function determineLexiStatus(
  guesses: readonly LexiGuessResult[],
  answer: string,
  maxAttempts = LEXI_MAX_ATTEMPTS,
): LexiGameStatus {
  if (guesses.at(-1)?.guess === answer) return "won";
  return guesses.length >= maxAttempts ? "lost" : "in_progress";
}

export function submitLexiGuess(input: {
  answer: string;
  isAllowedGuess: (guess: string) => boolean;
  rawGuess: string;
  state: LexiGameState;
}): LexiGuessTransition {
  if (input.state.status !== "in_progress") return { ok: false, error: "game_over", state: input.state };
  const guess = normalizeValidLexiWord(input.rawGuess);
  if (!guess || !input.isAllowedGuess(guess)) return { ok: false, error: "invalid_word", state: input.state };
  if (hasDuplicateGuess(input.state.guesses, guess)) {
    return { ok: false, error: "duplicate_guess", state: input.state };
  }

  const guesses = [...input.state.guesses, { guess, evaluation: evaluateLexiGuess(input.answer, guess) }];
  return {
    ok: true,
    state: { guesses, status: determineLexiStatus(guesses, input.answer) },
  };
}
