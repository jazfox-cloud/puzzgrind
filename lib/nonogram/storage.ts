/** Versioned local progress for Daily Nonogram. Solutions are never written. */

import { isComplete, type Mark, type NonogramState, type Tool } from "@/lib/nonogram/game";

export const NONOGRAM_SAVE_KEY = "puzzgrind-nonogram-v1";
const HISTORY_LIMIT = 100;
const MAX_SECONDS = 60 * 60 * 24 * 7;

export type NonogramStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
};

export type LoadedNonogram = { available: true; state: NonogramState | null } | { available: false };
export type LoadedSize = { available: true; size: 5 | 10 } | { available: false };

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

function readRaw(storage: NonogramStorage): { available: true; raw: string | null } | { available: false } {
  try {
    return { available: true, raw: storage.getItem(NONOGRAM_SAVE_KEY) };
  } catch {
    return { available: false };
  }
}

/** Returns null when this browser denies the storage object. Method failures are reported by the callers. */
export function browserNonogramStorage(): NonogramStorage | null {
  try {
    if (typeof window === "undefined") return null;
    const storage = window.localStorage;
    if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") return null;
    return storage;
  } catch {
    return null;
  }
}

export function loadNonogram(storage: NonogramStorage, puzzleId: string, solution: readonly number[]): LoadedNonogram {
  const read = readRaw(storage);
  if (!read.available) return { available: false };
  const file = parseSaveFile(read.raw);
  if (!file) return { available: true, state: null };
  return { available: true, state: parsePuzzleSave(file.puzzles[puzzleId], solution) };
}

export function loadPreferredSize(storage: NonogramStorage): LoadedSize {
  const read = readRaw(storage);
  if (!read.available) return { available: false };
  const file = parseSaveFile(read.raw);
  return { available: true, size: file?.preferredSize === 10 ? 10 : 5 };
}

export function saveNonogram(storage: NonogramStorage, puzzleId: string, state: NonogramState, preferredSize: 5 | 10): boolean {
  try {
    const read = readRaw(storage);
    if (!read.available) return false;
    const existing = parseSaveFile(read.raw) ?? emptySaveFile();
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
    return true;
  } catch {
    return false;
  }
}

export function removeNonogramSave(storage: NonogramStorage): boolean {
  try {
    if (typeof storage.removeItem !== "function") return false;
    storage.removeItem(NONOGRAM_SAVE_KEY);
    return true;
  } catch {
    return false;
  }
}
