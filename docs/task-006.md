# TASK-006 — Daily Sudoku and anonymous session APIs

## Goal

Return the UTC Daily Sudoku without its solution and create or restore an anonymous session.

## Endpoints

- `GET /api/sudoku/today`
- `POST /api/sudoku/session/start`

## Acceptance

- The server chooses the UTC date.
- The public response never includes `solution` or internal technique data.
- Missing daily puzzles return a stable 404 response.
- Starting twice with the same anonymous ID restores the existing session.
- Anonymous IDs are validated and never placed in URLs.
