# TASK-010 — Server save, completion validation, and statistics

## Goal

Persist progress and accept a completion only after signed-session and server-side solution validation.

## Acceptance

- Session tokens are HMAC signed, expire, and bind session, puzzle, anonymous ID, and nonce.
- Save validates givens and board shape before writing parameterized JSON.
- Complete ignores client win claims and compares the submitted board with the server-only unique solution.
- Completed sessions cannot be submitted again.
- Session completion and aggregate statistics update together.
- Public responses never include the solution.
