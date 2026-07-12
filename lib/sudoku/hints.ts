import type { TechniqueStep } from "./techniques";

export type HintLevel = 1 | 2 | 3;
export type SudokuHint = TechniqueStep & {
  explanation: string;
  level: HintLevel;
  title: string;
};

function cellName(index: number): string {
  return `row ${Math.floor(index / 9) + 1}, column ${(index % 9) + 1}`;
}

const techniqueNames = {
  naked_single: "Naked Single",
  hidden_single: "Hidden Single",
  locked_candidates: "Locked Candidates",
} as const;

export function explainStep(step: TechniqueStep, level: HintLevel): SudokuHint {
  const techniqueName = techniqueNames[step.technique];
  let explanation: string;
  if (level === 1) {
    explanation = step.technique === "locked_candidates"
      ? "Look inside one 3×3 box for a candidate that is confined to a single row or column."
      : `Look closely at ${cellName(step.targetCells[0])} and review its row, column, and box.`;
  } else if (level === 2) {
    explanation = step.technique === "naked_single"
      ? `Every candidate except ${step.candidate} is blocked by a number already present in the same row, column, or box.`
      : step.technique === "hidden_single"
        ? `Within this unit, ${step.candidate} has only one possible position after checking the other cells.`
        : `Candidate ${step.candidate} is confined to ${step.relatedCells.map(cellName).join(" and ")}, so it can be removed from the aligned cells outside that box.`;
  } else {
    explanation = step.technique === "locked_candidates"
      ? `Remove candidate ${step.candidate} from ${step.targetCells.map(cellName).join(", ")}.`
      : `Enter ${step.candidate} in ${cellName(step.targetCells[0])}.`;
  }
  return { ...step, level, title: techniqueName, explanation };
}
