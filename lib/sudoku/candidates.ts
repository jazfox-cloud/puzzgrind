import { assertBoard } from "./board";
import type { Board, CellValue } from "./board";
import { peersOf } from "./validator";

export function candidatesFor(board: Board, index: number): readonly CellValue[] {
  assertBoard(board);
  if (board[index] !== 0) return Object.freeze([]);
  const used = new Set<number>(peersOf(index).map((peer) => board[peer]).filter((value) => value !== 0));
  return Object.freeze(
    Array.from({ length: 9 }, (_, offset) => (offset + 1) as CellValue).filter((value) => !used.has(value)),
  );
}
