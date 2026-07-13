import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PublicShareActions } from "@/components/sudoku/PublicShareActions";
import { verifyShareToken } from "@/lib/security/share-token";
import { NOINDEX_ROBOTS } from "@/lib/seo";
import { siteUrl } from "@/lib/site";

type Props = { params: Promise<{ token: string }> };

function time(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

async function readResult(token: string) {
  try {
    return await verifyShareToken(token, getCloudflareContext().env.SESSION_SIGNING_SECRET);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const result = await readResult(token);
  if (!result) return { title: "Sudoku result unavailable" };
  const shareUrl = siteUrl(`/sudoku/share/${token}`);
  const cardUrl = siteUrl(`/api/sudoku/share-card/${token}`);
  const title = `Daily Sudoku in ${time(result.durationSeconds)}`;
  const description = `${result.mistakes} mistakes · ${result.hintCount} hints · Can you beat this result?`;
  return {
    title,
    description,
    alternates: { canonical: shareUrl },
    openGraph: {
      type: "website",
      title: `${title} | PuzzGrind`,
      description,
      url: shareUrl,
      images: [{ url: cardUrl, width: 1200, height: 630, alt: "PuzzGrind Daily Sudoku result card" }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | PuzzGrind`,
      description,
      images: [cardUrl],
    },
    robots: NOINDEX_ROBOTS,
  };
}

export default async function SudokuSharePage({ params }: Props) {
  const { token } = await params;
  const result = await readResult(token);
  if (!result) notFound();
  const shareUrl = siteUrl(`/sudoku/share/${token}`);
  const shareText = `I finished PuzzGrind Daily Sudoku in ${time(result.durationSeconds)} with ${result.mistakes} mistakes and ${result.hintCount} hints. Can you beat it?`;
  return <main className="mx-auto min-h-screen max-w-3xl px-6 py-8 sm:px-10">
    <header className="flex items-center justify-between border-b border-emerald-950/15 pb-5">
      <Link className="text-xl font-black tracking-[-0.04em]" href="/">PuzzGrind</Link>
      <span className="rounded-full bg-emerald-950 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-white">Daily Sudoku</span>
    </header>
    <section className="py-14 text-center">
      <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-800">Verified result · {result.puzzleDate} UTC</p>
      <h1 className="mt-5 text-5xl font-black tracking-[-0.06em] sm:text-7xl">Puzzle complete.</h1>
      <div className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl bg-white/75 p-5"><span className="text-sm text-[var(--ink-soft)]">Time</span><strong className="mt-1 block text-2xl">{time(result.durationSeconds)}</strong></div>
        <div className="rounded-2xl bg-white/75 p-5"><span className="text-sm text-[var(--ink-soft)]">Mistakes</span><strong className="mt-1 block text-2xl">{result.mistakes}</strong></div>
        <div className="rounded-2xl bg-white/75 p-5"><span className="text-sm text-[var(--ink-soft)]">Hints</span><strong className="mt-1 block text-2xl">{result.hintCount}</strong></div>
        <div className="rounded-2xl bg-white/75 p-5"><span className="text-sm text-[var(--ink-soft)]">Best hint</span><strong className="mt-1 block text-2xl">{result.maxHintLevel ? `L${result.maxHintLevel}` : "—"}</strong></div>
      </div>
      <p className="mx-auto mt-8 max-w-lg text-lg leading-8 text-[var(--ink-soft)]">Can you beat this result? Today’s puzzle is the same for everyone worldwide.</p>
      <PublicShareActions cardUrl={siteUrl(`/api/sudoku/share-card/${token}`)} shareText={shareText} shareUrl={shareUrl} />
      <Link className="mt-8 inline-flex rounded-full bg-[var(--accent)] px-7 py-4 font-black text-emerald-950" href="/sudoku">Play today’s Sudoku</Link>
    </section>
  </main>;
}
