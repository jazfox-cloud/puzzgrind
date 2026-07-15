import Link from "next/link";

import { SiteFooter } from "@/components/SiteFooter";
import { getBuildAppEnvironment } from "@/lib/build-environment";
import { createPageMetadata, PRIVACY_SEO } from "@/lib/seo";

export function generateMetadata() {
  return createPageMetadata(PRIVACY_SEO, getBuildAppEnvironment());
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12 sm:px-10">
      <Link className="text-sm font-bold underline underline-offset-4" href="/">
        ← Back to PuzzGrind
      </Link>
      <h1 className="mt-8 text-4xl font-black tracking-[-0.05em]">Privacy and analytics</h1>
      <p className="mt-5 text-lg leading-8 text-[var(--ink-soft)]">
        PuzzGrind uses Google Analytics 4 only after you choose to accept optional analytics.
      </p>

      <div className="mt-10 space-y-8 leading-7">
        <section>
          <h2 className="text-xl font-black">What we use</h2>
          <p className="mt-2">
            The analytics service is Google Analytics 4, configured with Measurement ID
            {" "}<code>G-N1NLGSYBKD</code>. It helps us understand aggregate site usage and improve
            PuzzGrind.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-black">Information it may process</h2>
          <p className="mt-2">
            If accepted, Google Analytics may process information such as pages viewed, approximate
            location derived from network information, device and browser details, referring pages,
            and interaction timing. PuzzGrind does not send your Sudoku board or saved game data as
            analytics events in this foundation.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-black">Your choice</h2>
          <p className="mt-2">
            Analytics is optional. You can accept or reject it when asked, and rejection does not
            affect game features. Use the persistent <strong>Privacy settings</strong> button on any
            page to change your choice later. Withdrawing consent stops future events, removes
            accessible Google Analytics cookies, and refreshes the current page to cleanly disable
            the loaded tag.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-black">Consent storage</h2>
          <p className="mt-2">
            Your choice is stored only in this browser using first-party local storage. It contains
            no identity information, is not sent to PuzzGrind servers, and is separate from locally
            saved Sudoku progress.
          </p>
        </section>
      </div>

      <Link className="mt-12 inline-flex rounded-full bg-emerald-950 px-5 py-3 font-bold text-white" href="/sudoku">
        Play Daily Sudoku
      </Link>
      <SiteFooter className="mt-12" />
    </main>
  );
}
