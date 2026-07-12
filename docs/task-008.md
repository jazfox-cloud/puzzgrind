# TASK-008 — Local recovery and anonymous identity

## Goal

Persist the active Daily Sudoku locally and restore it safely after refresh without accounts or fingerprinting.

## Acceptance

- Values, notes, timer, selection, pause, note mode, undo, and redo survive refresh.
- Saves are isolated by puzzle ID and schema version.
- Malformed saves and saves that alter givens are rejected.
- A UUID v4 anonymous ID is stored locally and never included in a URL.
- Visibility changes persist the latest state.
- Restart requires confirmation and clears only the current puzzle save.
