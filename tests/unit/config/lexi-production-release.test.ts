// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

import {
  applyMigrationLocally,
  assertMigrationHash,
  inspectLocalLexiSchema,
} from "@/scripts/lib/lexi-production-migration.mjs";
import {
  applySeedLocally,
  canonicalPrivateInput,
  sha256,
  validateAndBuildSchedule,
} from "@/scripts/lib/lexi-production-schedule.mjs";
import {
  assertProductionTarget,
  parseProductionArguments,
  PRODUCTION_ACCOUNT_ID,
  PRODUCTION_DATABASE_ID,
  PRODUCTION_DATABASE_NAME,
} from "@/scripts/lib/lexi-production-target.mjs";

const migration1 = readFileSync(resolve("migrations/0001_sudoku_core.sql"), "utf8");
const migration2 = readFileSync(resolve("migrations/0002_daily_leaderboard.sql"), "utf8");
const migration3 = readFileSync(resolve("migrations/0003_lexi_daily.sql"), "utf8");
const wordlist = readFileSync(resolve("data/lexi/esdb-valid-guesses.txt"), "utf8").trim().split(/\r?\n/u);
const report = JSON.parse(readFileSync(resolve("data/lexi/wordlist-report.json"), "utf8")) as {
  source: { release: string; commit: string };
  artifacts: { validGuessesSha256: string };
};
const virtualInput = () => ({ schemaVersion: 1, releaseDate: "2030-01-01", answers: wordlist.slice(0, 90) });
const auditFor = (input: ReturnType<typeof virtualInput>) => ({
  schemaVersion: 1,
  approvedAnswerCount: 90,
  approvedInputSha256: sha256(canonicalPrivateInput(input)),
  source: {
    release: report.source.release,
    commit: report.source.commit,
    validGuessesSha256: report.artifacts.validGuessesSha256,
  },
});

function baseDatabase() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  db.exec(`CREATE TABLE d1_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  db.exec(migration1);
  db.prepare("INSERT INTO d1_migrations(name) VALUES (?)").run("0001_sudoku_core.sql");
  db.exec(migration2);
  db.prepare("INSERT INTO d1_migrations(name) VALUES (?)").run("0002_daily_leaderboard.sql");
  return db;
}

describe("Production Lexi schedule and seed preparation", () => {
  it("builds one published day plus 89 scheduled consecutive UTC rows", () => {
    const input = virtualInput();
    const schedule = validateAndBuildSchedule(input, auditFor(input), { generatedAt: 123 });
    expect(schedule.summary).toMatchObject({ count: 90, firstDate: "2030-01-01", lastDate: "2030-03-31" });
    expect(schedule.rows[0]).toMatchObject({ status: "published", publishedAt: 1_893_456_000 });
    expect(schedule.rows.slice(1).every(({ status, publishedAt, createdAt, updatedAt }) =>
      status === "scheduled" && publishedAt === null && createdAt === 123 && updatedAt === 123)).toBe(true);
    expect(new Set(schedule.rows.map(({ puzzleDate }) => puzzleDate)).size).toBe(90);
    expect(new Set(schedule.rows.map(({ answer }) => answer)).size).toBe(90);
  });

  it("rejects wrong counts, duplicate/case/non-lexicon words, and audit tampering", () => {
    const short = virtualInput();
    short.answers.pop();
    expect(() => validateAndBuildSchedule(short, auditFor(short))).toThrow(/exactly 90/u);

    const duplicate = virtualInput();
    duplicate.answers[1] = duplicate.answers[0];
    expect(() => validateAndBuildSchedule(duplicate, auditFor(duplicate))).toThrow(/unique/u);

    const uppercase = virtualInput();
    uppercase.answers[0] = uppercase.answers[0].toUpperCase();
    expect(() => validateAndBuildSchedule(uppercase, auditFor(uppercase))).toThrow(/lowercase ASCII/u);

    const absent = virtualInput();
    absent.answers[0] = "zzzzz";
    expect(() => validateAndBuildSchedule(absent, auditFor(absent))).toThrow(/outside the valid ESDB/u);

    const tampered = virtualInput();
    const audit = auditFor(tampered);
    tampered.answers.reverse();
    expect(() => validateAndBuildSchedule(tampered, audit)).toThrow(/hash/u);
  });

  it("is atomic and idempotent, accepts same date/answer, and rejects a conflicting answer", () => {
    const db = baseDatabase();
    try {
      applyMigrationLocally(db, migration3);
      const input = virtualInput();
      const schedule = validateAndBuildSchedule(input, auditFor(input), { generatedAt: 123 });
      applySeedLocally(db, schedule);
      applySeedLocally(db, schedule);
      expect(db.prepare("SELECT COUNT(*) AS count FROM lexi_puzzles").get()).toMatchObject({ count: 90 });
      expect(db.prepare(`SELECT
        SUM(status='published') AS published,
        SUM(status='scheduled') AS scheduled,
        SUM(published_at IS NULL) AS unpublished
        FROM lexi_puzzles`).get()).toMatchObject({ published: 1, scheduled: 89, unpublished: 89 });

      const changed = virtualInput();
      changed.answers[0] = wordlist.find((word) => !changed.answers.includes(word))!;
      const conflict = validateAndBuildSchedule(changed, auditFor(changed), { generatedAt: 123 });
      expect(() => applySeedLocally(db, conflict)).toThrow();
      expect(db.prepare("SELECT COUNT(*) AS count FROM lexi_puzzles").get()).toMatchObject({ count: 90 });
      expect(db.prepare("SELECT answer FROM lexi_puzzles WHERE puzzle_date='2030-01-01'").get())
        .toMatchObject({ answer: input.answers[0] });
    } finally {
      db.close();
    }
  });
});

describe("trigger-safe Production migration", () => {
  it("pins the repository migration hash and records schema plus ledger atomically", () => {
    assertMigrationHash(migration3);
    const db = baseDatabase();
    try {
      expect(applyMigrationLocally(db, migration3)).toEqual({ applied: true });
      expect(applyMigrationLocally(db, migration3)).toEqual({ applied: false });
      expect(inspectLocalLexiSchema(db)).toMatchObject({
        table: expect.arrayContaining(["lexi_puzzles", "lexi_sessions"]),
        index: expect.arrayContaining(["idx_lexi_puzzles_status_date"]),
        trigger: expect.arrayContaining(["lexi_hint_applied"]),
      });
      expect(db.prepare("SELECT COUNT(*) AS count FROM d1_migrations WHERE name='0003_lexi_daily.sql'").get())
        .toMatchObject({ count: 1 });
    } finally {
      db.close();
    }
  });

  it("rolls schema and ledger back together on an injected failure", () => {
    const db = baseDatabase();
    try {
      expect(() => applyMigrationLocally(db, migration3, { failAfterSchema: true })).toThrow(/injected/u);
      expect(inspectLocalLexiSchema(db)).toEqual({ table: [], index: [], trigger: [] });
      expect(db.prepare("SELECT COUNT(*) AS count FROM d1_migrations WHERE name='0003_lexi_daily.sql'").get())
        .toMatchObject({ count: 0 });
    } finally {
      db.close();
    }
  });
});

describe("Production target guard", () => {
  const exact = [
    "--env", "production",
    "--account-id", PRODUCTION_ACCOUNT_ID,
    "--database-name", PRODUCTION_DATABASE_NAME,
    "--database-id", PRODUCTION_DATABASE_ID,
  ];

  it("accepts only the exact configured Production target and requires two write flags", () => {
    expect(assertProductionTarget(parseProductionArguments(exact))).toMatchObject({
      accountId: PRODUCTION_ACCOUNT_ID,
      databaseId: PRODUCTION_DATABASE_ID,
    });
    expect(() => assertProductionTarget(parseProductionArguments([...exact, "--execute"]),
      { requireExecution: true })).toThrow(/confirm-production/u);
    expect(assertProductionTarget(parseProductionArguments([...exact, "--execute", "--confirm-production"]),
      { requireExecution: true })).toBeTruthy();
  });

  it("rejects staging, preview/local aliases, and ambiguous database values", () => {
    expect(() => assertProductionTarget(parseProductionArguments(
      exact.map((value) => value === "production" ? "staging" : value)))).toThrow(/env production/u);
    expect(() => assertProductionTarget(parseProductionArguments(
      exact.map((value) => value === PRODUCTION_DATABASE_NAME ? "DB" : value)))).toThrow(/exact Production D1 name/u);
    expect(() => assertProductionTarget(parseProductionArguments(
      exact.map((value) => value === PRODUCTION_DATABASE_ID ? "d3f0b3d8-81a8-40de-96f4-7ed248e0fb93" : value))))
      .toThrow(/exact Production D1 ID/u);
  });
});
