import { findGivenViolations, parseBoard } from "./index";

export const GAME_SAVE_VERSION = 1;
export const ANONYMOUS_ID_KEY = "puzzgrind_anonymous_id";

export type GameSnapshot = {
  notes: number[][];
  values: number[];
};

export type SavedGame = GameSnapshot & {
  future: GameSnapshot[];
  history: GameSnapshot[];
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
  const existing = storage.getItem(ANONYMOUS_ID_KEY);
  if (existing && isAnonymousId(existing)) return existing;
  const created = createUuid();
  if (!isAnonymousId(created)) throw new Error("Anonymous ID generator did not return a UUID v4.");
  storage.setItem(ANONYMOUS_ID_KEY, created);
  return created;
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

export function parseSavedGame(raw: string, puzzleId: string, givens: string): SavedGame | null {
  try {
    const value = JSON.parse(raw) as Partial<SavedGame>;
    if (
      value.version !== GAME_SAVE_VERSION || value.puzzleId !== puzzleId ||
      !validValues(value.values) || !validNotes(value.notes) ||
      !Array.isArray(value.history) || !value.history.every(validSnapshot) ||
      !Array.isArray(value.future) || !value.future.every(validSnapshot) ||
      typeof value.noteMode !== "boolean" || typeof value.paused !== "boolean" ||
      !Number.isInteger(value.seconds) || (value.seconds ?? -1) < 0 ||
      !Number.isInteger(value.savedAt) || (value.savedAt ?? -1) < 0 ||
      !(value.selected === null || (Number.isInteger(value.selected) && (value.selected ?? -1) >= 0 && (value.selected ?? 81) < 81))
    ) return null;

    if (findGivenViolations(parseBoard(givens), value.values as ReturnType<typeof parseBoard>).length > 0) return null;
    return value as SavedGame;
  } catch {
    return null;
  }
}

export function loadSavedGame(storage: KeyValueStorage, puzzleId: string, givens: string): SavedGame | null {
  const raw = storage.getItem(gameSaveKey(puzzleId));
  return raw ? parseSavedGame(raw, puzzleId, givens) : null;
}

export function saveGame(storage: KeyValueStorage, game: SavedGame): void {
  storage.setItem(gameSaveKey(game.puzzleId), JSON.stringify(game));
}

export function clearSavedGame(storage: KeyValueStorage, puzzleId: string): void {
  storage.removeItem(gameSaveKey(puzzleId));
}
