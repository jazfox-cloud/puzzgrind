import { ArticlesLink } from "@/components/ArticlesLink";
import Link from "next/link";

import { JsonLd } from "@/components/JsonLd";
import { NonogramGame } from "@/components/nonogram/NonogramGame";
import { SiteFooter } from "@/components/SiteFooter";
import { getBuildAppEnvironment } from "@/lib/build-environment";
import { nonogramCoverage, nonogramFaqJsonLd, nonogramFaqs } from "@/lib/nonogram/copy";
import { createPageMetadata, NONOGRAM_JSON_LD, NONOGRAM_SEO } from "@/lib/seo";

export function generateMetadata() {
  return createPageMetadata(NONOGRAM_SEO, getBuildAppEnvironment());
}

export default function NonogramPage() {
  return <main className="mx-auto min-h-screen max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
    <JsonLd data={NONOGRAM_JSON_LD} />
    <JsonLd data={nonogramFaqJsonLd()} />
    <header className="mb-8 flex items-center justify-between border-b border-emerald-950/15 pb-5">
      <Link className="text-xl font-black tracking-[-0.04em]" href="/">PuzzGrind</Link>
      <nav aria-label="Main navigation" className="flex items-center gap-1"><ArticlesLink /><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-emerald-950">Daily</span></nav>
    </header>
    <div className="mx-auto mb-7 max-w-xl">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-800">Today’s picture logic</p>
      <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] sm:text-5xl">Daily Nonogram</h1>
      <p className="mt-3 leading-7 text-[var(--ink-soft)]">Fill the shared picture from the row and column numbers. Start with a 5×5, or take the 10×10. No account required.</p>
      <p className="mt-3 leading-7 text-[var(--ink-soft)]">The daily picture uses the UTC date and changes at 00:00 UTC, the same day boundary as Daily Sudoku and Lexi Daily.</p>
    </div>
    <NonogramGame />
    <section className="mx-auto mt-12 max-w-xl rounded-3xl bg-white/75 p-6" id="how-to-play">
      <h2 className="text-2xl font-black">How to play Nonogram</h2>
      <p className="mt-3 leading-7 text-[var(--ink-soft)]">A Nonogram hides one picture on a grid. Paint cells so every row and every column matches the numbers beside it.</p>
      <ol className="mt-4 list-decimal space-y-3 pl-5 leading-7 text-[var(--ink-soft)]">
        <li>A number is one continuous run of filled cells.</li>
        <li>Read the numbers in order. Two runs in the same line have at least one empty cell between them.</li>
        <li>A zero means the line has no filled cells.</li>
        <li>Fill paints a cell. Cross marks a cell you know is empty, and tapping that mark again clears it. Crosses are notes, so you can finish without marking every empty cell.</li>
        <li>The puzzle is complete when every cell in the picture is filled and no extra cell is filled.</li>
        <li>Undo and Redo move through your marks. Reset asks before it clears the grid, the undo history, and the timer.</li>
        <li>On a keyboard, focus the board. Arrow keys move. F or 1 fills, X or 2 crosses, Delete clears, Z undoes, and Y redoes. On a touch screen, drag repeats the mark from the first cell.</li>
      </ol>
      <h3 className="mt-6 text-xl font-black">A line of five with the clue 3</h3>
      <p className="mt-3 leading-7 text-[var(--ink-soft)]">The block of three can start in the first, second, or third cell. Those three placements all cover the middle cell, so the middle cell can be filled before the ends of the line are known. The same overlap is the basic move on the larger boards.</p>
      <h3 className="mt-6 text-xl font-black">What this set covers</h3>
      <p className="mt-3 leading-7 text-[var(--ink-soft)]">{nonogramCoverage()} Each picture was checked before it was added: the numbers match the picture, the numbers allow only one solution, and the picture can be reached from the numbers by line logic, without guessing.</p>
      <p className="mt-4 leading-7 text-[var(--ink-soft)]">Your marks stay in this browser. For a number puzzle on the same UTC day, try <Link className="font-bold underline" href="/sudoku">Daily Sudoku</Link> or <Link className="font-bold underline" href="/games/lexi-daily">Lexi Daily</Link>.</p>
    </section>
    <section className="mx-auto mt-8 max-w-xl rounded-3xl bg-white/75 p-6" id="faq">
      <h2 className="text-2xl font-black">Daily Nonogram questions</h2>
      <div className="mt-4 space-y-3">
        {nonogramFaqs().map((item) => <details key={item.question} open className="rounded-2xl border border-emerald-950/10 bg-white px-4 py-3">
          <summary className="cursor-pointer font-black">{item.question}</summary>
          <p className="mt-2 leading-7 text-[var(--ink-soft)]">{item.answer}</p>
        </details>)}
      </div>
    </section>
    <SiteFooter className="mt-12" />
  </main>;
}
