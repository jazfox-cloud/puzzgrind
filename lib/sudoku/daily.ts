import type { D1DatabaseLike } from "@/lib/db";
import { nextUtcMidnight } from "@/lib/daily/utc";
import { parseBoard } from "./board";

export { nextUtcMidnight, utcDate } from "@/lib/daily/utc";

type DailyPuzzleRow = {
  difficulty: string;
  givens: string;
  id: string;
  puzzle_date: string;
};

export type PublicDailyPuzzle = {
  boardSize: 9;
  difficulty: "medium";
  expiresAt: string;
  givens: string;
  puzzleDate: string;
  puzzleId: string;
};

async function readExactPuzzle(db: D1DatabaseLike, date: string): Promise<DailyPuzzleRow | null> {
  return db
    .prepare(`
      SELECT id, puzzle_date, difficulty, givens
      FROM sudoku_puzzles
      WHERE puzzle_date = ? AND difficulty = 'medium' AND status = 'published'
      LIMIT 1
    `)
    .bind(date)
    .first<DailyPuzzleRow>();
}

async function readLatestPublishedPuzzle(db: D1DatabaseLike): Promise<DailyPuzzleRow | null> {
  return db
    .prepare(`
      SELECT id, puzzle_date, difficulty, givens
      FROM sudoku_puzzles
      WHERE difficulty = 'medium' AND status = 'published'
      ORDER BY puzzle_date DESC
      LIMIT 1
    `)
    .first<DailyPuzzleRow>();
}

export async function readDailyPuzzle(
  db: D1DatabaseLike,
  date: string,
  options: { allowLatestPublished?: boolean } = {},
): Promise<PublicDailyPuzzle | null> {
  const exact = await readExactPuzzle(db, date);
  const row = exact ?? (options.allowLatestPublished ? await readLatestPublishedPuzzle(db) : null);
  if (!row || row.difficulty !== "medium") return null;
  parseBoard(row.givens);
  return {
    puzzleId: row.id,
    puzzleDate: exact ? row.puzzle_date : date,
    difficulty: "medium",
    givens: row.givens,
    expiresAt: nextUtcMidnight(date),
    boardSize: 9,
  };
}
