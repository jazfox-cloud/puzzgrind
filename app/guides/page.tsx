import Link from "next/link";
import { ArticlesLink } from "@/components/ArticlesLink";
import { SiteFooter } from "@/components/SiteFooter";
import { getBuildAppEnvironment } from "@/lib/build-environment";
import { createPageMetadata } from "@/lib/seo";

export function generateMetadata() {
  return createPageMetadata({ title: "Puzzle Articles and Guides", description: "Explore practical guides for Daily Sudoku, Mini Sudoku and Lexi Daily, with worked examples.", path: "/guides" }, getBuildAppEnvironment());
}

const categories = [
  { name: "Mini Sudoku", kind: "Logic", gameHref: "/games/mini-sudoku", articles: [
    { href: "/guides/6x6-sudoku-single-candidate", title: "How to Find a Single Candidate in 6×6 Sudoku", description: "Use a real 6×6 grid to find a move by checking its row, column and box." },
    { href: "/guides/6x6-sudoku-conflicts", title: "Why Is My 6×6 Sudoku Answer Marked as a Conflict?", description: "Learn to spot row, column and box conflicts and recover from mistakes." },
    { href: "/guides/6x6-sudoku-notes", title: "How to Use Notes in 6×6 Sudoku", description: "Track candidates and remove outdated notes with a worked example." },
    { href: "/guides/6x6-sudoku-hidden-single", title: "Find a Hidden Single in 6×6 Sudoku", description: "Find the only position for a number within a box." },
  ] },
  { name: "Daily Sudoku", kind: "Logic", gameHref: "/sudoku", articles: [
    { href: "/guides/sudoku-single-candidate", title: "How to Find a Single Candidate in 9×9 Sudoku", description: "Use a worked example to find a number without guessing." },
  ] },
  { name: "Lexi Daily", kind: "Words", gameHref: "/games/lexi-daily", articles: [
    { href: "/guides/lexi-repeated-letters", title: "How Repeated Letters Work in Lexi Daily", description: "Understand why one copy of a letter can be orange while another is gray." },
  ] },
] as const;

export default function GuidesPage() {
  return <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 sm:px-8 sm:py-10">
    <header className="flex items-center justify-between gap-2 border-b border-emerald-950/15 pb-5"><Link className="text-xl font-black tracking-[-0.04em]" href="/">PuzzGrind</Link><nav aria-label="Main navigation"><ArticlesLink /></nav></header>
    <div className="flex-1 py-12 sm:py-16"><p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-800">Learn as you play</p><h1 className="mt-3 text-4xl font-black tracking-[-0.05em] sm:text-5xl">Puzzle Articles &amp; Guides</h1><p className="mt-4 max-w-2xl text-lg leading-8 text-[var(--ink-soft)]">Practical explanations and worked examples to help you make your next move.</p>
      {categories.map((category) => <section className="mt-12" aria-label={`${category.name} articles`} key={category.name}><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-800">{category.kind}</p><h2 className="mt-2 text-3xl font-black tracking-[-0.04em]">{category.name}</h2></div><Link className="font-bold text-emerald-900 underline underline-offset-4" href={category.gameHref}>Play {category.name}</Link></div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">{category.articles.map((article) => <article className="rounded-3xl border border-emerald-950/15 bg-white/75 p-6" key={article.href}><h3 className="text-2xl font-black tracking-[-0.03em]"><Link className="underline-offset-4 hover:underline focus-visible:outline-4 focus-visible:outline-amber-400" href={article.href}>{article.title}</Link></h3><p className="mt-3 leading-7 text-[var(--ink-soft)]">{article.description}</p><Link className="mt-5 inline-flex font-bold text-emerald-900 underline underline-offset-4" href={article.href}>Read guide <span className="sr-only">: {article.title}</span> →</Link></article>)}</div>
      </section>)}
    </div><SiteFooter />
  </main>;
}
