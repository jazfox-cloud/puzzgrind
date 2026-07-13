import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const googleAnalytics = vi.hoisted(() => vi.fn(() => null));

vi.mock("@next/third-parties/google", () => ({ GoogleAnalytics: googleAnalytics }));

import { Analytics } from "@/lib/analytics/Analytics";

describe("Analytics root integration", () => {
  beforeEach(() => {
    googleAnalytics.mockClear();
  });

  it("initializes the official GA component once for Production", () => {
    renderToStaticMarkup(createElement(Analytics, {
      environment: "production",
      measurementId: "G-N1NLGSYBKD",
    }));

    expect(googleAnalytics).toHaveBeenCalledTimes(1);
    expect(googleAnalytics).toHaveBeenCalledWith({ gaId: "G-N1NLGSYBKD" }, undefined);
  });

  it.each(["local", "test", "preview", "staging"] as const)(
    "does not render GA in %s",
    (environment) => {
      expect(renderToStaticMarkup(createElement(Analytics, {
        environment,
        measurementId: "G-N1NLGSYBKD",
      }))).toBe("");
      expect(googleAnalytics).not.toHaveBeenCalled();
    },
  );

  it("does not render GA in Production when configuration is missing", () => {
    expect(renderToStaticMarkup(createElement(Analytics, { environment: "production" }))).toBe("");
    expect(googleAnalytics).not.toHaveBeenCalled();
  });

  it.each([
    ["local", "Analytics Disabled (local)"],
    ["preview", "Analytics Disabled (preview)"],
    ["staging", "Analytics Disabled (staging)"],
    ["production", "Analytics Enabled"],
  ] as const)("logs the required %s debug status", async (environment, message) => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await act(async () => {
      root.render(createElement(Analytics, { environment, measurementId: "G-N1NLGSYBKD" }));
    });
    expect(info).toHaveBeenCalledWith(message);

    await act(async () => root.unmount());
    info.mockRestore();
  });
});
