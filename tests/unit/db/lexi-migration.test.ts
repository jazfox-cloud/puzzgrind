// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "migrations/0003_lexi_daily.sql"), "utf8");
const guess = (word: string) => JSON.stringify([{ guess: word, evaluation: ["absent", "absent", "absent", "absent", "absent"] }]);

function database() {
  const db = new DatabaseSync(":memory:");
  db.exec(migration);
  db.exec(`INSERT INTO lexi_puzzles
    (id, puzzle_date, answer, status, validation_version, published_at)
    VALUES ('test-puzzle', '2026-07-22', 'jazzy', 'published', 'TEST_ONLY', 1)`);
  return db;
}

function session(db: DatabaseSync, id: string, player: string, started = 100) {
  db.prepare(`INSERT INTO lexi_sessions
    (id, anonymous_id, puzzle_id, challenge_nonce, started_at, updated_at)
    VALUES (?, ?, 'test-puzzle', ?, ?, ?)`).run(id, player, `${id}-nonce`, started, started);
}

describe("Lexi D1 migration", () => {
  it("is additive and creates all isolated tables and ranking indexes", () => {
    expect(migration).not.toMatch(/^\s*(?:DROP|DELETE|ALTER)\b/imu);
    for (const table of ["lexi_puzzles", "lexi_sessions", "lexi_hint_events", "lexi_puzzle_stats", "lexi_daily_leaderboard"]) {
      expect(migration).toContain(`CREATE TABLE ${table}`);
    }
    expect(migration).toContain("verified_hints_used, verified_attempts");
  });

  it("enforces puzzle, session, foreign key, hint, and leaderboard constraints", () => {
    const db = database();
    try {
      expect(() => db.exec(`INSERT INTO lexi_puzzles (id,puzzle_date,answer,validation_version) VALUES ('bad','2026-07-23','JAZZY','x')`)).toThrow();
      expect(() => db.exec(`INSERT INTO lexi_puzzles (id,puzzle_date,answer,word_length,validation_version) VALUES ('bad2','2026-07-24','jazzy',4,'x')`)).toThrow();
      session(db, "s1", "p1");
      expect(() => session(db, "s2", "p1")).toThrow();
      expect(() => db.exec(`INSERT INTO lexi_sessions (id,anonymous_id,puzzle_id,challenge_nonce,started_at,updated_at) VALUES ('x','x','missing','x',1,1)`)).toThrow();
      db.exec(`UPDATE lexi_sessions SET attempt_count=2, guesses_json='[
        {"guess":"cigar","evaluation":["absent","absent","absent","absent","absent"]},
        {"guess":"rebut","evaluation":["absent","absent","absent","absent","absent"]}
      ]' WHERE id='s1'`);
      db.exec(`INSERT INTO lexi_hint_events VALUES ('h1','s1','test-puzzle','reveal_letter','j',110)`);
      expect(() => db.exec(`INSERT INTO lexi_hint_events VALUES ('h2','s1','test-puzzle','reveal_letter','a',111)`)).toThrow();
      expect(db.prepare("SELECT hint_count, hint_letter FROM lexi_sessions WHERE id='s1'").get()).toMatchObject({ hint_count: 1, hint_letter: "j" });
    } finally { db.close(); }
  });

  it("counts starts and terminal outcomes once and cannot exceed six attempts", () => {
    const db = database();
    try {
      session(db, "s1", "p1");
      db.exec(`UPDATE lexi_sessions SET guesses_json='${guess("jazzy")}', attempt_count=1,
        revision=1, status='won', completed_at=130, duration_seconds=30, updated_at=130 WHERE id='s1'`);
      db.exec(`UPDATE lexi_sessions SET updated_at=131 WHERE id='s1'`);
      expect(db.prepare("SELECT * FROM lexi_puzzle_stats").get()).toMatchObject({
        start_count: 1, win_count: 1, fail_count: 0, total_attempts: 1, total_completion_seconds: 30,
      });
      expect(() => db.exec(`UPDATE lexi_sessions SET attempt_count=7 WHERE id='s1'`)).toThrow();
    } finally { db.close(); }
  });

  it("allows only one conditional writer for the same revision", () => {
    const db = database();
    try {
      session(db, "s1", "p1");
      const update = db.prepare(`UPDATE lexi_sessions SET guesses_json=?, attempt_count=attempt_count+1,
        revision=revision+1, status='in_progress', updated_at=101
        WHERE id='s1' AND revision=? AND status IN ('started','in_progress') AND attempt_count<6`);
      expect(update.run(guess("cigar"), 0).changes).toBe(1);
      expect(update.run(guess("rebut"), 0).changes).toBe(0);
      expect(db.prepare("SELECT attempt_count,revision FROM lexi_sessions WHERE id='s1'").get()).toMatchObject({ attempt_count: 1, revision: 1 });
    } finally { db.close(); }
  });

  it("ranks by hints, attempts, duration, completion time, then id and keeps nickname immutable", () => {
    const db = database();
    try {
      const rows = [
        ["e", "p5", 1, 3, 10, 110], ["d", "p4", 1, 3, 10, 109],
        ["c", "p3", 1, 3, 9, 111], ["b", "p2", 1, 2, 20, 120], ["a", "p1", 0, 6, 30, 130],
      ] as const;
      for (const [id, player, hints, attempts, duration, completed] of rows) {
        session(db, `s-${id}`, player);
        const guesses = Array.from({ length: attempts }, (_, index) => ({ guess: ["cigar","rebut","sissy","humph","awake","jazzy"][index], evaluation: ["absent","absent","absent","absent","absent"] }));
        db.prepare(`UPDATE lexi_sessions SET guesses_json=?,attempt_count=?,hint_count=?,hint_letter=?,status='won',
          completed_at=?,duration_seconds=?,updated_at=? WHERE id=?`).run(JSON.stringify(guesses), attempts, hints, hints ? "j" : null, completed, duration, completed, `s-${id}`);
        db.prepare(`INSERT INTO lexi_daily_leaderboard VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
          id, "test-puzzle", "2026-07-22", id.repeat(64), `Name${id}`, hints, attempts, duration, completed, 200, `s-${id}`);
      }
      const names = db.prepare(`SELECT display_name FROM lexi_daily_leaderboard ORDER BY
        verified_hints_used,verified_attempts,verified_completion_seconds,completed_at,id`).all().map((row) => row.display_name);
      expect(names).toEqual(["Namea", "Nameb", "Namec", "Named", "Namee"]);
      expect(() => db.exec("UPDATE lexi_daily_leaderboard SET display_name='Changed' WHERE id='a'")).toThrow();
      expect(db.prepare("SELECT display_name FROM lexi_daily_leaderboard WHERE id='a'").get()).toMatchObject({ display_name: "Namea" });
    } finally { db.close(); }
  });
});
