export const ANALYTICS_CONSENT_STORAGE_KEY = "puzzgrind.analytics-consent.v1";
const ANALYTICS_CONSENT_CHANGE_EVENT = "puzzgrind:analytics-consent-change";

export type AnalyticsConsent = "unknown" | "granted" | "denied";

type ConsentReader = Pick<Storage, "getItem">;
type ConsentWriter = Pick<Storage, "removeItem" | "setItem">;

export function parseAnalyticsConsent(value: string | null): AnalyticsConsent {
  return value === "granted" || value === "denied" ? value : "unknown";
}

export function readAnalyticsConsent(storage: ConsentReader = window.localStorage) {
  try {
    return parseAnalyticsConsent(storage.getItem(ANALYTICS_CONSENT_STORAGE_KEY));
  } catch {
    return "unknown";
  }
}

export function storeAnalyticsConsent(
  consent: AnalyticsConsent,
  storage: ConsentWriter = window.localStorage,
) {
  try {
    if (consent === "unknown") storage.removeItem(ANALYTICS_CONSENT_STORAGE_KEY);
    else storage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, consent);
    if (typeof window !== "undefined") window.dispatchEvent(new Event(ANALYTICS_CONSENT_CHANGE_EVENT));
    return true;
  } catch {
    return false;
  }
}

export function getAnalyticsConsentSnapshot() {
  return readAnalyticsConsent();
}

export function getAnalyticsConsentServerSnapshot(): AnalyticsConsent {
  return "unknown";
}

export function subscribeToAnalyticsConsent(onStoreChange: () => void) {
  function handleStorage(event: StorageEvent) {
    if (event.key === ANALYTICS_CONSENT_STORAGE_KEY) onStoreChange();
  }

  window.addEventListener("storage", handleStorage);
  window.addEventListener(ANALYTICS_CONSENT_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(ANALYTICS_CONSENT_CHANGE_EVENT, onStoreChange);
  };
}

export function clearAnalyticsCookies(
  cookieHeader = document.cookie,
  hostname = window.location.hostname,
  writeCookie: (value: string) => void = (value) => {
    document.cookie = value;
  },
) {
  const cookieNames = cookieHeader
    .split(";")
    .map((cookie) => cookie.trim().split("=", 1)[0])
    .filter((name) => name === "_ga" || name.startsWith("_ga_"));
  const domain = hostname.replace(/^www\./, "");

  for (const name of new Set(cookieNames)) {
    const expired = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
    writeCookie(expired);
    writeCookie(`${expired}; Domain=${domain}`);
    writeCookie(`${expired}; Domain=.${domain}`);
  }

  return cookieNames.length;
}
