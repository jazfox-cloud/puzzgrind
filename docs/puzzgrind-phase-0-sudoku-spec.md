# PuzzGrind Phase 0 — Sudoku execution constraints

Status: completed / historical (Phase 0 production baseline)

The restrictions in this document governed the Daily Sudoku cold-start period. In particular, the
temporary prohibition on multiple games does not apply to the approved Phase 1 Lexi Daily work.
Sudoku URLs, data, SEO, and production behavior remain protected by these historical constraints.

Domain: `https://puzzgrind.com`

First product: Explainable Daily Sudoku

## Product thesis

Phase 0 validates one product: a Medium Daily Sudoku that explains the logic behind each hint. It does not build a generalized game platform.

The north-star metric is Daily Completed Sudoku Puzzles. The primary differentiation test is whether explainable hints improve completion and return behavior.

## Locked technical direction

- Next.js App Router, React and TypeScript strict.
- Tailwind CSS and pnpm.
- OpenNext Cloudflare adapter, Cloudflare Workers and D1.
- Vitest and Playwright.
- GitHub-backed production deployment.
- LocalStorage and anonymous UUID identity.
- Deterministic Sudoku solver; no real-time model calls.

## Phase 0 boundaries

Allowed:

- One 9x9 Medium Daily Sudoku, selected by UTC date.
- Notes, erase, undo/redo, timer, pause and conflict feedback.
- Local save and anonymous sessions.
- Deterministic, three-level explainable hints.
- Archive, solver tool and a small set of reviewed technique pages.
- Analytics, error monitoring, SEO infrastructure and legal/consent pages.

Prohibited:

- Multiple games or difficulties.
- Monorepo, SDK, plugin loader or premature platform abstractions.
- Authentication, profiles, cloud saves or public leaderboards.
- Membership, payment, comments or social features.
- Real-time AI chat or model-generated Sudoku decisions.
- Large-scale programmatic SEO or unreviewed generated content.

## Delivery rule

Only one approved task may be executed at a time. Every task must state its goal, files, exclusions, acceptance criteria, tests and risks. Completion reports must list changed files, commands, results, unresolved issues and any out-of-scope changes.

The detailed source specification is `PuzzGrind_Phase_0_Sudoku_Execution_Spec_v1.0.md`, dated 2026-07-11. This repository document records the approved implementation constraints and any later scoped decisions.
