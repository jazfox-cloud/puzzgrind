import {
  LEADERBOARD_DISPLAY_NAME_KEY,
  loadLeaderboardDisplayName as loadSharedLeaderboardDisplayName,
  normalizeDisplayName,
  saveLeaderboardDisplayName,
} from "@/lib/leaderboard/display-name";
import type { DisplayNameResult } from "@/lib/leaderboard/display-name";

export { LEADERBOARD_DISPLAY_NAME_KEY, normalizeDisplayName, saveLeaderboardDisplayName };
export type { DisplayNameResult };

export const DEFAULT_LEADERBOARD_NAME = "Sudoku Fan";
export const MIN_LEADERBOARD_SECONDS = 30;
export const MAX_LEADERBOARD_SECONDS = 6 * 60 * 60;

export type LeaderboardEntry = {
  displayName: string;
  durationSeconds: number;
  hintsUsed: number;
  isYou: boolean;
  rank: number;
};

export type LeaderboardSnapshot = {
  completionCount: number;
  entries: LeaderboardEntry[];
  joinedCount: number;
  ownRank: number | null;
  puzzleDate: string;
  puzzleId: string;
};

type NameStorage = Pick<Storage, "getItem" | "setItem">;

export function loadLeaderboardDisplayName(storage: NameStorage): string {
  return loadSharedLeaderboardDisplayName(storage, DEFAULT_LEADERBOARD_NAME);
}
