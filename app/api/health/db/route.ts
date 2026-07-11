import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

type HealthRow = {
  puzzle_count: number;
  table_count: number;
};

export async function GET() {
  try {
    const { env } = getCloudflareContext();
    const result = await env.DB.prepare(`
      SELECT
        (SELECT count(*) FROM sqlite_master
          WHERE type = 'table'
            AND name IN (
              'sudoku_puzzles',
              'sudoku_sessions',
              'sudoku_puzzle_stats',
              'sudoku_hint_events'
            )) AS table_count,
        (SELECT count(*) FROM sudoku_puzzles) AS puzzle_count
    `).first<HealthRow>();

    if (!result || result.table_count !== 4) {
      return NextResponse.json({ status: "error", database: "schema_incomplete" }, { status: 503 });
    }

    return NextResponse.json({
      status: "ok",
      database: "connected",
      schemaTables: result.table_count,
      puzzleCount: result.puzzle_count,
    });
  } catch {
    return NextResponse.json({ status: "error", database: "unavailable" }, { status: 503 });
  }
}
