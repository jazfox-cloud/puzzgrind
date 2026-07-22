import { formatClockTime } from "@/lib/format/time";
import { copyText, shareText } from "@/lib/share/web-share";
import type { ShareCapability, ShareOutcome } from "@/lib/share/web-share";

export { secondsUntilNextUtcMidnight } from "@/lib/daily/utc";
export type { ShareOutcome } from "@/lib/share/web-share";

export const ENGAGEMENT_STORAGE_KEY = "puzzgrind_sudoku_engagement_v1";

export type CompletionFeedback = "just_right" | "too_easy" | "too_hard";

export type LocalSudokuStats = {
  bestStreak: number;
  completionTime: number;
  currentStreak: number;
  feedbackByPuzzleId: Record<string, CompletionFeedback>;
  hintsUsed: number;
  lastCompletedDate: string | null;
  lastCompletedPuzzleId: string | null;
  puzzlesCompleted: number;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

type CompletionInput = {
  completionTime: number;
  hintsUsed: number;
  puzzleDate: string;
  puzzleId: string;
};

export const EMPTY_SUDOKU_STATS: LocalSudokuStats = {
  puzzlesCompleted: 0,
  currentStreak: 0,
  bestStreak: 0,
  lastCompletedPuzzleId: null,
  lastCompletedDate: null,
  completionTime: 0,
  hintsUsed: 0,
  feedbackByPuzzleId: {},
};

function isUtcDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(value) &&
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

function nonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function validFeedback(value: unknown): value is CompletionFeedback {
  return value === "too_easy" || value === "just_right" || value === "too_hard";
}

export function parseLocalSudokuStats(raw: string | null): LocalSudokuStats {
  if (!raw) return { ...EMPTY_SUDOKU_STATS, feedbackByPuzzleId: {} };
  try {
    const value = JSON.parse(raw) as Partial<LocalSudokuStats>;
    if (
      !nonNegativeInteger(value.puzzlesCompleted) || !nonNegativeInteger(value.currentStreak) ||
      !nonNegativeInteger(value.bestStreak) || !nonNegativeInteger(value.completionTime) ||
      !nonNegativeInteger(value.hintsUsed) ||
      !(value.lastCompletedPuzzleId === null || typeof value.lastCompletedPuzzleId === "string") ||
      !(value.lastCompletedDate === null || isUtcDate(value.lastCompletedDate)) ||
      !value.feedbackByPuzzleId || typeof value.feedbackByPuzzleId !== "object" ||
      !Object.values(value.feedbackByPuzzleId).every(validFeedback)
    ) return { ...EMPTY_SUDOKU_STATS, feedbackByPuzzleId: {} };
    return value as LocalSudokuStats;
  } catch {
    return { ...EMPTY_SUDOKU_STATS, feedbackByPuzzleId: {} };
  }
}

export function loadLocalSudokuStats(storage: StorageLike): LocalSudokuStats {
  try {
    return parseLocalSudokuStats(storage.getItem(ENGAGEMENT_STORAGE_KEY));
  } catch {
    return { ...EMPTY_SUDOKU_STATS, feedbackByPuzzleId: {} };
  }
}

function persistStats(storage: StorageLike, stats: LocalSudokuStats): boolean {
  try {
    storage.setItem(ENGAGEMENT_STORAGE_KEY, JSON.stringify(stats));
    return true;
  } catch {
    return false;
  }
}

function utcDay(date: string): number {
  return Math.floor(new Date(`${date}T00:00:00.000Z`).getTime() / 86_400_000);
}

export function recordLocalCompletion(storage: StorageLike, input: CompletionInput) {
  const current = loadLocalSudokuStats(storage);
  if (current.lastCompletedPuzzleId === input.puzzleId) return { counted: false, persisted: true, stats: current };

  const consecutive = current.lastCompletedDate !== null && utcDay(input.puzzleDate) - utcDay(current.lastCompletedDate) === 1;
  const currentStreak = consecutive ? current.currentStreak + 1 : 1;
  const stats: LocalSudokuStats = {
    ...current,
    puzzlesCompleted: current.puzzlesCompleted + 1,
    currentStreak,
    bestStreak: Math.max(current.bestStreak, currentStreak),
    lastCompletedPuzzleId: input.puzzleId,
    lastCompletedDate: input.puzzleDate,
    completionTime: input.completionTime,
    hintsUsed: input.hintsUsed,
  };
  return { counted: true, persisted: persistStats(storage, stats), stats };
}

export function recordCompletionFeedback(storage: StorageLike, puzzleId: string, feedback: CompletionFeedback) {
  const current = loadLocalSudokuStats(storage);
  const firstSelection = current.feedbackByPuzzleId[puzzleId] === undefined;
  const stats: LocalSudokuStats = {
    ...current,
    feedbackByPuzzleId: { ...current.feedbackByPuzzleId, [puzzleId]: feedback },
  };
  return { firstSelection, persisted: persistStats(storage, stats), stats };
}

export function formatResultTime(seconds: number): string {
  return formatClockTime(seconds);
}

export function buildResultShareText(input: { currentStreak: number; durationSeconds: number; hintsUsed: number }): string {
  return [
    "PuzzGrind Daily Sudoku",
    `Solved in ${formatResultTime(input.durationSeconds)}`,
    `Hints used: ${input.hintsUsed}`,
    `🔥 ${input.currentStreak} day streak`,
    "",
    "Can you solve today’s puzzle?",
    "https://puzzgrind.com/sudoku",
  ].join("\n");
}

export function copyResultText(capability: ShareCapability, text: string): Promise<ShareOutcome> {
  return copyText(capability, text);
}

export async function shareResultText(capability: ShareCapability, text: string): Promise<ShareOutcome> {
  return shareText(capability, { title: "PuzzGrind Daily Sudoku", text });
}
