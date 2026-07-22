import type { LexiGuessResult, LexiLetterStatus } from "./constants";
import { normalizeValidLexiWord } from "./word";

const statusPriority: Record<LexiLetterStatus, number> = {
  absent: 1,
  present: 2,
  correct: 3,
};

export function evaluateLexiGuess(answerInput: string, guessInput: string): LexiLetterStatus[] {
  const answer = normalizeValidLexiWord(answerInput);
  const guess = normalizeValidLexiWord(guessInput);
  if (!answer || !guess) throw new Error("Lexi answers and guesses must be five lowercase ASCII letters.");

  const evaluation: LexiLetterStatus[] = Array.from({ length: answer.length }, () => "absent");
  const remaining = new Map<string, number>();

  for (let index = 0; index < answer.length; index += 1) {
    if (answer[index] === guess[index]) {
      evaluation[index] = "correct";
    } else {
      remaining.set(answer[index], (remaining.get(answer[index]) ?? 0) + 1);
    }
  }

  for (let index = 0; index < guess.length; index += 1) {
    if (evaluation[index] === "correct") continue;
    const available = remaining.get(guess[index]) ?? 0;
    if (available > 0) {
      evaluation[index] = "present";
      remaining.set(guess[index], available - 1);
    }
  }

  return evaluation;
}

export function aggregateKeyboardStates(rows: readonly LexiGuessResult[]): Record<string, LexiLetterStatus> {
  const states: Record<string, LexiLetterStatus> = {};
  for (const row of rows) {
    row.guess.split("").forEach((letter, index) => {
      const next = row.evaluation[index];
      const current = states[letter];
      if (!current || statusPriority[next] > statusPriority[current]) states[letter] = next;
    });
  }
  return states;
}
