/** Line clues, line logic, and an independent solution count for small Nonograms. */

export type LineClues = readonly number[];

const EMPTY_CLUE = [0] as const;

export function cluesForLine(line: readonly number[]): number[] {
  const clues: number[] = [];
  let run = 0;
  for (const cell of line) {
    if (cell !== 0 && cell !== 1) throw new Error("A Nonogram cell must be 0 or 1");
    if (cell === 1) run += 1;
    else if (run > 0) {
      clues.push(run);
      run = 0;
    }
  }
  if (run > 0) clues.push(run);
  return clues.length === 0 ? [...EMPTY_CLUE] : clues;
}

export function cluesFromSolution(solution: readonly number[], size: number): { rows: number[][]; columns: number[][] } {
  if (!Number.isInteger(size) || size < 1 || solution.length !== size * size) throw new Error("Solution size does not match the grid");
  const rows = Array.from({ length: size }, (_, row) => cluesForLine(solution.slice(row * size, row * size + size)));
  const columns = Array.from({ length: size }, (_, column) => cluesForLine(Array.from({ length: size }, (_, row) => solution[row * size + column] ?? 0)));
  return { rows, columns };
}

const patternCache = new Map<string, number[]>();

/** Bit 0 is the leftmost cell. Sizes above 10 are rejected so masks stay inside 32-bit operations. */
export function linePatterns(length: number, clues: LineClues): number[] {
  const cacheKey = `${length}:${clues.join(",")}`;
  const cached = patternCache.get(cacheKey);
  if (cached) return cached;
  if (!Number.isInteger(length) || length < 1 || length > 10) throw new Error("Line length must be from 1 to 10");
  const runs = clues.length === 1 && clues[0] === 0 ? [] : [...clues];
  if (runs.some((run) => !Number.isInteger(run) || run < 1)) throw new Error("Line clues must be positive runs, or 0 for an empty line");
  const span = runs.reduce((sum, run) => sum + run, 0) + Math.max(0, runs.length - 1);
  if (span > length) {
    patternCache.set(cacheKey, []);
    return [];
  }
  const found: number[] = [];
  const walk = (index: number, start: number, mask: number) => {
    if (index === runs.length) {
      found.push(mask);
      return;
    }
    const run = runs[index] ?? 0;
    let tail = runs.length - index - 1;
    for (let later = index + 1; later < runs.length; later += 1) tail += runs[later] ?? 0;
    for (let position = start; position <= length - run - tail; position += 1) {
      let next = mask;
      for (let offset = 0; offset < run; offset += 1) next |= 1 << (position + offset);
      walk(index + 1, position + run + 1, next);
    }
  };
  walk(0, 0, 0);
  patternCache.set(cacheKey, found);
  return found;
}

export type CellState = 0 | 1 | 2;

function matchesFixed(mask: number, fixed: readonly CellState[], length: number) {
  for (let index = 0; index < length; index += 1) {
    const bit = (mask >> index) & 1;
    const state = fixed[index];
    if (state === 1 && bit !== 1) return false;
    if (state === 2 && bit !== 0) return false;
    if (state !== 0 && state !== 1 && state !== 2) return false;
  }
  return true;
}

export function deduceLine(length: number, clues: LineClues, fixed: readonly CellState[]): { cells: CellState[]; contradiction: boolean } {
  const options = linePatterns(length, clues).filter((mask) => matchesFixed(mask, fixed, length));
  if (options.length === 0) return { cells: [...fixed], contradiction: true };
  const cells = [...fixed] as CellState[];
  for (let index = 0; index < length; index += 1) {
    if (cells[index] !== 0) continue;
    const bit = (options[0]! >> index) & 1;
    if (options.every((mask) => ((mask >> index) & 1) === bit)) cells[index] = bit === 1 ? 1 : 2;
  }
  return { cells, contradiction: false };
}

export type LineSolveResult = {
  status: "solved" | "incomplete" | "contradiction";
  cells: CellState[];
};

export function solveByLineLogic(rowClues: readonly LineClues[], columnClues: readonly LineClues[]): LineSolveResult {
  const size = rowClues.length;
  if (columnClues.length !== size || size < 1 || size > 10) throw new Error("Row and column clues must describe a 1 to 10 grid");
  const cells = new Uint8Array(size * size);
  for (let pass = 0; pass < size * size + 1; pass += 1) {
    let changed = false;
    for (let row = 0; row < size; row += 1) {
      const fixed = Array.from({ length: size }, (_, column) => cells[row * size + column] as CellState);
      const deduced = deduceLine(size, rowClues[row] ?? [], fixed);
      if (deduced.contradiction) return { status: "contradiction", cells: [...cells] as CellState[] };
      for (let column = 0; column < size; column += 1) {
        const value = deduced.cells[column] ?? 0;
        const index = row * size + column;
        if (cells[index] !== value) {
          cells[index] = value;
          changed = true;
        }
      }
    }
    for (let column = 0; column < size; column += 1) {
      const fixed = Array.from({ length: size }, (_, row) => cells[row * size + column] as CellState);
      const deduced = deduceLine(size, columnClues[column] ?? [], fixed);
      if (deduced.contradiction) return { status: "contradiction", cells: [...cells] as CellState[] };
      for (let row = 0; row < size; row += 1) {
        const value = deduced.cells[row] ?? 0;
        const index = row * size + column;
        if (cells[index] !== value) {
          cells[index] = value;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  const solved = [...cells].every((cell) => cell !== 0);
  return { status: solved ? "solved" : "incomplete", cells: [...cells] as CellState[] };
}

/**
 * Counts clue solutions by placing whole rows and pruning columns.
 * This does not use line-logic deductions, so it can reject a grid the line solver mishandles.
 * A budget keeps an ambiguous grid from running away; exceeding it returns the limit.
 */
export function countSolutions(rowClues: readonly LineClues[], columnClues: readonly LineClues[], limit = 2, budget = 250_000): number {
  const size = rowClues.length;
  if (columnClues.length !== size || limit < 1) throw new Error("Invalid solution count request");
  const rowOptions = rowClues.map((clue) => linePatterns(size, clue));
  const viable = columnClues.map((clue) => linePatterns(size, clue));
  if (rowOptions.some((options) => options.length === 0) || viable.some((options) => options.length === 0)) return 0;
  let visited = 0;
  const search = (row: number, columns: number[][]): number => {
    if (row === size) return 1;
    let total = 0;
    for (const mask of rowOptions[row] ?? []) {
      visited += 1;
      if (visited > budget) return limit;
      const next: number[][] = [];
      let possible = true;
      for (let column = 0; column < size; column += 1) {
        const bit = (mask >> column) & 1;
        const kept = (columns[column] ?? []).filter((pattern) => ((pattern >> row) & 1) === bit);
        if (kept.length === 0) {
          possible = false;
          break;
        }
        next.push(kept);
      }
      if (!possible) continue;
      total += search(row + 1, next);
      if (total >= limit) return total;
    }
    return total;
  };
  return search(0, viable);
}

export function solutionMatchesLineSolve(solution: readonly number[], size: number): boolean {
  const clues = cluesFromSolution(solution, size);
  const solved = solveByLineLogic(clues.rows, clues.columns);
  if (solved.status !== "solved") return false;
  return solution.every((bit, index) => solved.cells[index] === (bit === 1 ? 1 : 2));
}
