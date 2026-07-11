import { assertBoard, withCell } from "./board";
import type { Board, CellValue } from "./board";
import { candidatesFor } from "./candidates";
import { isCompleteValidBoard, isValidPartialBoard } from "./validator";

export type SolveResult =
  | { status: "invalid"; solution: null; solutionCount: 0 }
  | { status: "no_solution"; solution: null; solutionCount: 0 }
  | { status: "unique"; solution: Board; solutionCount: 1 }
  | { status: "multiple"; solution: Board; solutionCount: 2 };

type SearchState = {
  firstSolution: Board | null;
  solutionCount: number;
};

function nextCell(board: Board): { candidates: readonly CellValue[]; index: number } | null {
  let best: { candidates: readonly CellValue[]; index: number } | null = null;
  for (let index = 0; index < board.length; index += 1) {
    if (board[index] !== 0) continue;
    const candidates = candidatesFor(board, index);
    if (candidates.length === 0) return { candidates, index };
    if (!best || candidates.length < best.candidates.length) {
      best = { candidates, index };
      if (candidates.length === 1) break;
    }
  }
  return best;
}

function search(board: Board, state: SearchState): void {
  if (state.solutionCount >= 2) return;
  const cell = nextCell(board);
  if (!cell) {
    if (isCompleteValidBoard(board)) {
      state.solutionCount += 1;
      state.firstSolution ??= board;
    }
    return;
  }
  for (const candidate of cell.candidates) {
    search(withCell(board, cell.index, candidate), state);
    if (state.solutionCount >= 2) return;
  }
}

export function solveBoard(board: Board): SolveResult {
  assertBoard(board);
  if (!isValidPartialBoard(board)) return { status: "invalid", solution: null, solutionCount: 0 };
  const state: SearchState = { firstSolution: null, solutionCount: 0 };
  search(board, state);
  if (!state.firstSolution) return { status: "no_solution", solution: null, solutionCount: 0 };
  if (state.solutionCount > 1) return { status: "multiple", solution: state.firstSolution, solutionCount: 2 };
  return { status: "unique", solution: state.firstSolution, solutionCount: 1 };
}
