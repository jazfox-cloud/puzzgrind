import { createHash } from "node:crypto";

export const LEXI_MIGRATION_NAME = "0003_lexi_daily.sql";
export const LEXI_MIGRATION_SHA256 = "bb8a604455e9f78fa237f8408faaafa59574e606a3b30262521cae2f855d6da8";
export const LEXI_TABLES = [
  "lexi_daily_leaderboard",
  "lexi_hint_events",
  "lexi_puzzle_stats",
  "lexi_puzzles",
  "lexi_sessions",
];
export const LEXI_INDEXES = [
  "idx_lexi_daily_leaderboard_date",
  "idx_lexi_daily_leaderboard_rank",
  "idx_lexi_hint_events_puzzle_created",
  "idx_lexi_puzzles_status_date",
  "idx_lexi_sessions_puzzle_status",
  "idx_lexi_sessions_updated_at",
];
export const LEXI_TRIGGERS = [
  "lexi_hint_applied",
  "lexi_leaderboard_name_immutable",
  "lexi_session_completed_stats",
  "lexi_session_started_stats",
];

export function migrationSha256(sql) {
  return createHash("sha256").update(sql).digest("hex");
}

export function assertMigrationHash(sql) {
  const actual = migrationSha256(sql);
  if (actual !== LEXI_MIGRATION_SHA256) {
    throw new Error(`0003 migration hash mismatch: expected ${LEXI_MIGRATION_SHA256}, received ${actual}`);
  }
}

export function expectedLexiObjectNames() {
  return {
    table: [...LEXI_TABLES].sort(),
    index: [...LEXI_INDEXES].sort(),
    trigger: [...LEXI_TRIGGERS].sort(),
  };
}

export function inspectLocalLexiSchema(db) {
  const rows = db.prepare(`SELECT type,name FROM sqlite_master
    WHERE name LIKE 'lexi_%' OR name LIKE 'idx_lexi_%'
    ORDER BY type,name`).all();
  const actual = { table: [], index: [], trigger: [] };
  for (const row of rows) {
    if (row.type in actual && !row.name.startsWith("sqlite_autoindex_")) actual[row.type].push(row.name);
  }
  return actual;
}

export function assertExpectedLexiSchema(actual) {
  const expected = expectedLexiObjectNames();
  for (const type of Object.keys(expected)) {
    if (JSON.stringify(actual[type]) !== JSON.stringify(expected[type])) {
      throw new Error(`Unexpected Lexi ${type} objects`);
    }
  }
}

export function applyMigrationLocally(db, migrationSql, { failAfterSchema = false } = {}) {
  assertMigrationHash(migrationSql);
  const ledger = db.prepare("SELECT name FROM d1_migrations ORDER BY id").all().map(({ name }) => name);
  if (!ledger.includes("0001_sudoku_core.sql") || !ledger.includes("0002_daily_leaderboard.sql")) {
    throw new Error("0001 and 0002 must be recorded before 0003");
  }
  if (ledger.includes(LEXI_MIGRATION_NAME)) {
    assertExpectedLexiSchema(inspectLocalLexiSchema(db));
    return { applied: false };
  }
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec(migrationSql);
    if (failAfterSchema) throw new Error("injected migration failure");
    db.prepare("INSERT INTO d1_migrations (name) VALUES (?)").run(LEXI_MIGRATION_NAME);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  assertExpectedLexiSchema(inspectLocalLexiSchema(db));
  return { applied: true };
}

export function buildRemoteMigrationImport(migrationSql) {
  assertMigrationHash(migrationSql);
  return `${migrationSql}\nINSERT INTO d1_migrations (name) VALUES ('${LEXI_MIGRATION_NAME}');\n`;
}
