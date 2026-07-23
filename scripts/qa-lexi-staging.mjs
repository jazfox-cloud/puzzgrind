import { readPrivateLexiQaAnswers } from "./lib/read-private-lexi-qa.mjs";

const BASE_URL = "https://puzzgrind-staging.jazfoxbrook.workers.dev";
const [qaAnswer] = readPrivateLexiQaAnswers();
const results = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function record(name, status, detail = "ok") {
  results.push({ name, status, detail });
}
async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers ?? {}) },
    signal: AbortSignal.timeout(30_000),
  });
  const body = await response.json().catch(() => ({}));
  return { body, response };
}
const post = (path, body, headers) => request(path, { method: "POST", body: JSON.stringify(body), headers });
const uuid = () => crypto.randomUUID();

const today = await request("/api/lexi/today");
assert(today.response.status === 200, "Lexi today failed");
assert(!("answer" in today.body) && !JSON.stringify(today.body).includes(qaAnswer), "Today leaked the answer");
assert(today.body.wordLength === 5 && today.body.maxAttempts === 6, "Today metadata mismatch");
record("today_no_answer", today.response.status);

const primaryAnonymousId = uuid();
const primary = await post("/api/lexi/session/start", { anonymousId: primaryAnonymousId });
assert(primary.response.status === 201 && typeof primary.body.token === "string", "Primary session did not start");
assert(!("answer" in primary.body), "New session leaked the answer");
const primaryToken = primary.body.token;
record("session_start_no_answer", primary.response.status);

const invalid = await post("/api/lexi/guess", { token: primaryToken, guess: "zzzzz", revision: 0 });
assert(invalid.response.status === 422 && invalid.body.error === "invalid_word", "Invalid word boundary failed");
record("invalid_word", invalid.response.status, invalid.body.error);

const badToken = await post("/api/lexi/guess", { token: "not-a-token", guess: "cigar", revision: 0 });
assert(badToken.response.status === 401 && badToken.body.error === "invalid_token", "Malformed token boundary failed");
record("invalid_token", badToken.response.status, badToken.body.error);

const earlyHint = await post("/api/lexi/hint", { token: primaryToken });
assert(earlyHint.response.status === 409 && earlyHint.body.error === "hint_unavailable", "Early hint was not rejected");
record("hint_prerequisite", earlyHint.response.status, earlyHint.body.error);

const evaluate = (answer, guess) => {
  const result = Array(5).fill("absent");
  const remaining = new Map();
  for (let index = 0; index < 5; index += 1) {
    if (answer[index] === guess[index]) result[index] = "correct";
    else remaining.set(answer[index], (remaining.get(answer[index]) ?? 0) + 1);
  }
  for (let index = 0; index < 5; index += 1) {
    if (result[index] === "correct") continue;
    const count = remaining.get(guess[index]) ?? 0;
    if (count > 0) { result[index] = "present"; remaining.set(guess[index], count - 1); }
  }
  return result;
};
const repeatedWord = qaAnswer === "hello" ? "eerie" : "hello";
const repeated = await post("/api/lexi/guess", { token: primaryToken, guess: repeatedWord, revision: 0 });
assert(repeated.response.status === 200, "Repeated-letter guess failed");
assert(JSON.stringify(repeated.body.evaluation) === JSON.stringify(evaluate(qaAnswer, repeatedWord)), "Repeated-letter evaluation mismatch");
assert(!("answer" in repeated.body), "In-progress guess leaked answer");
record("repeated_letter_evaluation", repeated.response.status, repeated.body.evaluation.join(","));

const duplicate = await post("/api/lexi/guess", { token: primaryToken, guess: repeatedWord.toUpperCase(), revision: 0 });
assert(duplicate.response.status === 409 && duplicate.body.error === "duplicate_guess", "Duplicate retry behavior failed");
record("duplicate_guess", duplicate.response.status, duplicate.body.error);

const secondWord = ["cigar", "rebut", "awake"].find((word) => word !== qaAnswer && word !== repeatedWord);
const conflict = await post("/api/lexi/guess", { token: primaryToken, guess: secondWord, revision: 0 });
assert(conflict.response.status === 409 && conflict.body.error === "revision_conflict", "Revision conflict behavior failed");
record("revision_conflict", conflict.response.status, conflict.body.error);

const second = await post("/api/lexi/guess", { token: primaryToken, guess: secondWord, revision: 1 });
assert(second.response.status === 200 && second.body.revision === 2, "Second valid guess failed");
const hint = await post("/api/lexi/hint", { token: primaryToken });
const hintAgain = await post("/api/lexi/hint", { token: primaryToken });
assert(hint.response.status === 200 && hint.body.hintCount === 1 && /^[a-z]$/.test(hint.body.letter), "Hint failed");
assert(hintAgain.response.status === 200 && hintAgain.body.letter === hint.body.letter, "Hint was not idempotent");
record("hint_idempotent", hintAgain.response.status);

const won = await post("/api/lexi/guess", { token: primaryToken, guess: qaAnswer, revision: 2 });
assert(won.response.status === 200 && won.body.status === "won" && won.body.attemptCount === 3,
  `Winning transition failed (HTTP ${won.response.status}, error ${won.body.error ?? "none"}, status ${won.body.status ?? "none"}, attempts ${won.body.attemptCount ?? "none"})`);
assert(!("answer" in won.body), "Winning response unnecessarily returned answer");
record("win", won.response.status);

const submitted = await post("/api/lexi/leaderboard", { token: primaryToken, nickname: "QA Player" });
assert([200, 201].includes(submitted.response.status), "Leaderboard submit failed");
assert(submitted.body.entries.some((entry) => entry.isYou === true), "Leaderboard submit did not mark isYou");
record("leaderboard_submit_isYou", submitted.response.status);
for (const limit of [10, 20]) {
  const board = await request(`/api/lexi/leaderboard?limit=${limit}`, { headers: { authorization: `Bearer ${primaryToken}` } });
  assert(board.response.status === 200 && board.body.entries.length <= limit, `Top ${limit} failed`);
  assert(board.body.entries.some((entry) => entry.isYou === true), `Top ${limit} lost isYou`);
  record(`leaderboard_top_${limit}`, board.response.status, `${board.body.entries.length} entries`);
}

const lossAnonymousId = uuid();
const lossSession = await post("/api/lexi/session/start", { anonymousId: lossAnonymousId });
assert(lossSession.response.status === 201, "Loss session did not start");
const losingWords = ["cigar", "rebut", "sissy", "humph", "awake", "blush", "adore"]
  .filter((word) => word !== qaAnswer).slice(0, 6);
let lossBody;
for (let revision = 0; revision < losingWords.length; revision += 1) {
  const attempt = await post("/api/lexi/guess", { token: lossSession.body.token, guess: losingWords[revision], revision });
  assert(attempt.response.status === 200, `Loss attempt ${revision + 1} failed`);
  if (revision < 5) assert(!("answer" in attempt.body), "Answer leaked before sixth failure");
  lossBody = attempt.body;
}
assert(lossBody.status === "lost" && lossBody.attemptCount === 6 && typeof lossBody.answer === "string", "Sixth-attempt loss boundary failed");
record("sixth_attempt_loss_answer_boundary", 200);

const restoredLoss = await post("/api/lexi/session/start", { anonymousId: lossAnonymousId });
assert(restoredLoss.response.status === 200 && restoredLoss.body.restored === true && restoredLoss.body.status === "lost" && typeof restoredLoss.body.answer === "string", "Lost-session restore answer boundary failed");
record("lost_restore_answer_boundary", restoredLoss.response.status);

const sudokuToday = await request("/api/sudoku/today");
assert(sudokuToday.response.status === 200 && typeof sudokuToday.body.givens === "string", "Sudoku today failed");
const sudoku = await post("/api/sudoku/session/start", { anonymousId: uuid() });
assert([200, 201].includes(sudoku.response.status) && typeof sudoku.body.sessionToken === "string", "Sudoku session failed");
const sudokuSave = await post("/api/sudoku/session/save", {
  token: sudoku.body.sessionToken,
  board: sudokuToday.body.givens,
  notes: Array.from({ length: 81 }, () => []),
  elapsedSeconds: 1,
  mistakes: 0,
  paused: false,
});
assert(sudokuSave.response.status === 200 && sudokuSave.body.saved === true, "Sudoku save regression");
record("sudoku_today_start_save", sudokuSave.response.status);

const lexiToSudoku = await post("/api/sudoku/session/save", {
  token: primaryToken,
  board: sudokuToday.body.givens,
  notes: Array.from({ length: 81 }, () => []),
  elapsedSeconds: 1,
  mistakes: 0,
  paused: false,
});
assert(lexiToSudoku.response.status === 401, "Lexi token reached Sudoku");
const sudokuToLexi = await post("/api/lexi/hint", { token: sudoku.body.sessionToken });
assert(sudokuToLexi.response.status === 401 && sudokuToLexi.body.error === "invalid_token", "Sudoku token reached Lexi");
record("cross_game_token_isolation", 401);

console.log(JSON.stringify({ baseUrl: BASE_URL, passed: results.length, results }, null, 2));
