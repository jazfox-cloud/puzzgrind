import Link from "next/link";

import { JsonLd } from "@/components/JsonLd";
import { SudokuGame } from "@/components/sudoku/SudokuGame";
import { createPageMetadata, getAppEnvironment, SUDOKU_JSON_LD, SUDOKU_SEO } from "@/lib/seo";

export function generateMetadata() {
  return createPageMetadata(SUDOKU_SEO, getAppEnvironment());
}

export const dynamic = "force-dynamic";

export default function SudokuPage() {
  return <main className="mx-auto min-h-screen max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
    <JsonLd data={SUDOKU_JSON_LD} />
    <header className="mb-8 flex items-center justify-between border-b border-emerald-950/15 pb-5"><Link className="text-xl font-black tracking-[-0.04em]" href="/">PuzzGrind</Link><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em]">Daily Sudoku</span></header>
    <div className="mb-7"><p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-800">Today&apos;s challenge</p><h1 className="mt-2 text-4xl font-black tracking-[-0.05em] sm:text-5xl">Daily Sudoku</h1><p className="mt-3 text-[var(--ink-soft)]">One Medium puzzle, shared worldwide. Take your time and trust the logic.</p></div>
    <SudokuGame />
  </main>;
}
