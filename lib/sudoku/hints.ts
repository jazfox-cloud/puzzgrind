import { boxOf, columnOf, rowOf } from "./board";
import type { TechniqueStep } from "./techniques";

export type HintLevel = 1 | 2 | 3;
export type SudokuHint = TechniqueStep & {
  explanation: string;
  level: HintLevel;
  title: string;
};

function cellName(index: number): string {
  return `R${rowOf(index) + 1}C${columnOf(index) + 1}`;
}

const techniqueNames = {
  naked_single: "Naked Single",
  hidden_single: "Hidden Single",
  locked_candidates: "Locked Candidates",
} as const;

function unitLabel(step: TechniqueStep): string {
  const cells = [...step.relatedCells, ...step.targetCells];
  if (cells.length > 0 && cells.every((cell) => rowOf(cell) === rowOf(cells[0]))) return `Row ${rowOf(cells[0]) + 1}`;
  if (cells.length > 0 && cells.every((cell) => columnOf(cell) === columnOf(cells[0]))) return `Column ${columnOf(cells[0]) + 1}`;
  if (cells.length > 0 && cells.every((cell) => boxOf(cell) === boxOf(cells[0]))) return `Box ${boxOf(cells[0]) + 1}`;
  return "the highlighted region";
}

function boxCells(index: number): number[] {
  return Array.from({ length: 81 }, (_, cell) => cell).filter((cell) => boxOf(cell) === boxOf(index));
}

export function hintHighlightCells(step: TechniqueStep, level: HintLevel): readonly number[] {
  if (level === 3) return step.targetCells;
  if (step.relatedCells.length > 0) return [...new Set([...step.relatedCells, ...step.targetCells])];
  return boxCells(step.targetCells[0]);
}

export function explainStep(step: TechniqueStep, level: HintLevel): SudokuHint {
  const techniqueName = techniqueNames[step.technique];
  let explanation: string;
  if (level === 1) {
    explanation = step.technique === "locked_candidates"
      ? "Look inside one 3×3 box for a candidate that is confined to a single row or column."
      : step.technique === "hidden_single"
        ? `Look at ${unitLabel(step)}. One number has only one possible position.`
        : `Look at Box ${boxOf(step.targetCells[0]) + 1}. One cell has only one possible candidate.`;
  } else if (level === 2) {
    explanation = step.technique === "naked_single"
      ? `${step.candidate} is a Naked Single. Every other candidate is blocked by its row, column, or box.`
      : step.technique === "hidden_single"
        ? `${step.candidate} is a Hidden Single in ${unitLabel(step)}. The other possible cells are blocked.`
        : `Candidate ${step.candidate} is confined to the highlighted cells, so it can be removed from the aligned cells outside that box.`;
  } else {
    explanation = step.technique === "locked_candidates"
      ? `Remove candidate ${step.candidate} from ${step.targetCells.map(cellName).join(", ")}.`
      : `Place ${step.candidate} in ${cellName(step.targetCells[0])}.`;
  }
  return { ...step, level, title: techniqueName, explanation };
}
