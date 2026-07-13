import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ANALYTICS_CONSENT_STORAGE_KEY } from "@/lib/analytics/consent";

const googleAnalytics = vi.hoisted(() => vi.fn(() => null));

vi.mock("@next/third-parties/google", () => ({ GoogleAnalytics: googleAnalytics }));

import { Analytics } from "@/lib/analytics/Analytics";
import type { AppEnvironment } from "@/lib/seo";

type MountedAnalytics = { container: HTMLDivElement; root: Root };

async function mountAnalytics(
  environment: AppEnvironment = "production",
  measurementId: string | null = "G-N1NLGSYBKD",
  reloadPage = vi.fn(),
): Promise<MountedAnalytics> {
  const container = document.createElement("div");
  const root = createRoot(container);
  const props = measurementId === null
    ? { environment, reloadPage }
    : { environment, measurementId, reloadPage };
  await act(async () => {
    root.render(createElement(Analytics, props));
  });
  return { container, root };
}

async function unmount({ root }: MountedAnalytics) {
  await act(async () => root.unmount());
}

function button(container: HTMLElement, label: string) {
  return Array.from(container.querySelectorAll("button")).find((item) => item.textContent === label);
}

describe("Analytics consent gate", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        key: (index: number) => Array.from(values.keys())[index] ?? null,
        get length() { return values.size; },
        removeItem: (key: string) => values.delete(key),
        setItem: (key: string, value: string) => values.set(key, value),
      } satisfies Storage,
    });
    googleAnalytics.mockClear();
    window.localStorage.clear();
    window.__puzzgrindAnalyticsEnabled = false;
    vi.spyOn(console, "info").mockImplementation(() => undefined);
  });

  it.each(["unknown", "denied"] as const)("does not load GA for Production consent %s", async (consent) => {
    if (consent === "denied") window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, consent);
    const mounted = await mountAnalytics();
    expect(googleAnalytics).not.toHaveBeenCalled();
    expect(window.__puzzgrindAnalyticsEnabled).toBe(false);
    await unmount(mounted);
  });

  it("loads the official GA component once for configured Production with granted consent", async () => {
    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "granted");
    const mounted = await mountAnalytics();
    expect(googleAnalytics).toHaveBeenCalledTimes(1);
    expect(googleAnalytics).toHaveBeenCalledWith({ gaId: "G-N1NLGSYBKD" }, undefined);
    expect(window.__puzzgrindAnalyticsEnabled).toBe(true);
    await unmount(mounted);
  });

  it.each(["preview", "staging"] as const)("never loads GA in %s even when consent is granted", async (environment) => {
    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "granted");
    const mounted = await mountAnalytics(environment);
    expect(googleAnalytics).not.toHaveBeenCalled();
    expect(window.__puzzgrindAnalyticsEnabled).toBe(false);
    await unmount(mounted);
  });

  it.each([null, "invalid"])("does not load GA with Measurement ID %s", async (measurementId) => {
    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "granted");
    const mounted = await mountAnalytics("production", measurementId);
    expect(googleAnalytics).not.toHaveBeenCalled();
    await unmount(mounted);
  });

  it("shows equal Accept and Reject choices plus persistent privacy controls", async () => {
    const mounted = await mountAnalytics();
    expect(button(mounted.container, "Accept analytics")).toBeDefined();
    expect(button(mounted.container, "Reject analytics")).toBeDefined();
    expect(button(mounted.container, "Privacy settings")).toBeDefined();
    expect(mounted.container.querySelector('a[href="/privacy"]')).not.toBeNull();
    await unmount(mounted);
  });

  it("enables GA only after Accept", async () => {
    const mounted = await mountAnalytics();
    await act(async () => button(mounted.container, "Accept analytics")?.click());
    expect(window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY)).toBe("granted");
    expect(googleAnalytics).toHaveBeenCalledTimes(1);
    expect(window.__puzzgrindAnalyticsEnabled).toBe(true);
    await unmount(mounted);
  });

  it("keeps GA disabled after Reject", async () => {
    const mounted = await mountAnalytics();
    await act(async () => button(mounted.container, "Reject analytics")?.click());
    expect(window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY)).toBe("denied");
    expect(googleAnalytics).not.toHaveBeenCalled();
    expect(window.__puzzgrindAnalyticsEnabled).toBe(false);
    await unmount(mounted);
  });

  it("stops events and preserves Sudoku storage when granted consent is withdrawn", async () => {
    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "granted");
    window.localStorage.setItem("puzzgrind.sudoku.progress", "keep");
    document.cookie = "_ga=test; Path=/";
    const reloadPage = vi.fn();
    const mounted = await mountAnalytics("production", "G-N1NLGSYBKD", reloadPage);

    await act(async () => button(mounted.container, "Privacy settings")?.click());
    await act(async () => button(mounted.container, "Reject analytics")?.click());

    expect(window.__puzzgrindAnalyticsEnabled).toBe(false);
    expect(window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY)).toBe("denied");
    expect(window.localStorage.getItem("puzzgrind.sudoku.progress")).toBe("keep");
    expect(document.cookie).not.toContain("_ga=");
    expect(reloadPage).toHaveBeenCalledTimes(1);
    await unmount(mounted);
  });
});
