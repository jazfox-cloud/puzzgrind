export const BOARD_SIZE = 9;
export const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;
export const BOX_SIZE = 3;

export type CellValue = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type Board = readonly CellValue[];

export class InvalidBoardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidBoardError";
  }
}

export function parseBoard(value: string): Board {
  if (value.length !== CELL_COUNT) {
    throw new InvalidBoardError(`A Sudoku board must contain exactly ${CELL_COUNT} cells.`);
  }
  if (!/^[0-9]+$/.test(value)) {
    throw new InvalidBoardError("A Sudoku board may only contain digits from 0 to 9.");
  }
  return Object.freeze([...value].map((digit) => Number(digit) as CellValue));
}

export function serializeBoard(board: Board): string {
  assertBoard(board);
  return board.join("");
}

export function assertBoard(board: Board): void {
  if (board.length !== CELL_COUNT) {
    throw new InvalidBoardError(`A Sudoku board must contain exactly ${CELL_COUNT} cells.`);
  }
  if (board.some((cell) => !Number.isInteger(cell) || cell < 0 || cell > 9)) {
    throw new InvalidBoardError("Every Sudoku cell must be an integer from 0 to 9.");
  }
}

export function rowOf(index: number): number {
  assertCellIndex(index);
  return Math.floor(index / BOARD_SIZE);
}

export function columnOf(index: number): number {
  assertCellIndex(index);
  return index % BOARD_SIZE;
}

export function boxOf(index: number): number {
  const row = rowOf(index);
  const column = columnOf(index);
  return Math.floor(row / BOX_SIZE) * BOX_SIZE + Math.floor(column / BOX_SIZE);
}

export function withCell(board: Board, index: number, value: CellValue): Board {
  assertBoard(board);
  assertCellIndex(index);
  if (!Number.isInteger(value) || value < 0 || value > 9) {
    throw new InvalidBoardError("A Sudoku cell value must be an integer from 0 to 9.");
  }
  const next = [...board];
  next[index] = value;
  return Object.freeze(next);
}

function assertCellIndex(index: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= CELL_COUNT) {
    throw new InvalidBoardError(`Cell index must be between 0 and ${CELL_COUNT - 1}.`);
  }
}
