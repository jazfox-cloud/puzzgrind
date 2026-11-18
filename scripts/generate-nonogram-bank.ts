import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { cluesFromSolution, countSolutions, solutionMatchesLineSolve } from "../lib/nonogram/logic";
import { NONOGRAM_SKETCHES } from "./nonogram-sketches";

type Size = 5 | 10;

function cellsFromPicture(picture: string[], size: Size) {
  if (picture.length !== size || picture.some((row) => row.length !== size || /[^.#]/u.test(row))) {
    throw new Error(`Sketch must be ${size} lines of ${size} dots and hashes`);
  }
  return picture.join("").split("").map((cell) => (cell === "#" ? 1 : 0));
}

export function checkedSketches(size: Size) {
  const sketches = NONOGRAM_SKETCHES[size];
  const ready: { name: string; solution: number[]; rows: number[][]; columns: number[][] }[] = [];
  for (const [name, picture] of Object.entries(sketches)) {
    const solution = cellsFromPicture(picture, size);
    const clues = cluesFromSolution(solution, size);
    const solvable = solutionMatchesLineSolve(solution, size);
    const solutions = solvable ? countSolutions(clues.rows, clues.columns, 2) : 0;
    if (!solvable || solutions !== 1) {
      console.log(`${size} ${name}: rejected (line ${solvable ? "ok" : "stuck"}, solutions ${solutions})`);
      continue;
    }
    ready.push({ name, solution, rows: clues.rows, columns: clues.columns });
  }
  return ready;
}

function emit(size: Size, puzzles: ReturnType<typeof checkedSketches>) {
  return puzzles.map((puzzle, index) => {
    const rows = Array.from({ length: size }, (_, row) => puzzle.solution.slice(row * size, row * size + size).join(""));
    const id = `nonogram-${size}x${size}-${String(index + 1).padStart(2, "0")}`;
    return `  picture("${id}", ${size}, ${JSON.stringify(rows)}, ${JSON.stringify(puzzle.rows)}, ${JSON.stringify(puzzle.columns)}),`;
  }).join("\n");
}

export function generateNonogramBank() {
  const five = checkedSketches(5);
  const ten = checkedSketches(10);
  if (five.length < 8 || ten.length < 8) throw new Error(`Not enough checked pictures (5×5 ${five.length}, 10×10 ${ten.length})`);
  const contents = `// Original PuzzGrind pictures. Each clue set was checked against its picture,
// proved to have one solution, and solved with line logic before it was stored.
// Regenerate with: GENERATE_NONOGRAM=1 pnpm exec vitest run tests/unit/nonogram/generate-bank.test.ts

export type NonogramSize = 5 | 10;

export type NonogramPuzzle = {
  id: string;
  size: NonogramSize;
  solution: number[];
  rows: number[][];
  columns: number[][];
};

function picture(id: string, size: NonogramSize, rows: string[], rowClues: number[][], columnClues: number[][]): NonogramPuzzle {
  const solution = rows.join("").split("").map((cell) => (cell === "1" ? 1 : 0));
  return { id, size, solution, rows: rowClues, columns: columnClues };
}

export const FIVE_BY_FIVE: NonogramPuzzle[] = [
${emit(5, five)}
];

export const TEN_BY_TEN: NonogramPuzzle[] = [
${emit(10, ten)}
];
`;
  writeFileSync(join(process.cwd(), "lib/nonogram/puzzles.ts"), contents);
  console.log(`Wrote ${five.length} 5×5 (${five.map((puzzle) => puzzle.name).join(", ")})`);
  console.log(`Wrote ${ten.length} 10×10 (${ten.map((puzzle) => puzzle.name).join(", ")})`);
}
