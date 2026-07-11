import { BOARD_SIZE, BOX_SIZE, assertBoard, boxOf, columnOf, rowOf } from "./board";
import type { Board } from "./board";

export type ConflictKind = "box" | "column" | "row";
export type BoardConflict = {
  cells: readonly number[];
  kind: ConflictKind;
  value: number;
};

export type GivenViolation = {
  actual: number;
  expected: number;
  index: number;
};

function duplicateConflicts(cells: readonly number[], board: Board, kind: ConflictKind): BoardConflict[] {
  const positions = new Map<number, number[]>();
  for (const index of cells) {
    const value = board[index];
    if (value === 0) continue;
    const indexes = positions.get(value) ?? [];
    indexes.push(index);
    positions.set(value, indexes);
  }
  return [...positions.entries()]
    .filter(([, indexes]) => indexes.length > 1)
    .map(([value, indexes]) => ({ cells: Object.freeze(indexes), kind, value }));
}

export function findConflicts(board: Board): BoardConflict[] {
  assertBoard(board);
  const conflicts: BoardConflict[] = [];
  for (let unit = 0; unit < BOARD_SIZE; unit += 1) {
    const row = Array.from({ length: BOARD_SIZE }, (_, column) => unit * BOARD_SIZE + column);
    const column = Array.from({ length: BOARD_SIZE }, (_, rowIndex) => rowIndex * BOARD_SIZE + unit);
    const boxRow = Math.floor(unit / BOX_SIZE) * BOX_SIZE;
    const boxColumn = (unit % BOX_SIZE) * BOX_SIZE;
    const box = Array.from({ length: BOARD_SIZE }, (_, offset) =>
      (boxRow + Math.floor(offset / BOX_SIZE)) * BOARD_SIZE + boxColumn + (offset % BOX_SIZE),
    );
    conflicts.push(...duplicateConflicts(row, board, "row"));
    conflicts.push(...duplicateConflicts(column, board, "column"));
    conflicts.push(...duplicateConflicts(box, board, "box"));
  }
  return conflicts;
}

export function findGivenViolations(givens: Board, board: Board): GivenViolation[] {
  assertBoard(givens);
  assertBoard(board);
  return givens.flatMap((expected, index) =>
    expected !== 0 && board[index] !== expected ? [{ actual: board[index], expected, index }] : [],
  );
}

export function isValidPartialBoard(board: Board): boolean {
  return findConflicts(board).length === 0;
}

export function isCompleteValidBoard(board: Board): boolean {
  assertBoard(board);
  return !board.includes(0) && isValidPartialBoard(board);
}

export function peersOf(index: number): readonly number[] {
  const row = rowOf(index);
  const column = columnOf(index);
  const box = boxOf(index);
  return Object.freeze(
    Array.from({ length: 81 }, (_, cell) => cell).filter(
      (cell) => cell !== index && (rowOf(cell) === row || columnOf(cell) === column || boxOf(cell) === box),
    ),
  );
}
