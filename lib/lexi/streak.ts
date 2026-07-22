export type LexiLocalStats = {
  bestStreak: number;
  currentStreak: number;
  lastCompletedDate: string | null;
  lastCompletedPuzzleId: string | null;
  puzzlesCompleted: number;
};

export const EMPTY_LEXI_STATS: LexiLocalStats = {
  bestStreak: 0,
  currentStreak: 0,
  lastCompletedDate: null,
  lastCompletedPuzzleId: null,
  puzzlesCompleted: 0,
};

function utcDay(date: string): number {
  return Math.floor(new Date(`${date}T00:00:00.000Z`).getTime() / 86_400_000);
}

export function recordLexiCompletion(
  current: LexiLocalStats,
  input: { puzzleDate: string; puzzleId: string },
): { counted: boolean; stats: LexiLocalStats } {
  if (current.lastCompletedPuzzleId === input.puzzleId) return { counted: false, stats: current };
  const consecutive = current.lastCompletedDate !== null &&
    utcDay(input.puzzleDate) - utcDay(current.lastCompletedDate) === 1;
  const currentStreak = consecutive ? current.currentStreak + 1 : 1;
  return {
    counted: true,
    stats: {
      bestStreak: Math.max(current.bestStreak, currentStreak),
      currentStreak,
      lastCompletedDate: input.puzzleDate,
      lastCompletedPuzzleId: input.puzzleId,
      puzzlesCompleted: current.puzzlesCompleted + 1,
    },
  };
}
