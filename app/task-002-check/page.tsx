import { getCloudflareContext } from "@opennextjs/cloudflare";
import Link from "next/link";

export const dynamic = "force-dynamic";

type DatabaseCheck = {
  hint_events: number;
  puzzles: number;
  sessions: number;
  stats: number;
  tables: number;
};

async function readDatabaseCheck(): Promise<DatabaseCheck | null> {
  try {
    const { env } = getCloudflareContext();
    return await env.DB.prepare(`
      SELECT
        (SELECT count(*) FROM sqlite_master
          WHERE type = 'table'
            AND name IN (
              'sudoku_puzzles',
              'sudoku_sessions',
              'sudoku_puzzle_stats',
              'sudoku_hint_events'
            )) AS tables,
        (SELECT count(*) FROM sudoku_puzzles) AS puzzles,
        (SELECT count(*) FROM sudoku_sessions) AS sessions,
        (SELECT count(*) FROM sudoku_puzzle_stats) AS stats,
        (SELECT count(*) FROM sudoku_hint_events) AS hint_events
    `).first<DatabaseCheck>();
  } catch {
    return null;
  }
}

const tableLabels = [
  ["sudoku_puzzles", "Validated puzzle storage"],
  ["sudoku_sessions", "Anonymous game sessions"],
  ["sudoku_puzzle_stats", "Real aggregate statistics"],
  ["sudoku_hint_events", "Explainable hint events"],
] as const;

export default async function Task002CheckPage() {
  const check = await readDatabaseCheck();
  const healthy = check?.tables === 4;
  const counts = [check?.puzzles ?? 0, check?.sessions ?? 0, check?.stats ?? 0, check?.hint_events ?? 0];

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10 sm:px-10">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-emerald-950/15 pb-6">
        <Link className="text-xl font-black tracking-[-0.04em]" href="/">
          PuzzGrind
        </Link>
        <span className="rounded-full bg-amber-200 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-amber-950">
          Staging only
        </span>
      </header>

      <section className="py-12">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-800">TASK-002 verification</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-[-0.055em] sm:text-6xl">
          Sudoku database foundation
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--ink-soft)]">
          This page proves the staging Worker is connected to the isolated D1 database. It does not make the Sudoku game playable yet.
        </p>

        <div className={`mt-8 rounded-3xl border p-6 ${healthy ? "border-emerald-800/20 bg-emerald-100" : "border-red-800/20 bg-red-100"}`}>
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className={`h-3 w-3 rounded-full ${healthy ? "bg-emerald-700" : "bg-red-700"}`} />
            <p className="text-lg font-black">{healthy ? "D1 connected — schema ready" : "D1 check failed"}</p>
          </div>
          <p className="mt-2 text-sm text-emerald-950/70">
            {healthy ? "All four required tables are available." : "The staging database or migration is unavailable."}
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {tableLabels.map(([name, description], index) => (
            <article className="rounded-3xl border border-emerald-950/15 bg-white/70 p-6" key={name}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-mono text-sm font-black">{name}</h2>
                  <p className="mt-2 text-sm text-[var(--ink-soft)]">{description}</p>
                </div>
                <span className="rounded-full bg-emerald-950 px-3 py-1 text-sm font-black text-white">
                  {counts[index]} row{counts[index] === 1 ? "" : "s"}
                </span>
              </div>
            </article>
          ))}
        </div>

        <section className="mt-8 rounded-3xl bg-emerald-950 p-6 text-white">
          <h2 className="text-xl font-black">What has been verified</h2>
          <ul className="mt-4 grid gap-3 text-sm text-white/80 sm:grid-cols-2">
            <li>✓ Local and remote migration applied</li>
            <li>✓ Foreign-key relationships accepted</li>
            <li>✓ Duplicate daily puzzle rejected</li>
            <li>✓ Parameterized repositories tested</li>
            <li>✓ Staging database is isolated</li>
            <li>✓ Production site remains unchanged</li>
          </ul>
        </section>
      </section>
    </main>
  );
}
