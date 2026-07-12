# TASK-009 — Tiered explainable hints

## Goal

Return server-generated, deterministic Level 1–3 hints without revealing the complete solution or modifying the board.

## Acceptance

- Current board and givens are validated on the server.
- Level 1 identifies the technique and observation area.
- Level 2 explains the candidate logic.
- Level 3 gives the actionable cell/value or elimination.
- Hint events and maximum viewed level are recorded by the server.
- No response includes the puzzle solution.
