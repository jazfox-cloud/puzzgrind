export const LEXI_WORD_LENGTH = 5;
export const LEXI_MAX_ATTEMPTS = 6;
export const LEXI_HINT_MIN_GUESSES = 2;
export const LEXI_MAX_HINTS = 1;

export type LexiGameStatus = "in_progress" | "lost" | "won";
export type LexiLetterStatus = "absent" | "correct" | "present";

export type LexiGuessResult = {
  evaluation: LexiLetterStatus[];
  guess: string;
};
