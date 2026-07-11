import type { D1DatabaseLike } from "./d1";
import { toDatabaseError } from "./errors";
import { mapHintEventRow } from "./row-mappers";
import type { HintEventRow } from "./row-mappers";
import type { SudokuHintEvent } from "./sudoku-types";

export class SudokuHintEventRepository {
  constructor(private readonly db: D1DatabaseLike) {}

  async create(event: SudokuHintEvent): Promise<void> {
    try {
      await this.db
        .prepare(`
          INSERT INTO sudoku_hint_events (
            id, session_id, puzzle_id, technique, hint_level,
            target_cells_json, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          event.id,
          event.sessionId,
          event.puzzleId,
          event.technique,
          event.hintLevel,
          JSON.stringify(event.targetCells),
          event.createdAt,
        )
        .run();
    } catch (error) {
      throw toDatabaseError(error, "Creating a Sudoku hint event");
    }
  }

  async listBySessionId(sessionId: string): Promise<SudokuHintEvent[]> {
    try {
      const result = await this.db
        .prepare(`
          SELECT
            id, session_id, puzzle_id, technique, hint_level,
            target_cells_json, created_at
          FROM sudoku_hint_events
          WHERE session_id = ?
          ORDER BY created_at ASC, id ASC
        `)
        .bind(sessionId)
        .all<HintEventRow>();

      return result.results.map(mapHintEventRow);
    } catch (error) {
      throw toDatabaseError(error, "Reading Sudoku hint events");
    }
  }
}
