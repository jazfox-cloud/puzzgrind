# Meaningful Start Reporting

TASK-018 adds a read-only reporting layer for PuzzGrind product metrics. It separates Created Start, Meaningful Start, and Terminal Session for Sudoku and Lexi Daily.

Session provenance is fail closed. Migration `0004_session_provenance.sql` preserves all pre-migration rows as `source_environment = 'unknown'`; new session writes require the explicit runtime `APP_ENV`. Production reports include only rows explicitly marked `production`. Historical `unknown` rows remain available in D1 but are excluded from verified product KPI windows rather than being guessed into live traffic.

## Commands

Historical baseline window:

```bash
node scripts/product-metrics/report-meaningful-starts.mjs --start 2026-07-12 --end 2026-07-29 --format yaml
node scripts/product-metrics/report-meaningful-starts.mjs --start 2026-07-12 --end 2026-07-29 --format json
```

Most recent complete 7 UTC days are used when `--start` and `--end` are omitted. The current partial UTC day is always excluded. Use `--output <path>` to write a new file; the script refuses to overwrite an existing file.

## Definitions

Definitions are centralized in `scripts/product-metrics/definitions.mjs`.

Sudoku Created Start is a production `sudoku_sessions` row for a puzzle in the requested UTC date window.

Sudoku Meaningful Start is currently a proxy: status in `in_progress`, `paused`, or `won`. This depends on save/status updates. It is not necessarily the first board interaction. A future first meaningful board change field or event would improve this definition.

Sudoku Terminal Session is currently `won`. Long-running incomplete sessions are not marked as failures.

Lexi Created Start is a production `lexi_sessions` row for a puzzle in the requested UTC date window.

Lexi Meaningful Start is `attempt_count > 0`, equivalent to status in `in_progress`, `won`, or `lost` for current production data.

Lexi Terminal Session is status `won` or `lost`. Zero-guess `started` sessions are excluded from meaningful starts.

Returning users are counted only as aggregates: the same anonymous ID appearing on two or more different `puzzle_date` values in the requested window. The script never outputs anonymous IDs, session IDs, IPs, user agents, or user-level records.

## Read-only Limitations

Production queries use remote Cloudflare D1 database `puzzgrind-db` with `--env production`. SQL is guarded to allow only `SELECT`/`WITH` and to reject write or schema keywords such as `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, and `CREATE`. Production runs report `changed_db` from Wrangler metadata.

The first trustworthy comparison requires two adjacent complete observation windows entirely after the provenance migration. Until that cutover window exists, downstream systems must report the metric as `inconclusive`; a partial post-migration count is not a valid before/after comparison.

## Interpretation

Created Start measures session creation and entry into the game flow. It must not be used alone to judge game difficulty or abandonment. Meaningful Start is closer to actual engagement and should be the denominator for product completion analysis.

## Product Experiment Gate

Do not create a product experiment from this report alone. Initial Portfolio sample thresholds, not industry standards:

```yaml
lexi_minimum_meaningful_starts: 50
sudoku_minimum_meaningful_starts: 50
```
