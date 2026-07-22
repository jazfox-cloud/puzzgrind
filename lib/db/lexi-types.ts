import type { LexiGuessResult } from "@/lib/lexi";

export const lexiPuzzleStatuses = ["draft", "validated", "scheduled", "published", "archived"] as const;
export type LexiPuzzleStatus = (typeof lexiPuzzleStatuses)[number];
export const lexiSessionStatuses = ["started", "in_progress", "won", "lost", "expired"] as const;
export type LexiSessionStatus = (typeof lexiSessionStatuses)[number];

export type LexiPuzzle = {
  answer: string;
  createdAt: number;
  id: string;
  maxAttempts: 6;
  publishedAt: number | null;
  puzzleDate: string;
  sourceReference: string | null;
  status: LexiPuzzleStatus;
  updatedAt: number;
  validationVersion: string;
  wordLength: 5;
};

export type LexiSession = {
  anonymousId: string;
  attemptCount: number;
  challengeNonce: string;
  completedAt: number | null;
  durationSeconds: number | null;
  guesses: LexiGuessResult[];
  hintCount: 0 | 1;
  hintLetter: string | null;
  id: string;
  puzzleId: string;
  revision: number;
  startedAt: number;
  status: LexiSessionStatus;
  updatedAt: number;
};

export type LexiPuzzleStats = {
  failCount: number;
  puzzleId: string;
  startCount: number;
  totalAttempts: number;
  totalCompletionSeconds: number;
  totalHints: number;
  updatedAt: number;
  winCount: number;
};

export type LexiLeaderboardEntry = {
  completedAt: number;
  createdAt: number;
  displayName: string;
  id: string;
  playerKeyHash: string;
  puzzleDate: string;
  puzzleId: string;
  sessionId: string;
  verifiedAttempts: number;
  verifiedCompletionSeconds: number;
  verifiedHintsUsed: number;
};

export type RankedLexiLeaderboardEntry = Pick<LexiLeaderboardEntry,
  "displayName" | "playerKeyHash" | "verifiedAttempts" | "verifiedCompletionSeconds" | "verifiedHintsUsed"
> & { rank: number; totalCount: number };
