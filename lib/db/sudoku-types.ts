export const puzzleStatuses = ["draft", "validated", "scheduled", "published", "archived"] as const;
export type PuzzleStatus = (typeof puzzleStatuses)[number];

export const sessionStatuses = ["started", "in_progress", "paused", "won", "rejected"] as const;
export type SessionStatus = (typeof sessionStatuses)[number];

export const hintTechniques = [
  "naked_single",
  "hidden_single",
  "candidate_elimination",
  "locked_candidates",
  "box_line_reduction",
] as const;
export type HintTechnique = (typeof hintTechniques)[number];

export type SudokuPuzzle = {
  id: string;
  puzzleDate: string;
  difficulty: "medium";
  givens: string;
  solution: string;
  techniqueProfile: Record<string, unknown> | null;
  sourceType: string | null;
  sourceReference: string | null;
  validationVersion: string;
  status: PuzzleStatus;
  publishedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export type NewSudokuPuzzle = Omit<SudokuPuzzle, "createdAt" | "updatedAt">;

export type SudokuSession = {
  id: string;
  anonymousId: string;
  puzzleId: string;
  status: SessionStatus;
  boardState: unknown;
  notes: unknown;
  mistakes: number;
  hintCount: number;
  maxHintLevel: 0 | 1 | 2 | 3;
  durationSeconds: number | null;
  challengeNonce: string | null;
  startedAt: number;
  completedAt: number | null;
  updatedAt: number;
};

export type SudokuPuzzleStats = {
  puzzleId: string;
  startCount: number;
  completionCount: number;
  totalCompletionSeconds: number;
  totalMistakes: number;
  totalHints: number;
  noHintCompletions: number;
  abandonedCount: number;
  updatedAt: number;
};

export type SudokuHintEvent = {
  id: string;
  sessionId: string;
  puzzleId: string;
  technique: HintTechnique;
  hintLevel: 1 | 2 | 3;
  targetCells: number[];
  createdAt: number;
};

export type SudokuLeaderboardEntry = {
  completedAt: number;
  createdAt: number;
  displayName: string;
  id: string;
  playerKeyHash: string;
  puzzleDate: string;
  puzzleId: string;
  sessionId: string;
  verifiedCompletionSeconds: number;
  verifiedHintsUsed: number;
};

export type RankedSudokuLeaderboardEntry = Pick<
  SudokuLeaderboardEntry,
  "displayName" | "playerKeyHash" | "verifiedCompletionSeconds" | "verifiedHintsUsed"
> & { rank: number; totalCount: number };

export type LeaderboardRejectionReason = "completion_too_fast" | "completion_too_slow";
