import type { LexiGameStatus, LexiGuessResult } from "./constants";
import { EMPTY_LEXI_STATS } from "./streak";
import type { LexiLocalStats } from "./streak";

export const LEXI_SAVE_VERSION = 1;
export const LEXI_SAVE_KEY = "puzzgrind_lexi_daily_v1";

export type SavedLexiGame = {
  displayName: string;
  guesses: LexiGuessResult[];
  hintCount: 0 | 1;
  hintLetter: string | null;
  puzzleDate: string;
  puzzleId: string;
  revision: number;
  stats: LexiLocalStats;
  status: LexiGameStatus | "started" | "expired";
  token: string;
  version: typeof LEXI_SAVE_VERSION;
};

type StorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">;
const letterStatuses = new Set(["correct", "present", "absent"]);

function validStats(value: unknown): value is LexiLocalStats {
  if (!value || typeof value !== "object") return false;
  const stats = value as Partial<LexiLocalStats>;
  return [stats.bestStreak, stats.currentStreak, stats.puzzlesCompleted].every((number) => Number.isInteger(number) && (number ?? -1) >= 0) &&
    (stats.lastCompletedDate === null || typeof stats.lastCompletedDate === "string") &&
    (stats.lastCompletedPuzzleId === null || typeof stats.lastCompletedPuzzleId === "string");
}

export function parseSavedLexiGame(raw: string, puzzleId: string): SavedLexiGame | null {
  try {
    const value = JSON.parse(raw) as Partial<SavedLexiGame>;
    const guessesValid = Array.isArray(value.guesses) && value.guesses.length <= 6 && value.guesses.every((row) =>
      row && /^[a-z]{5}$/u.test(row.guess) && Array.isArray(row.evaluation) && row.evaluation.length === 5 &&
      row.evaluation.every((status) => letterStatuses.has(status)));
    if (value.version !== LEXI_SAVE_VERSION || value.puzzleId !== puzzleId || typeof value.puzzleDate !== "string" ||
      typeof value.token !== "string" || !value.token || !Number.isInteger(value.revision) || (value.revision ?? -1) < 0 ||
      !guessesValid || (value.hintCount !== 0 && value.hintCount !== 1) ||
      !(value.hintLetter === null || /^[a-z]$/u.test(value.hintLetter ?? "")) ||
      !["started", "in_progress", "won", "lost", "expired"].includes(value.status ?? "") ||
      typeof value.displayName !== "string" || !validStats(value.stats)) return null;
    return value as SavedLexiGame;
  } catch { return null; }
}

export function loadSavedLexiGame(storage: StorageLike, puzzleId: string): SavedLexiGame | null {
  try {
    const raw = storage.getItem(LEXI_SAVE_KEY);
    if (!raw) return null;
    const parsed = parseSavedLexiGame(raw, puzzleId);
    if (!parsed) storage.removeItem(LEXI_SAVE_KEY);
    return parsed;
  } catch { return null; }
}

export function saveLexiGame(storage: StorageLike, game: SavedLexiGame): void {
  try { storage.setItem(LEXI_SAVE_KEY, JSON.stringify(game)); } catch { /* Memory state remains playable. */ }
}

export function emptyLexiStats(): LexiLocalStats {
  return { ...EMPTY_LEXI_STATS };
}
