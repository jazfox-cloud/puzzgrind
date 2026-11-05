import { ArticlesLink } from "@/components/ArticlesLink";
import Link from "next/link";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/SiteFooter";

export function GuideShell({ title, children, category = "Mini Sudoku", gameHref = "/games/mini-sudoku", gameLabel = "Play Mini Sudoku" }: { title: string; children: ReactNode; category?: string; gameHref?: string; gameLabel?: string }) {
  return <main className="mx-auto min-h-screen max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
    <header className="mb-10 flex items-center justify-between border-b border-emerald-950/15 pb-5"><Link className="text-xl font-black tracking-[-0.04em]" href="/">PuzzGrind</Link><nav aria-label="Main navigation" className="flex items-center gap-1"><ArticlesLink /><Link className="rounded-full bg-emerald-950 px-3 py-2 text-sm font-bold text-white" href={gameHref}>{gameLabel}</Link></nav></header>
    <article className="mx-auto max-w-2xl"><p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-800">{category} guide</p><h1 className="mt-3 text-4xl font-black tracking-[-0.05em] sm:text-5xl">{title}</h1><div className="mt-7 space-y-5 text-lg leading-8 text-[var(--ink-soft)]">{children}</div></article>
    <SiteFooter className="mt-16" />
  </main>;
}
