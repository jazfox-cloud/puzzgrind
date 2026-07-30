import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  SQL,
  assertNoAnonymousIds,
  assertReadOnlySql,
  buildReport,
  resolveWindow,
} from "../../../scripts/product-metrics/definitions.mjs";
import { render } from "../../../scripts/product-metrics/report-meaningful-starts.mjs";

type ReportObject = Record<string, unknown>;
type GameReport = Record<string, unknown> & { validation: Record<string, unknown> };

function object(value: unknown): ReportObject {
  return value as ReportObject;
}

function game(value: unknown): GameReport {
  return value as GameReport;
}

const fixture = JSON.parse(readFileSync("tests/product-metrics/meaningful-start-fixture.json", "utf8")) as {
  generated_at: string;
  sudoku: Record<string, unknown>;
  lexi: Record<string, unknown>;
};
const window = { start: "2026-07-12", end: "2026-07-29" };
const report = object(buildReport({ sudokuRow: fixture.sudoku, lexiRow: fixture.lexi, window, generatedAt: fixture.generated_at }));
const sudoku = game(report.sudoku);
const lexi = game(report.lexi);

describe("meaningful start product reporting", () => {
  it("excludes Lexi zero-guess sessions from meaningful starts", () => {
    expect(lexi.zero_guess_starts).toBe(13);
    expect(lexi.meaningful_starts).toBe(5);
    expect(lexi.validation.zero_guess_excluded_from_meaningful).toBe(true);
  });

  it("counts Lexi won/lost as terminal", () => {
    expect(lexi.won).toBe(2);
    expect(lexi.lost).toBe(2);
    expect(lexi.terminal_sessions).toBe(4);
  });

  it("counts Sudoku started sessions without progress separately", () => {
    expect(sudoku.no_progress_starts).toBe(4);
    expect(sudoku.created_starts).toBe(19);
  });

  it("counts Sudoku in_progress, paused, and won as meaningful starts", () => {
    expect(sudoku.meaningful_starts).toBe(15);
    expect(sudoku.in_progress_sessions).toBe(13);
    expect(sudoku.validation.created_equals_no_progress_plus_meaningful).toBe(true);
  });

  it("keeps created start and meaningful start rates separate", () => {
    expect(sudoku.created_start_to_win_rate).toBe(2 / 19);
    expect(sudoku.meaningful_start_to_win_rate).toBe(2 / 15);
    expect(lexi.created_start_to_terminal_rate).toBe(4 / 18);
    expect(lexi.meaningful_start_to_terminal_rate).toBe(4 / 5);
  });

  it("returns null rates when denominators are zero", () => {
    const empty = object(buildReport({ sudokuRow: {}, lexiRow: {}, window, generatedAt: fixture.generated_at }));
    expect(game(empty.sudoku).created_start_to_win_rate).toBeNull();
    expect(game(empty.lexi).meaningful_start_to_terminal_rate).toBeNull();
  });

  it("excludes current partial day and rejects invalid windows", () => {
    expect(resolveWindow({ start: "2026-07-23", end: "2026-07-29", now: new Date("2026-07-30T12:00:00Z") })).toEqual({ start: "2026-07-23", end: "2026-07-29" });
    expect(() => resolveWindow({ start: "2026-07-30", end: "2026-07-30", now: new Date("2026-07-30T12:00:00Z") })).toThrow("most recent complete UTC day");
    expect(() => resolveWindow({ start: "2026-07-29", end: "2026-07-28", now: new Date("2026-07-30T12:00:00Z") })).toThrow("on or before");
  });

  it("rejects write SQL", () => {
    for (const sql of Object.values(SQL)) expect(() => assertReadOnlySql(sql)).not.toThrow();
    expect(() => assertReadOnlySql("UPDATE sudoku_sessions SET status='won'")).toThrow("SELECT or WITH");
    expect(() => assertReadOnlySql("SELECT * FROM x; DROP TABLE x;")).toThrow("forbidden");
  });

  it("does not output anonymous IDs", () => {
    expect(() => assertNoAnonymousIds(report)).not.toThrow();
    expect(() => assertNoAnonymousIds({ anonymous_id: "123e4567-e89b-42d3-a456-426614174000" })).toThrow("anonymous ID");
  });

  it("renders consistent YAML and JSON schemas", () => {
    const json = JSON.parse(render(report, "json"));
    const yaml = render(report, "yaml");
    expect(Object.keys(json)).toEqual(["schema_version", "generated_at", "source", "database", "environment", "window", "current_partial_day_excluded", "definitions", "sample_gates", "sudoku", "lexi", "validation", "limitations"]);
    for (const key of Object.keys(json)) expect(yaml).toContain(`${key}:`);
  });

  it("fixture reproduces historical reference values through CLI", () => {
    const output = execFileSync(process.execPath, ["scripts/product-metrics/report-meaningful-starts.mjs", "--fixture", resolve("tests/product-metrics/meaningful-start-fixture.json"), "--start", "2026-07-12", "--end", "2026-07-29", "--format", "json"], { encoding: "utf8" });
    const parsed = JSON.parse(output);
    expect(parsed.sudoku).toMatchObject({ created_starts: 19, no_progress_starts: 4, meaningful_starts: 15, wins: 2 });
    expect(parsed.lexi).toMatchObject({ created_starts: 18, zero_guess_starts: 13, meaningful_starts: 5, terminal_sessions: 4 });
  });
});
