import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { SiteFooter } from "@/components/SiteFooter";
import { LexiGame } from "@/components/lexi/LexiGame";
import { getBuildAppEnvironment } from "@/lib/build-environment";
import { createPageMetadata, LEXI_JSON_LD, LEXI_SEO } from "@/lib/seo";

export function generateMetadata() { return createPageMetadata(LEXI_SEO, getBuildAppEnvironment()); }
export const dynamic = "force-dynamic";

export default function LexiDailyPage() {
  return <main className="mx-auto min-h-screen max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
    <JsonLd data={LEXI_JSON_LD} />
    <header className="mb-8 flex items-center justify-between border-b border-emerald-950/15 pb-5"><Link className="text-xl font-black tracking-[-0.04em]" href="/">PuzzGrind</Link><span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-blue-950">Lexi Daily</span></header>
    <div className="mx-auto mb-8 max-w-2xl text-center"><p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-800">Today’s word challenge</p><h1 className="mt-2 text-4xl font-black tracking-[-0.05em] sm:text-5xl">Lexi Daily</h1><p className="mt-3 text-[var(--ink-soft)]">Find the shared five-letter word in six guesses. Letter counts matter, and one optional hint is yours when you need it.</p></div>
    <LexiGame />
    <section className="mx-auto mt-14 max-w-2xl rounded-3xl bg-emerald-950 p-6 text-white sm:p-8"><h2 className="text-2xl font-black">A small daily vocabulary workout</h2><p className="mt-3 leading-7 text-white/80">Every valid guess receives a position-aware result. Correct letters are blue, letters elsewhere are orange, and absent letters are gray—with shapes and text labels so color is never the only cue.</p></section>
    <SiteFooter className="mt-12" />
  </main>;
}
