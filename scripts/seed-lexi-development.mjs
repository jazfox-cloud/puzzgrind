import { execFileSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

if (process.argv.some((value) => value === "--remote") || ["preview", "production"].includes(process.env.APP_ENV ?? "")) {
  throw new Error("Lexi development seed is local-only and refuses remote/preview/production execution.");
}
const day = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const now = Math.floor(Date.now() / 1_000);
const evaluation = ["absent", "absent", "absent", "absent", "absent"];
const guesses = (words) => JSON.stringify(words.map((guess) => ({ guess, evaluation })));
const file = resolve(process.cwd(), "lexi-development-seed.sql.local");
const sql = `-- DEVELOPMENT/TEST ONLY. Never execute against a remote D1 database.
PRAGMA foreign_keys=ON;
DELETE FROM lexi_daily_leaderboard WHERE id LIKE 'lexi-dev-%';
DELETE FROM lexi_hint_events WHERE id LIKE 'lexi-dev-%';
DELETE FROM lexi_sessions WHERE id LIKE 'lexi-dev-%';
DELETE FROM lexi_puzzles WHERE id LIKE 'lexi-dev-%';
INSERT INTO lexi_puzzles (id,puzzle_date,answer,status,source_reference,validation_version,published_at,created_at,updated_at) VALUES
('lexi-dev-today','${day(0)}','level','published','DEVELOPMENT_ONLY','dev-v1',${now},${now},${now}),
('lexi-dev-past','${day(-1)}','jazzy','archived','DEVELOPMENT_ONLY','dev-v1',${now - 86400},${now},${now}),
('lexi-dev-future','${day(1)}','alert','scheduled','DEVELOPMENT_ONLY','dev-v1',NULL,${now},${now});
INSERT INTO lexi_sessions (id,anonymous_id,puzzle_id,status,guesses_json,attempt_count,hint_count,hint_letter,revision,challenge_nonce,started_at,completed_at,duration_seconds,updated_at) VALUES
('lexi-dev-won','00000000-0000-4000-8000-000000000001','lexi-dev-today','won','${guesses(["cigar", "level"])}',2,0,NULL,2,'dev-won-nonce',${now - 90},${now - 30},60,${now}),
('lexi-dev-lost','00000000-0000-4000-8000-000000000002','lexi-dev-today','lost','${guesses(["cigar", "rebut", "sissy", "humph", "awake", "blush"])}',6,1,'l',7,'dev-lost-nonce',${now - 200},${now - 20},180,${now}),
('lexi-dev-progress','00000000-0000-4000-8000-000000000003','lexi-dev-today','in_progress','${guesses(["cigar"])}',1,0,NULL,1,'dev-progress-nonce',${now - 20},NULL,NULL,${now}),
('lexi-dev-expired','00000000-0000-4000-8000-000000000004','lexi-dev-past','expired','[]',0,0,NULL,1,'dev-expired-nonce',${now - 86400},NULL,NULL,${now});
INSERT INTO lexi_daily_leaderboard (id,puzzle_id,puzzle_date,player_key_hash,display_name,verified_hints_used,verified_attempts,verified_completion_seconds,completed_at,created_at,session_id)
VALUES ('lexi-dev-score','lexi-dev-today','${day(0)}','${"a".repeat(64)}','Dev Player',0,2,60,${now - 30},${now},'lexi-dev-won');
`;
try {
  writeFileSync(file, sql, { mode: 0o600 });
  execFileSync("./node_modules/.bin/wrangler", ["d1", "execute", "puzzgrind-staging-db", "--local", "--env", "staging", "--file", file], { stdio: "inherit" });
} finally { rmSync(file, { force: true }); }
