import type { D1DatabaseLike } from "./d1";
import { toDatabaseError } from "./errors";
import { mapPuzzleRow } from "./row-mappers";
import type { PuzzleRow } from "./row-mappers";
import type { NewSudokuPuzzle, SudokuPuzzle } from "./sudoku-types";

const puzzleColumns = `
  id, puzzle_date, difficulty, givens, solution, technique_profile_json,
  source_type, source_reference, validation_version, status, published_at,
  created_at, updated_at
`;

export class SudokuPuzzleRepository {
  constructor(private readonly db: D1DatabaseLike) {}

  async create(puzzle: NewSudokuPuzzle, now: number): Promise<void> {
    try {
      await this.db
        .prepare(`
          INSERT INTO sudoku_puzzles (
            id, puzzle_date, difficulty, givens, solution, technique_profile_json,
            source_type, source_reference, validation_version, status, published_at,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          puzzle.id,
          puzzle.puzzleDate,
          puzzle.difficulty,
          puzzle.givens,
          puzzle.solution,
          puzzle.techniqueProfile ? JSON.stringify(puzzle.techniqueProfile) : null,
          puzzle.sourceType,
          puzzle.sourceReference,
          puzzle.validationVersion,
          puzzle.status,
          puzzle.publishedAt,
          now,
          now,
        )
        .run();
    } catch (error) {
      throw toDatabaseError(error, "Creating a Sudoku puzzle");
    }
  }

  async findById(id: string): Promise<SudokuPuzzle | null> {
    try {
      const row = await this.db
        .prepare(`SELECT ${puzzleColumns} FROM sudoku_puzzles WHERE id = ? LIMIT 1`)
        .bind(id)
        .first<PuzzleRow>();

      return row ? mapPuzzleRow(row) : null;
    } catch (error) {
      throw toDatabaseError(error, "Reading a Sudoku puzzle");
    }
  }

  async findByDate(puzzleDate: string): Promise<SudokuPuzzle | null> {
    try {
      const row = await this.db
        .prepare(`
          SELECT ${puzzleColumns}
          FROM sudoku_puzzles
          WHERE puzzle_date = ? AND difficulty = ?
          LIMIT 1
        `)
        .bind(puzzleDate, "medium")
        .first<PuzzleRow>();

      return row ? mapPuzzleRow(row) : null;
    } catch (error) {
      throw toDatabaseError(error, "Reading a dated Sudoku puzzle");
    }
  }
}
