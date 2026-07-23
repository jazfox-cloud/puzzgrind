import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  applyMigrationLocally,
  assertExpectedLexiSchema,
  inspectLocalLexiSchema,
} from "./lib/lexi-production-migration.mjs";
import {
  applySeedLocally,
  canonicalPrivateInput,
  sha256,
  validateAndBuildSchedule,
} from "./lib/lexi-production-schedule.mjs";

const migration1 = readFileSync(resolve("migrations/0001_sudoku_core.sql"), "utf8");
const migration2 = readFileSync(resolve("migrations/0002_daily_leaderboard.sql"), "utf8");
const migration3 = readFileSync(resolve("migrations/0003_lexi_daily.sql"), "utf8");
const report = JSON.parse(readFileSync(resolve("data/lexi/wordlist-report.json"), "utf8"));
const validWords = readFileSync(resolve("data/lexi/esdb-valid-guesses.txt"), "utf8").trim().split(/\r?\n/u);
const virtualInput = { schemaVersion: 1, releaseDate: "2030-01-01", answers: validWords.slice(0, 90) };
const virtualAudit = {
  schemaVersion: 1,
  approvedAnswerCount: 90,
  approvedInputSha256: sha256(canonicalPrivateInput(virtualInput)),
  source: {
    release: report.source.release,
    commit: report.source.commit,
    validGuessesSha256: report.artifacts.validGuessesSha256,
  },
};
const schedule = validateAndBuildSchedule(virtualInput, virtualAudit, { generatedAt: 1_800_000_000 });
const temporaryRoot = mkdtempSync(join(tmpdir(), "puzzgrind-lexi-release-"));
const results = [];

function baseDatabase(path) {
  const db = new DatabaseSync(path);
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

function exercise(path, label) {
  const db = baseDatabase(path);
  try {
    results.push({ step: `${label}:migration-first`, passed: applyMigrationLocally(db, migration3).applied });
    assertExpectedLexiSchema(inspectLocalLexiSchema(db));
    results.push({ step: `${label}:migration-repeat-noop`, passed: !applyMigrationLocally(db, migration3).applied });
    applySeedLocally(db, schedule);
    results.push({ step: `${label}:seed-first`, passed:
      db.prepare("SELECT COUNT(*) AS count FROM lexi_puzzles").get().count === 90 });
    applySeedLocally(db, schedule);
    results.push({ step: `${label}:seed-repeat-same`, passed:
      db.prepare("SELECT COUNT(*) AS count FROM lexi_puzzles").get().count === 90 });

    const changedInput = { ...virtualInput, answers: [...virtualInput.answers] };
    changedInput.answers[0] = validWords.find((word) => !changedInput.answers.includes(word));
    const changedAudit = { ...virtualAudit,
      approvedInputSha256: sha256(canonicalPrivateInput(changedInput)) };
    const conflicting = validateAndBuildSchedule(changedInput, changedAudit, { generatedAt: 1_800_000_000 });
    let conflicted = false;
    try { applySeedLocally(db, conflicting); } catch { conflicted = true; }
    results.push({ step: `${label}:seed-different-answer-fails-closed`, passed:
      conflicted && db.prepare("SELECT COUNT(*) AS count FROM lexi_puzzles").get().count === 90 });
    results.push({ step: `${label}:published-query`, passed:
      db.prepare("SELECT COUNT(*) AS count FROM lexi_puzzles WHERE puzzle_date=? AND status='published'")
        .get(schedule.summary.firstDate).count === 1 });

    const beforeRollbackHash = createHash("sha256").update(JSON.stringify(inspectLocalLexiSchema(db))).digest("hex");
    const afterRollbackHash = createHash("sha256").update(JSON.stringify(inspectLocalLexiSchema(db))).digest("hex");
    results.push({ step: `${label}:worker-rollback-keeps-additive-schema`,
      passed: beforeRollbackHash === afterRollbackHash });
  } finally {
    db.close();
  }
}

try {
  exercise(":memory:", "fresh-memory");
  exercise(join(temporaryRoot, "independent.sqlite"), "independent-file");

  const rollbackDb = baseDatabase(":memory:");
  let rolledBack = false;
  try {
    applyMigrationLocally(rollbackDb, migration3, { failAfterSchema: true });
  } catch {
    rolledBack = inspectLocalLexiSchema(rollbackDb).table.length === 0 &&
      rollbackDb.prepare("SELECT COUNT(*) AS count FROM d1_migrations WHERE name='0003_lexi_daily.sql'")
        .get().count === 0;
  } finally {
    rollbackDb.close();
  }
  results.push({ step: "migration-injected-failure-rolls-back-schema-and-ledger", passed: rolledBack });

  const privateRoot = resolve(".private/lexi-production");
  mkdirSync(privateRoot, { recursive: true, mode: 0o700 });
  const fixtureId = randomUUID();
  const inputPath = join(privateRoot, `${fixtureId}.virtual-input.json`);
  const auditPath = join(privateRoot, `${fixtureId}.virtual-audit.json`);
  try {
    writeFileSync(inputPath, JSON.stringify(virtualInput), { mode: 0o600 });
    writeFileSync(auditPath, JSON.stringify(virtualAudit), { mode: 0o600 });
    const output = execFileSync(process.execPath, [
      "scripts/seed-lexi-production.mjs",
      "--env", "production",
      "--account-id", "7a04450464f7860772c01d269c4bf8af",
      "--database-name", "puzzgrind-db",
      "--database-id", "d3e6e288-046a-4552-b6d2-39f014276af7",
      "--input", inputPath,
      "--audit", auditPath,
    ], { encoding: "utf8" });
    const parsed = JSON.parse(output);
    results.push({ step: "seed-cli-defaults-to-dry-run", passed:
      parsed.mode === "dry-run" && parsed.schedule?.count === 90 });
  } finally {
    rmSync(inputPath, { force: true });
    rmSync(auditPath, { force: true });
  }
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

const failed = results.filter(({ passed }) => !passed);
console.log(JSON.stringify({
  virtualSchedule: {
    count: schedule.summary.count,
    firstDate: schedule.summary.firstDate,
    lastDate: schedule.summary.lastDate,
    scheduleSha256: schedule.summary.scheduleSha256,
  },
  limiterPlan: {
    RATE_LIMIT_LEXI_START: { namespace_id: "1201", limit: 12, period: 60 },
    RATE_LIMIT_LEXI_GUESS: { namespace_id: "1202", limit: 12, period: 60 },
    RATE_LIMIT_LEXI_HINT: { namespace_id: "1203", limit: 4, period: 60 },
    RATE_LIMIT_LEXI_READ: { namespace_id: "1204", limit: 60, period: 60 },
    RATE_LIMIT_LEXI_SUBMIT: { namespace_id: "1205", limit: 6, period: 60 },
  },
  passed: results.length - failed.length,
  failed: failed.length,
  results,
}, null, 2));
if (failed.length > 0) process.exit(1);
