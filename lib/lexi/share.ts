import { formatClockTime } from "@/lib/format/time";
import type { LexiGameStatus, LexiGuessResult, LexiLetterStatus } from "./constants";

const shareSymbol: Record<LexiLetterStatus, string> = {
  correct: "🟦",
  present: "🟧",
  absent: "⬜",
};

export function buildLexiShareText(input: {
  durationSeconds: number;
  guesses: readonly Pick<LexiGuessResult, "evaluation">[];
  hintsUsed: number;
  puzzleDate: string;
  status: Extract<LexiGameStatus, "lost" | "won">;
}): string {
  const outcome = input.status === "won"
    ? `Solved: ${input.guesses.length} of 6`
    : "Not solved: X/6";
  const rows = input.guesses.map((row) => row.evaluation.map((status) => shareSymbol[status]).join(""));
  return [
    `PuzzGrind / Lexi Daily / ${input.puzzleDate}`,
    `${outcome} · Hint: ${input.hintsUsed} · Time: ${formatClockTime(input.durationSeconds)}`,
    "",
    ...rows,
    "",
    "https://puzzgrind.com/games/lexi-daily",
  ].join("\n");
}
