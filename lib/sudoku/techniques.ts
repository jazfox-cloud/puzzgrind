import type { Board, CellValue } from "./board";
import { BOARD_SIZE, boxOf, columnOf, rowOf } from "./board";
import { candidatesFor } from "./candidates";

export type Technique = "hidden_single" | "locked_candidates" | "naked_single";
export type TechniqueStep = {
  candidate: CellValue;
  relatedCells: readonly number[];
  targetCells: readonly number[];
  technique: Technique;
};

function units(): number[][] {
  const result: number[][] = [];
  for (let unit = 0; unit < 9; unit += 1) {
    result.push(Array.from({ length: 9 }, (_, column) => unit * 9 + column));
    result.push(Array.from({ length: 9 }, (_, row) => row * 9 + unit));
    const top = Math.floor(unit / 3) * 3;
    const left = (unit % 3) * 3;
    result.push(Array.from({ length: 9 }, (_, offset) => (top + Math.floor(offset / 3)) * 9 + left + (offset % 3)));
  }
  return result;
}

export function findNakedSingle(board: Board): TechniqueStep | null {
  for (let index = 0; index < board.length; index += 1) {
    const candidates = candidatesFor(board, index);
    if (candidates.length === 1) {
      return { technique: "naked_single", targetCells: [index], relatedCells: [], candidate: candidates[0] };
    }
  }
  return null;
}

export function findHiddenSingle(board: Board): TechniqueStep | null {
  for (const unit of units()) {
    for (let value = 1; value <= BOARD_SIZE; value += 1) {
      const targets = unit.filter((index) => board[index] === 0 && candidatesFor(board, index).includes(value as CellValue));
      if (targets.length === 1) {
        return { technique: "hidden_single", targetCells: targets, relatedCells: unit.filter((i) => i !== targets[0]), candidate: value as CellValue };
      }
    }
  }
  return null;
}

export function findLockedCandidates(board: Board): TechniqueStep | null {
  for (let box = 0; box < 9; box += 1) {
    for (let value = 1; value <= 9; value += 1) {
      const cells = Array.from({ length: 81 }, (_, index) => index).filter(
        (index) => boxOf(index) === box && board[index] === 0 && candidatesFor(board, index).includes(value as CellValue),
      );
      if (cells.length < 2) continue;
      const sameRow = cells.every((index) => rowOf(index) === rowOf(cells[0]));
      const sameColumn = cells.every((index) => columnOf(index) === columnOf(cells[0]));
      const targets = Array.from({ length: 81 }, (_, index) => index).filter((index) =>
        board[index] === 0 && boxOf(index) !== box && candidatesFor(board, index).includes(value as CellValue) &&
        ((sameRow && rowOf(index) === rowOf(cells[0])) || (sameColumn && columnOf(index) === columnOf(cells[0]))),
      );
      if (targets.length > 0) return { technique: "locked_candidates", targetCells: targets, relatedCells: cells, candidate: value as CellValue };
    }
  }
  return null;
}

export function findNextBasicStep(board: Board): TechniqueStep | null {
  return findNakedSingle(board) ?? findHiddenSingle(board) ?? findLockedCandidates(board);
}
