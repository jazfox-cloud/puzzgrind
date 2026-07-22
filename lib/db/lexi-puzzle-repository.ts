import type { D1DatabaseLike } from "./d1";
import { toDatabaseError } from "./errors";
import { mapLexiPuzzleRow } from "./lexi-row-mappers";
import type { LexiPuzzleRow } from "./lexi-row-mappers";
import type { LexiPuzzle } from "./lexi-types";

const columns = `id, puzzle_date, answer, word_length, max_attempts, status,
  source_reference, validation_version, published_at, created_at, updated_at`;

export class LexiPuzzleRepository {
  constructor(private readonly db: D1DatabaseLike) {}

  async findPublishedByDate(date: string): Promise<LexiPuzzle | null> {
    try {
      const row = await this.db.prepare(`SELECT ${columns} FROM lexi_puzzles
        WHERE puzzle_date = ? AND status = 'published' LIMIT 1`).bind(date).first<LexiPuzzleRow>();
      return row ? mapLexiPuzzleRow(row) : null;
    } catch (error) { throw toDatabaseError(error, "Reading today's Lexi puzzle"); }
  }

  async findById(id: string): Promise<LexiPuzzle | null> {
    try {
      const row = await this.db.prepare(`SELECT ${columns} FROM lexi_puzzles WHERE id = ? LIMIT 1`)
        .bind(id).first<LexiPuzzleRow>();
      return row ? mapLexiPuzzleRow(row) : null;
    } catch (error) { throw toDatabaseError(error, "Reading a Lexi puzzle"); }
  }
}
