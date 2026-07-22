export const LEADERBOARD_DISPLAY_NAME_KEY = "puzzgrind_leaderboard_display_name_v1";

export type DisplayNameResult =
  | { ok: true; value: string }
  | { error: "inappropriate_display_name" | "invalid_display_name"; ok: false };

const blockedNames = new Set([
  "admin",
  "administrator",
  "bitch",
  "fuck",
  "moderator",
  "nazi",
  "nigger",
  "puzzgrind",
  "shit",
  "support",
]);

export function normalizeDisplayName(input: unknown): DisplayNameResult {
  if (typeof input !== "string") return { ok: false, error: "invalid_display_name" };
  if (/[\p{Cc}\p{Cf}]/u.test(input)) return { ok: false, error: "invalid_display_name" };
  const value = input.normalize("NFKC").trim().replace(/\s+/gu, " ");
  const length = [...value].length;
  if (length < 2 || length > 16 || !/^[\p{L}\p{N} _-]+$/u.test(value)) {
    return { ok: false, error: "invalid_display_name" };
  }
  const compact = value.toLocaleLowerCase("en-US").replace(/[ _-]+/gu, "");
  if (
    blockedNames.has(compact) || compact.startsWith("puzzgrind") ||
    compact.endsWith("admin") || compact.endsWith("moderator") || compact.endsWith("support")
  ) return { ok: false, error: "inappropriate_display_name" };
  return { ok: true, value };
}

type NameStorage = Pick<Storage, "getItem" | "setItem">;

export function loadLeaderboardDisplayName(storage: NameStorage, fallback: string): string {
  try {
    const stored = normalizeDisplayName(storage.getItem(LEADERBOARD_DISPLAY_NAME_KEY));
    return stored.ok ? stored.value : fallback;
  } catch {
    return fallback;
  }
}

export function saveLeaderboardDisplayName(storage: NameStorage, displayName: string): boolean {
  const normalized = normalizeDisplayName(displayName);
  if (!normalized.ok) return false;
  try {
    storage.setItem(LEADERBOARD_DISPLAY_NAME_KEY, normalized.value);
    return true;
  } catch {
    return false;
  }
}
