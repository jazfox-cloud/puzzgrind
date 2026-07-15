"use client";

import { formatResultTime } from "@/lib/sudoku/engagement";
import type { LeaderboardSnapshot } from "@/lib/sudoku/leaderboard";

type BoardProps = {
  error: string | null;
  expanded: boolean;
  loading: boolean;
  onExpand: () => void;
  onRetry: () => void;
  snapshot: LeaderboardSnapshot | null;
};

type JoinProps = {
  displayName: string;
  error: string | null;
  joined: boolean;
  joining: boolean;
  onChange: (value: string) => void;
  onStart: () => void;
  onSubmit: () => void;
  ownRank: number | null;
  sessionReady: boolean;
  started: boolean;
};

export function DailyLeaderboard({ error, expanded, loading, onExpand, onRetry, snapshot }: BoardProps) {
  const entries = snapshot?.entries.slice(0, expanded ? 20 : 10) ?? [];
  return (
    <section aria-labelledby="daily-leaderboard-title" className="mt-10 rounded-3xl border border-emerald-950/15 bg-white/75 p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Daily challenge</p>
          <h2 className="mt-1 text-2xl font-black tracking-[-0.03em]" id="daily-leaderboard-title">Today&apos;s Leaderboard</h2>
        </div>
        {snapshot && <p className="text-sm font-bold text-[var(--ink-soft)]">{snapshot.completionCount} completed · {snapshot.joinedCount} joined</p>}
      </div>

      {loading && <p className="mt-6 rounded-2xl bg-emerald-50 p-4 font-bold" role="status">Loading today&apos;s leaderboard…</p>}
      {!loading && error && <div className="mt-6 rounded-2xl bg-red-50 p-4 text-red-900" role="alert"><p className="font-bold">{error}</p><button className="mt-3 rounded-xl bg-red-900 px-4 py-2 font-black text-white" onClick={onRetry} type="button">Try Again</button></div>}
      {!loading && !error && snapshot && entries.length === 0 && <p className="mt-6 rounded-2xl bg-emerald-50 p-5 text-center font-black">Be the first to finish today&apos;s puzzle.</p>}
      {!loading && !error && entries.length > 0 && <>
        <div className="mt-5 overflow-hidden rounded-2xl border border-emerald-950/10">
          <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_4.25rem_3.5rem] gap-2 bg-emerald-950 px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-white sm:grid-cols-[3.5rem_minmax(0,1fr)_5.5rem_4.5rem] sm:px-4">
            <span>Rank</span><span>Name</span><span className="text-right">Time</span><span className="text-right">Hints</span>
          </div>
          <ol>
            {entries.map((entry) => <li className={`grid grid-cols-[2.75rem_minmax(0,1fr)_4.25rem_3.5rem] gap-2 border-t border-emerald-950/10 px-3 py-3 text-sm first:border-t-0 sm:grid-cols-[3.5rem_minmax(0,1fr)_5.5rem_4.5rem] sm:px-4 ${entry.isYou ? "bg-amber-100" : "bg-[#fffdf5]"}`} key={`${entry.rank}-${entry.displayName}`}>
              <strong>#{entry.rank}</strong>
              <span className="truncate font-bold" title={entry.displayName}>{entry.displayName}{entry.isYou ? " (you)" : ""}</span>
              <span className="text-right font-mono font-bold">{formatResultTime(entry.durationSeconds)}</span>
              <span className="text-right font-bold">{entry.hintsUsed}</span>
            </li>)}
          </ol>
        </div>
        {!expanded && snapshot && snapshot.joinedCount > 10 && <button className="mt-4 w-full rounded-xl border border-emerald-950/20 bg-white px-4 py-3 font-black" onClick={onExpand} type="button">Show Top 20</button>}
      </>}
    </section>
  );
}

export function LeaderboardJoin({
  displayName,
  error,
  joined,
  joining,
  onChange,
  onStart,
  onSubmit,
  ownRank,
  sessionReady,
  started,
}: JoinProps) {
  if (joined && ownRank) {
    return <div className="mt-6 rounded-2xl bg-amber-100 p-5 text-center" role="status"><p className="text-xl font-black">You ranked #{ownRank} today</p><p className="mt-1 text-sm">Your anonymous score is on today&apos;s leaderboard.</p></div>;
  }
  if (!started) {
    return <button className="mt-6 w-full rounded-xl bg-amber-300 px-5 py-3 font-black text-emerald-950 disabled:cursor-not-allowed disabled:opacity-60" disabled={!sessionReady} onClick={onStart} type="button">Join today’s leaderboard</button>;
  }
  return (
    <form className="mt-6 rounded-2xl border border-emerald-950/15 bg-emerald-50 p-4" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
      <label className="block font-black" htmlFor="leaderboard-display-name">Anonymous nickname</label>
      <p className="mt-1 text-xs leading-5 text-[var(--ink-soft)]">2–16 letters, numbers, spaces, underscores, or hyphens.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          aria-describedby={error ? "leaderboard-name-error" : undefined}
          autoComplete="nickname"
          className="min-h-12 min-w-0 flex-1 rounded-xl border border-emerald-950/25 bg-white px-4 font-bold"
          id="leaderboard-display-name"
          maxLength={16}
          minLength={2}
          onChange={(event) => onChange(event.target.value)}
          required
          value={displayName}
        />
        <button className="min-h-12 rounded-xl bg-emerald-950 px-5 font-black text-white disabled:opacity-60" disabled={joining} type="submit">{joining ? "Joining…" : "Submit score"}</button>
      </div>
      {error && <p className="mt-3 text-sm font-bold text-red-800" id="leaderboard-name-error" role="alert">{error}</p>}
    </form>
  );
}
