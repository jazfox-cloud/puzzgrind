# TASK-003 — Sudoku board model and validator

## Goal

Implement pure, deterministic 9×9 Sudoku board parsing and validation without UI, D1, solver, or hint behavior.

## Outputs

- Immutable board helpers.
- Row, column, and box conflict detection.
- Given-cell protection and completed-board validation.
- Representative unit tests.

## File scope

- `lib/sudoku/board.ts`
- `lib/sudoku/validator.ts`
- `lib/sudoku/index.ts`
- `tests/unit/sudoku/**`
- `docs/task-003.md`

## Acceptance

- Invalid length and characters are rejected.
- Row, column, and box conflicts are identified.
- Given cells cannot be changed.
- Complete valid boards pass and incomplete boards do not.
- Functions do not mutate input boards.
