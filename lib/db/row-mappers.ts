import { DatabaseError } from "./errors";
import { hintTechniques, puzzleStatuses, sessionStatuses } from "./sudoku-types";
import type { SudokuHintEvent, SudokuPuzzle, SudokuPuzzleStats, SudokuSession } from "./sudoku-types";

type PuzzleRow = {
  id: string;
  puzzle_date: string;
  difficulty: string;
  givens: string;
  solution: string;
  technique_profile_json: string | null;
  source_type: string | null;
  source_reference: string | null;
  validation_version: string;
  status: string;
  published_at: number | null;
  created_at: number;
  updated_at: number;
};

type SessionRow = {
  id: string;
  anonymous_id: string;
  puzzle_id: string;
  status: string;
  board_state_json: string;
  notes_json: string;
  mistakes: number;
  hint_count: number;
  max_hint_level: number;
  duration_seconds: number | null;
  challenge_nonce: string | null;
  started_at: number;
  completed_at: number | null;
  updated_at: number;
};

type StatsRow = {
  puzzle_id: string;
  start_count: number;
  completion_count: number;
  total_completion_seconds: number;
  total_mistakes: number;
  total_hints: number;
  no_hint_completions: number;
  abandoned_count: number;
  updated_at: number;
};

type HintEventRow = {
  id: string;
  session_id: string;
  puzzle_id: string;
  technique: string;
  hint_level: number;
  target_cells_json: string;
  created_at: number;
};

function parseJson<T>(value: string, field: string): T {
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    throw new DatabaseError("invalid_data", `D1 returned invalid JSON for ${field}.`, error);
  }
}

function includesValue<const Values extends readonly string[]>(values: Values, value: string): value is Values[number] {
  return values.includes(value);
}

export function mapPuzzleRow(row: PuzzleRow): SudokuPuzzle {
  if (row.difficulty !== "medium" || !includesValue(puzzleStatuses, row.status)) {
    throw new DatabaseError("invalid_data", "D1 returned an invalid Sudoku puzzle row.");
  }

  return {
    id: row.id,
    puzzleDate: row.puzzle_date,
    difficulty: row.difficulty,
    givens: row.givens,
    solution: row.solution,
    techniqueProfile: row.technique_profile_json
      ? parseJson<Record<string, unknown>>(row.technique_profile_json, "technique_profile_json")
      : null,
    sourceType: row.source_type,
    sourceReference: row.source_reference,
    validationVersion: row.validation_version,
    status: row.status,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapSessionRow(row: SessionRow): SudokuSession {
  if (!includesValue(sessionStatuses, row.status) || ![0, 1, 2, 3].includes(row.max_hint_level)) {
    throw new DatabaseError("invalid_data", "D1 returned an invalid Sudoku session row.");
  }

  return {
    id: row.id,
    anonymousId: row.anonymous_id,
    puzzleId: row.puzzle_id,
    status: row.status,
    boardState: parseJson<unknown>(row.board_state_json, "board_state_json"),
    notes: parseJson<unknown>(row.notes_json, "notes_json"),
    mistakes: row.mistakes,
    hintCount: row.hint_count,
    maxHintLevel: row.max_hint_level as 0 | 1 | 2 | 3,
    durationSeconds: row.duration_seconds,
    challengeNonce: row.challenge_nonce,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
  };
}

export function mapStatsRow(row: StatsRow): SudokuPuzzleStats {
  return {
    puzzleId: row.puzzle_id,
    startCount: row.start_count,
    completionCount: row.completion_count,
    totalCompletionSeconds: row.total_completion_seconds,
    totalMistakes: row.total_mistakes,
    totalHints: row.total_hints,
    noHintCompletions: row.no_hint_completions,
    abandonedCount: row.abandoned_count,
    updatedAt: row.updated_at,
  };
}

export function mapHintEventRow(row: HintEventRow): SudokuHintEvent {
  if (!includesValue(hintTechniques, row.technique) || ![1, 2, 3].includes(row.hint_level)) {
    throw new DatabaseError("invalid_data", "D1 returned an invalid Sudoku hint event row.");
  }

  return {
    id: row.id,
    sessionId: row.session_id,
    puzzleId: row.puzzle_id,
    technique: row.technique,
    hintLevel: row.hint_level as 1 | 2 | 3,
    targetCells: parseJson<number[]>(row.target_cells_json, "target_cells_json"),
    createdAt: row.created_at,
  };
}

export type { HintEventRow, PuzzleRow, SessionRow, StatsRow };
