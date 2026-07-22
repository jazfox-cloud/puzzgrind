export const ANONYMOUS_ID_KEY = "puzzgrind_anonymous_id";

type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

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
