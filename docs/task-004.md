# TASK-004 — Deterministic solver and unique-solution validation

## Goal

Solve valid Sudoku boards deterministically and distinguish invalid, unsolvable, unique-solution, and multiple-solution boards.

## Exclusions

- UI, D1 writes, hint copy, difficulty scoring, and advanced techniques.

## Acceptance

- A representative puzzle returns its expected unique solution.
- Conflicting and unsolvable boards are rejected.
- A board with multiple solutions is detected after finding two solutions.
- Input boards are not mutated.
