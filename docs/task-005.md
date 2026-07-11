# TASK-005 — Basic technique recognition

## Goal

Return deterministic structured steps for Naked Single, Hidden Single, and Locked Candidates without UI or prose generation.

## Acceptance

- Each technique has a representative unit test.
- Steps include target cells, related cells, and candidate.
- Identical boards return identical first steps.
- No available basic step returns `null`.
