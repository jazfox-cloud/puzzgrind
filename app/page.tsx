import Link from "next/link";

import { JsonLd } from "@/components/JsonLd";
import { getBuildAppEnvironment } from "@/lib/build-environment";
import { createPageMetadata, HOME_SEO, isIndexableEnvironment, WEBSITE_JSON_LD } from "@/lib/seo";
import { siteUrl } from "@/lib/site";

export function generateMetadata() {
  return createPageMetadata(HOME_SEO, getBuildAppEnvironment());
}

export default function HomePage() {
  const indexable = isIndexableEnvironment(getBuildAppEnvironment());
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8 sm:px-10">
      {indexable ? <link href={siteUrl("/")} rel="canonical" /> : null}
      {indexable ? <meta content={siteUrl("/")} property="og:url" /> : null}
      <JsonLd data={WEBSITE_JSON_LD} />
      <header className="flex items-center justify-between border-b border-emerald-950/15 pb-5">
        <div className="text-xl font-black tracking-[-0.04em]">PuzzGrind</div>
        <span className="rounded-full border border-emerald-950/15 bg-white/60 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em]">
          Phase 0
        </span>
      </header>

      <section className="grid flex-1 items-center gap-12 py-20 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="mb-5 text-sm font-bold uppercase tracking-[0.2em] text-emerald-800">
            Explainable daily puzzles
          </p>
          <h1 className="max-w-3xl text-5xl font-black leading-[0.95] tracking-[-0.065em] sm:text-7xl">
            Play smarter, one puzzle at a time.
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-[var(--ink-soft)]">
            PuzzGrind is beginning with a daily Sudoku that explains the logic behind every hint.
          </p>
          <Link className="mt-9 inline-flex rounded-full bg-emerald-950 px-6 py-3 font-bold text-white transition hover:bg-emerald-800 focus:outline-4 focus:outline-amber-400" href="/sudoku">
            Play Daily Sudoku
          </Link>
        </div>

        <div aria-label="Sudoku preview" className="mx-auto grid aspect-square w-full max-w-md grid-cols-3 gap-1 rounded-[2rem] bg-emerald-950 p-3 shadow-2xl shadow-emerald-950/15">
          {Array.from({ length: 9 }, (_, index) => (
            <div key={index} className="grid grid-cols-3 gap-px overflow-hidden rounded-lg bg-emerald-950/30">
              {Array.from({ length: 9 }, (_, cell) => {
                const value = (index * 3 + cell * 2) % 10;
                return (
                  <span key={cell} className="grid place-items-center bg-[#fffdf5] text-sm font-bold sm:text-lg">
                    {value > 5 ? value : ""}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-emerald-950/15 py-5 text-sm text-[var(--ink-soft)]">
        © {new Date().getUTCFullYear()} PuzzGrind
      </footer>
    </main>
  );
}
