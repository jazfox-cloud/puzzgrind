"use client";

import { GoogleAnalytics } from "@next/third-parties/google";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";

import {
  analyticsDebugMessage,
  isAnalyticsConfigured,
  isAnalyticsEnabled,
} from "@/lib/analytics/config";
import {
  clearAnalyticsCookies,
  getAnalyticsConsentServerSnapshot,
  getAnalyticsConsentSnapshot,
  storeAnalyticsConsent,
  subscribeToAnalyticsConsent,
  type AnalyticsConsent,
} from "@/lib/analytics/consent";
import type { AppEnvironment } from "@/lib/seo";

declare global {
  interface Window {
    __puzzgrindAnalyticsEnabled?: boolean;
  }
}

type AnalyticsProps = {
  environment: AppEnvironment;
  measurementId?: string;
  reloadPage?: () => void;
};

const choiceButton = "rounded-full border border-emerald-950 bg-emerald-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-800 focus:outline-4 focus:outline-amber-400";

export function Analytics({
  environment,
  measurementId,
  reloadPage = () => window.location.reload(),
}: AnalyticsProps) {
  const configured = isAnalyticsConfigured(environment, measurementId);
  const consent = useSyncExternalStore(
    subscribeToAnalyticsConsent,
    getAnalyticsConsentSnapshot,
    getAnalyticsConsentServerSnapshot,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const enabled = isAnalyticsEnabled(environment, measurementId, consent);

  useEffect(() => {
    window.__puzzgrindAnalyticsEnabled = enabled;
    console.info(analyticsDebugMessage(environment, enabled, consent));

    return () => {
      window.__puzzgrindAnalyticsEnabled = false;
    };
  }, [consent, enabled, environment]);

  function chooseConsent(nextConsent: Exclude<AnalyticsConsent, "unknown">) {
    const withdrawing = consent === "granted" && nextConsent === "denied";
    storeAnalyticsConsent(nextConsent);
    window.__puzzgrindAnalyticsEnabled = false;
    setSettingsOpen(false);

    if (withdrawing) {
      clearAnalyticsCookies();
      reloadPage();
    }
  }

  if (!configured) return null;

  return (
    <>
      {enabled && measurementId ? <GoogleAnalytics gaId={measurementId} /> : null}

      {consent === "unknown" || settingsOpen ? (
        <section
          aria-labelledby="analytics-consent-title"
          aria-modal="false"
          className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-2xl rounded-3xl border border-emerald-950/20 bg-[#fffdf5] p-5 shadow-2xl shadow-emerald-950/20"
          data-testid="analytics-consent-panel"
          role="dialog"
        >
          <h2 className="text-lg font-black" id="analytics-consent-title">Optional analytics</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
            We use Google Analytics to understand how PuzzGrind is used. Analytics is optional,
            and rejecting it will not affect the game. You can change this choice later.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button className={choiceButton} onClick={() => chooseConsent("granted")} type="button">
              Accept analytics
            </button>
            <button className={choiceButton} onClick={() => chooseConsent("denied")} type="button">
              Reject analytics
            </button>
            <Link className="inline-flex items-center px-2 text-sm font-bold underline underline-offset-4" href="/privacy">
              Privacy information
            </Link>
          </div>
        </section>
      ) : null}

      <button
        className="fixed bottom-4 left-4 z-40 rounded-full border border-emerald-950/20 bg-[#fffdf5] px-3 py-2 text-xs font-bold shadow-lg focus:outline-4 focus:outline-amber-400"
        data-testid="analytics-settings"
        onClick={() => setSettingsOpen(true)}
        type="button"
      >
        Privacy settings
      </button>
    </>
  );
}
