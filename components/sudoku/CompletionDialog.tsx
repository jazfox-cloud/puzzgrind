"use client";

import { formatResultTime } from "@/lib/sudoku/engagement";
import type { CompletionFeedback, LocalSudokuStats } from "@/lib/sudoku/engagement";

type Result = {
  durationSeconds: number;
  hintCount: number;
};

type Props = {
  feedback: CompletionFeedback | null;
  onClose: () => void;
  onCopy: () => void;
  onFeedback: (feedback: CompletionFeedback) => void;
  onShare: () => void;
  result: Result;
  secondsToNext: number;
  shareStatus: string | null;
  stats: LocalSudokuStats;
};

function countdown(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

const feedbackOptions = [
  ["too_easy", "Too easy"],
  ["just_right", "Just right"],
  ["too_hard", "Too hard"],
] as const;

export function CompletionDialog({
  feedback,
  onClose,
  onCopy,
  onFeedback,
  onShare,
  result,
  secondsToNext,
  shareStatus,
  stats,
}: Props) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-emerald-950/60 p-4">
      <section
        aria-describedby="completion-summary"
        aria-labelledby="completion-title"
        aria-modal="true"
        className="my-auto w-full max-w-lg rounded-3xl bg-[#fffdf5] p-6 shadow-2xl sm:p-8"
        role="dialog"
      >
        <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">Daily Sudoku</p>
        <h2 className="mt-2 text-4xl font-black tracking-[-0.05em]" id="completion-title">Puzzle complete!</h2>
        <div className="mt-6 grid grid-cols-3 gap-2 text-center" id="completion-summary">
          <div className="rounded-2xl bg-emerald-50 p-3"><span className="block text-xs text-[var(--ink-soft)]">Time</span><strong className="mt-1 block text-lg">{formatResultTime(result.durationSeconds)}</strong></div>
          <div className="rounded-2xl bg-emerald-50 p-3"><span className="block text-xs text-[var(--ink-soft)]">Hints used</span><strong className="mt-1 block text-lg">{result.hintCount}</strong></div>
          <div className="rounded-2xl bg-emerald-50 p-3"><span className="block text-xs text-[var(--ink-soft)]">Current streak</span><strong className="mt-1 block text-lg">{stats.currentStreak} day{stats.currentStreak === 1 ? "" : "s"}</strong></div>
        </div>

        <div className="mt-6 rounded-2xl bg-emerald-950 p-5 text-white">
          <p className="text-xs font-black uppercase tracking-[0.15em] text-[var(--accent)]">Tomorrow&apos;s puzzle arrives in:</p>
          <p className="mt-2 font-mono text-3xl font-black" data-testid="tomorrow-countdown">{countdown(secondsToNext)}</p>
        </div>

        <fieldset className="mt-6">
          <legend className="font-black">How did today&apos;s puzzle feel?</legend>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {feedbackOptions.map(([value, label]) => (
              <button
                aria-pressed={feedback === value}
                className={`min-h-12 rounded-xl border px-2 text-sm font-black ${feedback === value ? "border-emerald-950 bg-emerald-950 text-white" : "border-emerald-950/20 bg-white"}`}
                key={value}
                onClick={() => onFeedback(value)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <button className="rounded-xl bg-emerald-950 px-5 py-3 font-black text-white" onClick={onShare} type="button">Share Result</button>
          <button className="rounded-xl border border-emerald-950/20 bg-white px-5 py-3 font-black" onClick={onCopy} type="button">Copy Result</button>
          <button className="rounded-xl border border-emerald-950/20 px-5 py-3 font-black sm:col-span-2" onClick={onClose} type="button">Close</button>
        </div>
        {shareStatus && <p className="mt-4 text-center text-sm font-bold text-emerald-800" role="status">{shareStatus}</p>}
      </section>
    </div>
  );
}
