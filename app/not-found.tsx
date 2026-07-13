import Link from "next/link";

export default function NotFound() {
  return <main className="mx-auto grid min-h-screen max-w-3xl place-items-center px-6 py-16 text-center">
    <section>
      <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-800">404 · Puzzle not found</p>
      <h1 className="mt-5 text-5xl font-black tracking-[-0.06em] sm:text-7xl">This square is empty.</h1>
      <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-[var(--ink-soft)]">The page may have moved, or the link may no longer be valid. You can return home or play today&apos;s Sudoku.</p>
      <nav aria-label="404 recovery" className="mt-9 flex flex-wrap justify-center gap-3">
        <Link className="rounded-full border border-emerald-950/20 px-6 py-3 font-bold" href="/">Back to PuzzGrind</Link>
        <Link className="rounded-full bg-emerald-950 px-6 py-3 font-bold text-white" href="/sudoku">Play Daily Sudoku</Link>
      </nav>
    </section>
  </main>;
}
