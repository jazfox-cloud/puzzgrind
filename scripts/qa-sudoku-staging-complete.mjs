import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const BASE_URL = "https://puzzgrind-staging.jazfoxbrook.workers.dev";
const STAGING_NAME = "puzzgrind-staging-db";
const STAGING_ID = "d3f0b3d8-81a8-40de-96f4-7ed248e0fb93";
const values = new Map();
const args = process.argv.slice(2).filter((value) => value !== "--");
for (let index = 0; index < args.length; index += 2) values.set(args[index], args[index + 1]);
if (values.get("--env") !== "staging" || values.get("--database-id") !== STAGING_ID ||
  values.get("--confirm") !== STAGING_NAME) throw new Error("Explicit Staging target confirmation is required");
const config = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
const stagingDb = config.env?.staging?.d1_databases?.find(({ binding }) => binding === "DB");
const productionDb = config.env?.production?.d1_databases?.find(({ binding }) => binding === "DB");
if (config.env?.staging?.name !== "puzzgrind-staging" || stagingDb?.database_id !== STAGING_ID ||
  productionDb?.database_id === STAGING_ID) throw new Error("Staging isolation guard failed");

const wrangler = "./node_modules/.bin/wrangler";
const date = new Date().toISOString().slice(0, 10);
const raw = execFileSync(wrangler, ["d1", "execute", STAGING_NAME, "--remote", "--env", "staging",
  "--command", `SELECT solution FROM sudoku_puzzles WHERE puzzle_date='${date}' AND source_reference='STAGING_QA_COPY' LIMIT 1;`, "--json"], { encoding: "utf8" });
const solution = JSON.parse(raw)[0]?.results?.[0]?.solution;
if (typeof solution !== "string" || !/^[1-9]{81}$/u.test(solution)) throw new Error("Protected QA Sudoku solution is unavailable");
const notes = Array.from({ length: 81 }, () => []);
const post = async (path, body) => {
  const response = await fetch(`${BASE_URL}${path}`, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
  return { response, body: await response.json().catch(() => ({})) };
};
const todayResponse = await fetch(`${BASE_URL}/api/sudoku/today`, { signal: AbortSignal.timeout(30_000) });
const today = await todayResponse.json();
if (todayResponse.status !== 200 || typeof today.givens !== "string") throw new Error("Sudoku today failed");
const started = await post("/api/sudoku/session/start", { anonymousId: crypto.randomUUID() });
if (![200, 201].includes(started.response.status) || typeof started.body.sessionToken !== "string") throw new Error("Sudoku start failed");
const hint = await post("/api/sudoku/hint", { sessionId: started.body.sessionId, sessionToken: started.body.sessionToken,
  board: today.givens, level: 1 });
if (hint.response.status !== 200 || typeof hint.body.hint !== "object") throw new Error("Sudoku hint failed");
const saved = await post("/api/sudoku/session/save", { token: started.body.sessionToken, board: today.givens,
  notes, elapsedSeconds: 2, mistakes: 0, paused: false });
if (saved.response.status !== 200 || saved.body.saved !== true) throw new Error("Sudoku save failed");
const completed = await post("/api/sudoku/session/complete", { token: started.body.sessionToken, board: solution,
  notes, elapsedSeconds: 3, mistakes: 0 });
if (completed.response.status !== 200 || completed.body.completed !== true) throw new Error("Sudoku completion failed");
console.log(JSON.stringify({ today: todayResponse.status, start: started.response.status, hint: hint.response.status,
  save: saved.response.status, complete: completed.response.status, completed: true }, null, 2));
