import { findGivenViolations, parseBoard } from "./index";

export const GAME_SAVE_VERSION = 2;
export const ANONYMOUS_ID_KEY = "puzzgrind_anonymous_id";
export const ONBOARDING_STORAGE_KEY = "puzzgrind_sudoku_onboarding_seen_v1";

export type GameSnapshot = {
  notes: number[][];
  values: number[];
};

export type SavedCompletionResult = {
  durationSeconds: number;
  hintCount: number;
  maxHintLevel: number;
  mistakes: number;
};

export type SavedGame = GameSnapshot & {
  completedResult?: SavedCompletionResult | null;
  future: GameSnapshot[];
  history: GameSnapshot[];
  hintCount: number;
  maxHintLevel: 0 | 1 | 2 | 3;
  mistakes: number;
  noteMode: boolean;
  paused: boolean;
  puzzleId: string;
  savedAt: number;
  seconds: number;
  selected: number | null;
  version: typeof GAME_SAVE_VERSION;
};

type KeyValueStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;

export function gameSaveKey(puzzleId: string): string {
  return `puzzgrind_sudoku_${puzzleId}`;
}

export function isAnonymousId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function getOrCreateAnonymousId(storage: KeyValueStorage, createUuid: () => string): string {
  let existing: string | null = null;
  try {
    existing = storage.getItem(ANONYMOUS_ID_KEY);
  } catch {
    // A blocked storage API should not prevent someone from playing.
  }
  if (existing && isAnonymousId(existing)) return existing;
  const created = createUuid();
  if (!isAnonymousId(created)) throw new Error("Anonymous ID generator did not return a UUID v4.");
  try {
    storage.setItem(ANONYMOUS_ID_KEY, created);
  } catch {
    // The ID remains valid for this session even when it cannot be persisted.
  }
  return created;
}

export function hasSeenOnboarding(storage: KeyValueStorage): boolean {
  try {
    return storage.getItem(ONBOARDING_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function markOnboardingSeen(storage: KeyValueStorage): void {
  try {
    storage.setItem(ONBOARDING_STORAGE_KEY, "true");
  } catch {
    // The guide can still be dismissed for the current page view.
  }
}

function validValues(value: unknown): value is number[] {
  return Array.isArray(value) && value.length === 81 && value.every((cell) => Number.isInteger(cell) && cell >= 0 && cell <= 9);
}

function validNotes(value: unknown): value is number[][] {
  return Array.isArray(value) && value.length === 81 && value.every(
    (cell) => Array.isArray(cell) && cell.every((candidate) => Number.isInteger(candidate) && candidate >= 1 && candidate <= 9),
  );
}

function validSnapshot(value: unknown): value is GameSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<GameSnapshot>;
  return validValues(snapshot.values) && validNotes(snapshot.notes);
}

function validCompletionResult(value: unknown): value is SavedCompletionResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<SavedCompletionResult>;
  return Number.isInteger(result.durationSeconds) && (result.durationSeconds ?? 0) >= 1 &&
    Number.isInteger(result.hintCount) && (result.hintCount ?? -1) >= 0 &&
    Number.isInteger(result.maxHintLevel) && (result.maxHintLevel ?? -1) >= 0 && (result.maxHintLevel ?? 4) <= 3 &&
    Number.isInteger(result.mistakes) && (result.mistakes ?? -1) >= 0;
}

export function parseSavedGame(raw: string, puzzleId: string, givens: string): SavedGame | null {
  try {
    const value = JSON.parse(raw) as Partial<SavedGame>;
    if (
      value.version !== GAME_SAVE_VERSION || value.puzzleId !== puzzleId ||
      !validValues(value.values) || !validNotes(value.notes) ||
      !Array.isArray(value.history) || !value.history.every(validSnapshot) ||
      !Array.isArray(value.future) || !value.future.every(validSnapshot) ||
      typeof value.noteMode !== "boolean" || typeof value.paused !== "boolean" ||
      !Number.isInteger(value.mistakes) || (value.mistakes ?? -1) < 0 ||
      !Number.isInteger(value.hintCount) || (value.hintCount ?? -1) < 0 ||
      ![0, 1, 2, 3].includes(value.maxHintLevel ?? -1) ||
      !Number.isInteger(value.seconds) || (value.seconds ?? -1) < 0 ||
      !Number.isInteger(value.savedAt) || (value.savedAt ?? -1) < 0 ||
      !(value.completedResult === undefined || value.completedResult === null || validCompletionResult(value.completedResult)) ||
      !(value.selected === null || (Number.isInteger(value.selected) && (value.selected ?? -1) >= 0 && (value.selected ?? 81) < 81))
    ) return null;

    if (findGivenViolations(parseBoard(givens), value.values as ReturnType<typeof parseBoard>).length > 0) return null;
    return value as SavedGame;
  } catch {
    return null;
  }
}

export function loadSavedGame(storage: KeyValueStorage, puzzleId: string, givens: string): SavedGame | null {
  try {
    const raw = storage.getItem(gameSaveKey(puzzleId));
    return raw ? parseSavedGame(raw, puzzleId, givens) : null;
  } catch {
    return null;
  }
}

export function saveGame(storage: KeyValueStorage, game: SavedGame): void {
  try {
    storage.setItem(gameSaveKey(game.puzzleId), JSON.stringify(game));
  } catch {
    // Keep the in-memory game usable if storage is unavailable or full.
  }
}

export function clearSavedGame(storage: KeyValueStorage, puzzleId: string): void {
  try {
    storage.removeItem(gameSaveKey(puzzleId));
  } catch {
    // The in-memory restart still succeeds.
  }
}
