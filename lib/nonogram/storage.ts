/** Versioned local progress for Daily Nonogram. Solutions are never written. */

import { isComplete, type Mark, type NonogramState, type Tool } from "@/lib/nonogram/game";

export const NONOGRAM_SAVE_KEY = "puzzgrind-nonogram-v1";
const HISTORY_LIMIT = 100;
const MAX_SECONDS = 60 * 60 * 24 * 7;

export type NonogramStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

type StoredPuzzle = {
  cells: Mark[];
  history: Mark[][];
  future: Mark[][];
  tool: Tool;
  seconds: number;
  completed: boolean;
};

type StoredFile = {
  version: 1;
  preferredSize: 5 | 10;
  puzzles: Record<string, StoredPuzzle>;
};

function isMark(value: unknown): value is Mark {
  return value === "empty" || value === "fill" || value === "cross";
}

function isTool(value: unknown): value is Tool {
  return value === "fill" || value === "cross";
}

function isBoard(value: unknown, cellCount: number): value is Mark[] {
  return Array.isArray(value) && value.length === cellCount && value.every(isMark);
}

function isHistory(value: unknown, cellCount: number): value is Mark[][] {
  return Array.isArray(value) && value.length <= HISTORY_LIMIT && value.every((entry) => isBoard(entry, cellCount));
}

export function emptySaveFile(): StoredFile {
  return { version: 1, preferredSize: 5, puzzles: {} };
}

export function parseSaveFile(raw: string | null): StoredFile | null {
  if (!raw) return emptySaveFile();
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const file = value as Partial<StoredFile>;
    if (file.version !== 1 || !file.puzzles || typeof file.puzzles !== "object") return null;
    const preferredSize = file.preferredSize === 10 ? 10 : 5;
    return { version: 1, preferredSize, puzzles: file.puzzles };
  } catch {
    return null;
  }
}

export function parsePuzzleSave(value: unknown, solution: readonly number[]): NonogramState | null {
  if (!value || typeof value !== "object") return null;
  const saved = value as Partial<StoredPuzzle>;
  if (!isBoard(saved.cells, solution.length) || !isHistory(saved.history, solution.length) || !isHistory(saved.future, solution.length)) return null;
  if (!isTool(saved.tool) || typeof saved.seconds !== "number" || !Number.isInteger(saved.seconds) || saved.seconds < 0 || saved.seconds > MAX_SECONDS) return null;
  return {
    cells: saved.cells,
    history: saved.history,
    future: saved.future,
    tool: saved.tool,
    seconds: saved.seconds,
    completed: isComplete(saved.cells, solution),
  };
}

export function loadNonogram(storage: NonogramStorage, puzzleId: string, solution: readonly number[]): NonogramState | null {
  const file = parseSaveFile(storage.getItem(NONOGRAM_SAVE_KEY));
  if (!file) return null;
  return parsePuzzleSave(file.puzzles[puzzleId], solution);
}

export function loadPreferredSize(storage: NonogramStorage): 5 | 10 {
  return parseSaveFile(storage.getItem(NONOGRAM_SAVE_KEY))?.preferredSize ?? 5;
}

export function saveNonogram(storage: NonogramStorage, puzzleId: string, state: NonogramState, preferredSize: 5 | 10): void {
  const existing = parseSaveFile(storage.getItem(NONOGRAM_SAVE_KEY)) ?? emptySaveFile();
  const puzzles = { ...existing.puzzles };
  puzzles[puzzleId] = {
    cells: state.cells,
    history: state.history.slice(-HISTORY_LIMIT),
    future: state.future.slice(-HISTORY_LIMIT),
    tool: state.tool,
    seconds: state.seconds,
    completed: state.completed,
  };
  const file: StoredFile = { version: 1, preferredSize, puzzles };
  storage.setItem(NONOGRAM_SAVE_KEY, JSON.stringify(file));
}
