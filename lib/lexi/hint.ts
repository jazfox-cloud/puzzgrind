import { LEXI_HINT_MIN_GUESSES, LEXI_MAX_HINTS } from "./constants";
import type { LexiGameStatus, LexiGuessResult } from "./constants";
import { normalizeValidLexiWord } from "./word";

export type LexiHintResult =
  | { letter: string; ok: true }
  | { error: "already_used" | "game_over" | "no_hint_available" | "not_enough_guesses"; ok: false };

export function discoveredAnswerLetters(rows: readonly LexiGuessResult[]): Set<string> {
  const discovered = new Set<string>();
  for (const row of rows) {
    row.evaluation.forEach((status, index) => {
      if (status === "correct" || status === "present") discovered.add(row.guess[index]);
    });
  }
  return discovered;
}

export function selectLexiHintLetter(input: {
  answer: string;
  guesses: readonly LexiGuessResult[];
  hintsUsed: number;
  status: LexiGameStatus;
}): LexiHintResult {
  if (input.status !== "in_progress") return { ok: false, error: "game_over" };
  if (input.hintsUsed >= LEXI_MAX_HINTS) return { ok: false, error: "already_used" };
  if (input.guesses.length < LEXI_HINT_MIN_GUESSES) return { ok: false, error: "not_enough_guesses" };
  const answer = normalizeValidLexiWord(input.answer);
  if (!answer) throw new Error("A Lexi answer must be five lowercase ASCII letters.");

  const discovered = discoveredAnswerLetters(input.guesses);
  const candidates = [...new Set(answer)].filter((letter) => !discovered.has(letter)).sort();
  return candidates[0]
    ? { ok: true, letter: candidates[0] }
    : { ok: false, error: "no_hint_available" };
}
