# PuzzGrind

PuzzGrind is a puzzle platform beginning with an explainable Daily Sudoku. Phase 0 is intentionally a single-game validation project.

## Local development

Requirements: Node 22.22.0 and pnpm 11.7.0.

```bash
pnpm install
pnpm dev
```

## Quality checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm preview
```

The Cloudflare production bundle is generated in `.open-next/`.

## Scope

Read [the Phase 0 constraints](docs/puzzgrind-phase-0-sudoku-spec.md) and the active task file before making changes. Do not advance to a later task without explicit approval.
