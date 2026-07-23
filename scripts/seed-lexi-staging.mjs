import { execFileSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { readPrivateLexiQaAnswers } from "./lib/read-private-lexi-qa.mjs";

const STAGING_NAME = "puzzgrind-staging-db";
const STAGING_ID = "d3f0b3d8-81a8-40de-96f4-7ed248e0fb93";
const CONFIRMATION = "LEXI_STAGING_QA_ONLY";

function fail(message) {
  throw new Error(`Staging seed guard failed: ${message}`);
}

const values = new Map();
const args = process.argv.slice(2).filter((value) => value !== "--");
for (let index = 0; index < args.length; index += 2) values.set(args[index], args[index + 1]);
if (values.get("--remote") !== "true") fail("--remote true is required; there is no default remote target");
if (values.get("--env") !== "staging") fail("--env staging is required");
if (values.get("--database-id") !== STAGING_ID) fail("the exact Staging database ID is required");
if (values.get("--confirm") !== STAGING_NAME) fail(`--confirm ${STAGING_NAME} is required`);
if (values.get("--acknowledge") !== CONFIRMATION) fail(`--acknowledge ${CONFIRMATION} is required`);

const config = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
const staging = config.env?.staging;
const production = config.env?.production;
const stagingDatabase = staging?.d1_databases?.find(({ binding }) => binding === "DB");
const productionDatabase = production?.d1_databases?.find(({ binding }) => binding === "DB");
if (staging?.name !== "puzzgrind-staging" || staging?.vars?.APP_ENV !== "staging") {
  fail("env.staging does not identify the isolated Staging Worker");
}
if (stagingDatabase?.database_name !== STAGING_NAME || stagingDatabase?.database_id !== STAGING_ID) {
  fail("wrangler.jsonc Staging D1 name/ID does not match the approved target");
}
if (!productionDatabase?.database_id || productionDatabase.database_id === STAGING_ID) {
  fail("Staging and Production D1 IDs are not demonstrably isolated");
}

const day = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const now = Math.floor(Date.now() / 1_000);
const evaluation = ["absent", "absent", "absent", "absent", "absent"];
const guesses = (words) => JSON.stringify(words.map((guess) => ({ guess, evaluation })));
const dates = [day(-1), day(0), day(1)];
const [todayAnswer, archivedAnswer, scheduledAnswer] = readPrivateLexiQaAnswers();
const lossWords = ["cigar", "rebut", "sissy", "humph", "awake", "blush", "adore"]
  .filter((word) => word !== todayAnswer).slice(0, 6);
const wrangler = "./node_modules/.bin/wrangler";
const baseArgs = ["d1", "execute", STAGING_NAME, "--remote", "--env", "staging"];
const existing = JSON.parse(execFileSync(wrangler, [...baseArgs, "--command", `SELECT id FROM lexi_puzzles WHERE puzzle_date IN ('${dates.join("','")}');`, "--json"], { encoding: "utf8" }));
const conflictingIds = (existing[0]?.results ?? []).map(({ id }) => id).filter((id) => !id.startsWith("lexi-staging-qa-"));
if (conflictingIds.length > 0) fail("a non-QA Lexi puzzle already occupies one of the protected seed dates");

const file = resolve(process.cwd(), "lexi-staging-seed.sql.local");
const sql = `PRAGMA foreign_keys=ON;
DELETE FROM lexi_daily_leaderboard WHERE id LIKE 'lexi-staging-qa-%';
DELETE FROM lexi_hint_events WHERE id LIKE 'lexi-staging-qa-%';
DELETE FROM lexi_sessions WHERE puzzle_id LIKE 'lexi-staging-qa-%';
DELETE FROM lexi_puzzles WHERE id LIKE 'lexi-staging-qa-%';
INSERT INTO lexi_puzzles (id,puzzle_date,answer,status,source_reference,validation_version,published_at,created_at,updated_at) VALUES
('lexi-staging-qa-today','${day(0)}','${todayAnswer}','published','STAGING_QA_ONLY','staging-qa-v1',${now},${now},${now}),
('lexi-staging-qa-archived','${day(-1)}','${archivedAnswer}','archived','STAGING_QA_ONLY','staging-qa-v1',${now - 86400},${now},${now}),
('lexi-staging-qa-scheduled','${day(1)}','${scheduledAnswer}','scheduled','STAGING_QA_ONLY','staging-qa-v1',NULL,${now},${now});
INSERT INTO lexi_sessions (id,anonymous_id,puzzle_id,status,guesses_json,attempt_count,hint_count,hint_letter,revision,challenge_nonce,started_at,completed_at,duration_seconds,updated_at) VALUES
('lexi-staging-qa-won','10000000-0000-4000-8000-000000000001','lexi-staging-qa-today','won','${guesses([lossWords[0], todayAnswer])}',2,0,NULL,2,'staging-qa-won-nonce',${now - 90},${now - 30},60,${now}),
('lexi-staging-qa-lost','10000000-0000-4000-8000-000000000002','lexi-staging-qa-today','lost','${guesses(lossWords)}',6,0,NULL,6,'staging-qa-lost-nonce',${now - 200},${now - 20},180,${now}),
('lexi-staging-qa-progress','10000000-0000-4000-8000-000000000003','lexi-staging-qa-today','in_progress','${guesses(["cigar"])}',1,0,NULL,1,'staging-qa-progress-nonce',${now - 20},NULL,NULL,${now}),
('lexi-staging-qa-expired','10000000-0000-4000-8000-000000000004','lexi-staging-qa-archived','expired','[]',0,0,NULL,1,'staging-qa-expired-nonce',${now - 86400},NULL,NULL,${now});
`;

console.log(`Target: ${STAGING_NAME} (${STAGING_ID}); environment: staging; QA dates: ${dates.join(", ")}`);
try {
  writeFileSync(file, sql, { mode: 0o600 });
  execFileSync(wrangler, [...baseArgs, "--file", file], { stdio: "inherit" });
} finally {
  rmSync(file, { force: true });
}

const verification = JSON.parse(execFileSync(wrangler, [...baseArgs, "--command", "SELECT status,COUNT(*) AS count FROM lexi_puzzles WHERE id LIKE 'lexi-staging-qa-%' GROUP BY status ORDER BY status; SELECT status,COUNT(*) AS count FROM lexi_sessions WHERE id LIKE 'lexi-staging-qa-%' GROUP BY status ORDER BY status;", "--json"], { encoding: "utf8" }));
console.log(JSON.stringify({ puzzles: verification[0]?.results ?? [], sessions: verification[1]?.results ?? [] }, null, 2));
