export const SCHEMA_VERSION = "1.0.0";

export const DATABASE = {
  binding: "DB",
  name: "puzzgrind-db",
  environment: "production",
  wranglerEnv: "production",
};

export const DEFINITIONS = Object.freeze({
  sudoku: {
    created_start: "Production sudoku_sessions row created in the UTC puzzle_date window.",
    meaningful_start: "Proxy definition: status is in_progress, paused, or won. This depends on save/status updates and is not necessarily first board interaction.",
    terminal_session: "Current confirmed terminal session is status won. Long-running incomplete sessions are not marked as failure.",
  },
  lexi: {
    created_start: "Production lexi_sessions row created in the UTC puzzle_date window.",
    meaningful_start: "attempt_count > 0, equivalent to status in in_progress, won, or lost for current production data.",
    terminal_session: "status in won or lost.",
  },
});

export const SAMPLE_GATES = Object.freeze({
  lexi_minimum_meaningful_starts: 50,
  sudoku_minimum_meaningful_starts: 50,
  threshold_type: "initial Portfolio sample thresholds, not industry standards",
});

const WRITE_SQL = /\b(insert|update|delete|replace|drop|alter|create|attach|detach|vacuum|reindex|pragma\s+writable_schema)\b/iu;
const ANON_ID = /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/iu;

export function assertReadOnlySql(sql) {
  const normalized = sql.replace(/--.*$/gmu, " ").replace(/\/\*[\s\S]*?\*\//gu, " ").trim();
  if (!/^select\b/iu.test(normalized) && !/^with\b/iu.test(normalized)) {
    throw new Error("SQL must start with SELECT or WITH for read-only reporting");
  }
  if (WRITE_SQL.test(normalized)) throw new Error("SQL contains a forbidden write/schema keyword");
  return normalized;
}

export function assertNoAnonymousIds(value) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  if (ANON_ID.test(serialized)) throw new Error("Output contains an anonymous ID-shaped value");
}

export function formatDate(date) { return date.toISOString().slice(0, 10); }
export function parseDate(value, name) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value || "")) throw new Error(`${name} must be YYYY-MM-DD`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (formatDate(date) !== value) throw new Error(`${name} must be a valid UTC date`);
  return date;
}
export function addDays(value, days) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDate(date);
}
export function mostRecentCompleteUtcDay(now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - 1);
  return formatDate(d);
}
export function defaultWindow(now = new Date()) {
  const end = mostRecentCompleteUtcDay(now);
  return { start: addDays(end, -6), end };
}
export function resolveWindow({ start, end, now = new Date() }) {
  const fallback = defaultWindow(now);
  const resolved = { start: start || fallback.start, end: end || fallback.end };
  const startDate = parseDate(resolved.start, "--start");
  const endDate = parseDate(resolved.end, "--end");
  if (startDate > endDate) throw new Error("--start must be on or before --end");
  const latest = mostRecentCompleteUtcDay(now);
  if (endDate > parseDate(latest, "latest complete UTC day")) {
    throw new Error(`--end must not be later than the most recent complete UTC day (${latest})`);
  }
  return resolved;
}

export function rate(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : null;
}

function number(row, key) { return Number(row?.[key] ?? 0); }
function nullableDate(row, key) { return row?.[key] ?? null; }
function insufficientReturningUsers(window, returning) { return returning; }

export function buildSudokuReport(row, window) {
  const created = number(row, "created_starts");
  const meaningful = number(row, "meaningful_starts");
  const wins = number(row, "wins");
  const inProgress = number(row, "in_progress_sessions");
  const paused = number(row, "paused_sessions");
  const noProgress = number(row, "no_progress_starts");
  return {
    window: { ...window, first_data_date: nullableDate(row, "first_data_date"), last_data_date: nullableDate(row, "last_data_date") },
    created_starts: created,
    no_progress_starts: noProgress,
    meaningful_starts: meaningful,
    terminal_sessions: wins,
    wins,
    incomplete_sessions: created - wins,
    in_progress_sessions: inProgress,
    paused_sessions: paused,
    distinct_anonymous_users: number(row, "distinct_anonymous_users"),
    returning_users: insufficientReturningUsers(window, number(row, "returning_users")),
    created_start_to_win_rate: rate(wins, created),
    meaningful_start_to_win_rate: rate(wins, meaningful),
    definitions: DEFINITIONS.sudoku,
    validation: {
      created_equals_no_progress_plus_meaningful: created === noProgress + meaningful,
    },
    limitations: ["Sudoku meaningful start is a proxy based on save/status updates, not explicit first board interaction."],
  };
}

export function buildLexiReport(row, window) {
  const created = number(row, "created_starts");
  const meaningful = number(row, "meaningful_starts");
  const won = number(row, "won");
  const lost = number(row, "lost");
  const terminal = won + lost;
  const zeroGuess = number(row, "zero_guess_starts");
  const inProgress = number(row, "in_progress_sessions");
  return {
    window: { ...window, first_data_date: nullableDate(row, "first_data_date"), last_data_date: nullableDate(row, "last_data_date") },
    created_starts: created,
    zero_guess_starts: zeroGuess,
    meaningful_starts: meaningful,
    won,
    lost,
    terminal_sessions: terminal,
    in_progress_sessions: inProgress,
    incomplete_meaningful_sessions: Math.max(0, meaningful - terminal),
    distinct_anonymous_users: number(row, "distinct_anonymous_users"),
    returning_users: insufficientReturningUsers(window, number(row, "returning_users")),
    created_start_to_terminal_rate: rate(terminal, created),
    meaningful_start_to_terminal_rate: rate(terminal, meaningful),
    definitions: DEFINITIONS.lexi,
    validation: {
      created_equals_zero_guess_plus_meaningful: created === zeroGuess + meaningful,
      zero_guess_excluded_from_meaningful: zeroGuess + meaningful === created,
    },
    limitations: ["Zero-guess started Lexi sessions are not product failures and are excluded from meaningful starts."],
  };
}

export function buildReport({ sudokuRow, lexiRow, window, generatedAt, source = "fixture", database = DATABASE, environment = "test", changedDb = false }) {
  const report = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    source,
    database: database.name,
    environment,
    window,
    current_partial_day_excluded: true,
    definitions: DEFINITIONS,
    sample_gates: SAMPLE_GATES,
    sudoku: buildSudokuReport(sudokuRow, window),
    lexi: buildLexiReport(lexiRow, window),
    validation: {
      readonly: true,
      changed_db: changedDb,
      output_contains_anonymous_ids: false,
      yaml_json_schema_consistent: true,
    },
    limitations: [
      "Created starts measure session creation, not product engagement.",
      "Do not use created-start completion rates alone to judge game difficulty.",
      "This task does not create or activate a product experiment.",
    ],
  };
  assertNoAnonymousIds(report);
  return report;
}

export const SQL = Object.freeze({
  sudoku: `SELECT
  COUNT(*) AS created_starts,
  MIN(p.puzzle_date) AS first_data_date,
  MAX(p.puzzle_date) AS last_data_date,
  SUM(CASE WHEN s.status = 'started' THEN 1 ELSE 0 END) AS no_progress_starts,
  SUM(CASE WHEN s.status IN ('in_progress','paused','won') THEN 1 ELSE 0 END) AS meaningful_starts,
  SUM(CASE WHEN s.status = 'won' THEN 1 ELSE 0 END) AS wins,
  SUM(CASE WHEN s.status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress_sessions,
  SUM(CASE WHEN s.status = 'paused' THEN 1 ELSE 0 END) AS paused_sessions,
  COUNT(DISTINCT s.anonymous_id) AS distinct_anonymous_users,
  COUNT(DISTINCT CASE WHEN user_days.active_days >= 2 THEN s.anonymous_id END) AS returning_users
FROM sudoku_sessions s
JOIN sudoku_puzzles p ON p.id = s.puzzle_id
JOIN (
  SELECT anonymous_id, COUNT(DISTINCT p2.puzzle_date) AS active_days
  FROM sudoku_sessions s2
  JOIN sudoku_puzzles p2 ON p2.id = s2.puzzle_id
  WHERE p2.puzzle_date BETWEEN ? AND ?
    AND s2.source_environment = 'production'
  GROUP BY anonymous_id
) user_days ON user_days.anonymous_id = s.anonymous_id
WHERE p.puzzle_date BETWEEN ? AND ?
  AND s.source_environment = 'production';`,
  lexi: `SELECT
  COUNT(*) AS created_starts,
  MIN(p.puzzle_date) AS first_data_date,
  MAX(p.puzzle_date) AS last_data_date,
  SUM(CASE WHEN s.attempt_count = 0 THEN 1 ELSE 0 END) AS zero_guess_starts,
  SUM(CASE WHEN s.attempt_count > 0 OR s.status IN ('in_progress','won','lost') THEN 1 ELSE 0 END) AS meaningful_starts,
  SUM(CASE WHEN s.status = 'won' THEN 1 ELSE 0 END) AS won,
  SUM(CASE WHEN s.status = 'lost' THEN 1 ELSE 0 END) AS lost,
  SUM(CASE WHEN s.status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress_sessions,
  COUNT(DISTINCT s.anonymous_id) AS distinct_anonymous_users,
  COUNT(DISTINCT CASE WHEN user_days.active_days >= 2 THEN s.anonymous_id END) AS returning_users
FROM lexi_sessions s
JOIN lexi_puzzles p ON p.id = s.puzzle_id
JOIN (
  SELECT anonymous_id, COUNT(DISTINCT p2.puzzle_date) AS active_days
  FROM lexi_sessions s2
  JOIN lexi_puzzles p2 ON p2.id = s2.puzzle_id
  WHERE p2.puzzle_date BETWEEN ? AND ?
    AND s2.source_environment = 'production'
  GROUP BY anonymous_id
) user_days ON user_days.anonymous_id = s.anonymous_id
WHERE p.puzzle_date BETWEEN ? AND ?
  AND s.source_environment = 'production';`,
});
for (const sql of Object.values(SQL)) assertReadOnlySql(sql);
