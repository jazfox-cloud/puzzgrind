import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { MiniSudokuGame } from "@/components/mini-sudoku/MiniSudokuGame";
import { getBuildAppEnvironment } from "@/lib/build-environment";
import { createPageMetadata } from "@/lib/seo";

export function generateMetadata() {
  return createPageMetadata({ title: "Mini Sudoku — Play 6×6 Sudoku", description: "Play 6×6 Mini Sudoku with notes, undo, and hints that explain the next move. No account required.", path: "/games/mini-sudoku" }, getBuildAppEnvironment());
}
export default function MiniSudokuPage() {
  return <main className="mx-auto min-h-screen max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
    <header className="mb-8 flex items-center justify-between border-b border-emerald-950/15 pb-5"><Link className="text-xl font-black tracking-[-0.04em]" href="/">PuzzGrind</Link><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em]">Practice</span></header>
    <div className="mx-auto mb-7 max-w-xl"><p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-800">A smaller logic break</p><h1 className="mt-2 text-4xl font-black tracking-[-0.05em] sm:text-5xl">Mini Sudoku</h1><p className="mt-3 leading-7 text-[var(--ink-soft)]">A 6×6 Sudoku with room for notes and hints that explain a move. Play through 30 practice puzzles at your own pace.</p></div>
    <MiniSudokuGame />
    <section className="mx-auto mt-12 max-w-xl rounded-3xl bg-white/75 p-6"><h2 className="text-2xl font-black">How to play 6×6 Sudoku</h2><p className="mt-3 leading-7 text-[var(--ink-soft)]">Place the numbers 1 to 6 once in each row, each column, and each 2-row by 3-column box. Given numbers cannot be changed. Use notes to track possibilities and Hint to see a single-candidate move when one is available.</p><p className="mt-4 leading-7 text-[var(--ink-soft)]">This practice collection cycles after 30 puzzles. For a larger daily challenge, try <Link className="font-bold underline" href="/sudoku">Daily Sudoku</Link>.</p></section>
    <SiteFooter className="mt-12" />
  </main>;
}
