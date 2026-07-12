export type SudokuNotes = number[][];

export function isValidSudokuNotes(value: unknown): value is SudokuNotes {
  return Array.isArray(value) && value.length === 81 && value.every((cell) => {
    if (!Array.isArray(cell) || cell.length > 9) return false;
    if (!cell.every((candidate) => Number.isInteger(candidate) && candidate >= 1 && candidate <= 9)) return false;
    return new Set(cell).size === cell.length;
  });
}
