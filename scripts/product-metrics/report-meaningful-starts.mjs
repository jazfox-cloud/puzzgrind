#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  DATABASE,
  SQL,
  assertNoAnonymousIds,
  assertReadOnlySql,
  buildReport,
  defaultWindow,
  resolveWindow,
} from "./definitions.mjs";

function usage() {
  return `Usage: node scripts/product-metrics/report-meaningful-starts.mjs [--start YYYY-MM-DD] [--end YYYY-MM-DD] [--format yaml|json] [--output path] [--fixture path]\n\nDefaults to the most recent complete 7 UTC days and excludes the current partial UTC day. Production mode queries remote Cloudflare D1 database puzzgrind-db with --env production. Fixture mode is for tests only.`;
}

function parseArgs(argv) {
  const args = { format: "yaml", fixture: null, output: null, start: null, end: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") return { help: true };
    if (["--start", "--end", "--format", "--output", "--fixture"].includes(arg)) {
      const value = argv[++i];
      if (!value) throw new Error(`${arg} requires a value`);
      args[arg.slice(2)] = value;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!["yaml", "json"].includes(args.format)) throw new Error("--format must be yaml or json");
  return args;
}

function scalar(value) {
  if (value === null) return "null";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "string" && /^[A-Za-z0-9_./:-]+$/u.test(value)) return value;
  return JSON.stringify(value);
}

export function toYaml(value, indent = 0) {
  const pad = " ".repeat(indent);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return value.map((item) => typeof item === "object" && item !== null
      ? `${pad}-\n${toYaml(item, indent + 2)}`
      : `${pad}- ${scalar(item)}`).join("\n");
  }
  if (value && typeof value === "object") {
    return Object.entries(value).map(([key, item]) => {
      if (item && typeof item === "object") {
        if (Array.isArray(item) && item.length === 0) return `${pad}${key}: []`;
        return `${pad}${key}:\n${toYaml(item, indent + 2)}`;
      }
      return `${pad}${key}: ${scalar(item)}`;
    }).join("\n");
  }
  return `${pad}${scalar(value)}`;
}

function sqliteQuote(value) { return `'${value.replaceAll("'", "''")}'`; }
function bindSql(sql, start, end) {
  const values = [start, end, start, end].map(sqliteQuote);
  let index = 0;
  return sql.replace(/\?/gu, () => values[index++]);
}

function runWranglerQuery(sql, start, end) {
  assertReadOnlySql(sql);
  const command = bindSql(sql, start, end);
  const args = ["wrangler", "d1", "execute", DATABASE.name, "--remote", "--env", DATABASE.wranglerEnv, "--command", command, "--json"];
  const stdout = execFileSync("npx", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const parsed = JSON.parse(stdout);
  const first = parsed[0] || {};
  const row = first.results?.[0] || {};
  return { row, meta: first.meta || {} };
}

function buildFromFixture(path, window) {
  const fixture = JSON.parse(readFileSync(path, "utf8"));
  return buildReport({
    sudokuRow: fixture.sudoku,
    lexiRow: fixture.lexi,
    window,
    generatedAt: fixture.generated_at || new Date().toISOString(),
    source: `fixture:${path}`,
    environment: "test",
    changedDb: false,
  });
}

function buildFromProduction(window) {
  const sudoku = runWranglerQuery(SQL.sudoku, window.start, window.end);
  const lexi = runWranglerQuery(SQL.lexi, window.start, window.end);
  const changedDb = Boolean(sudoku.meta.changed_db || lexi.meta.changed_db || sudoku.meta.rows_written || lexi.meta.rows_written);
  return buildReport({
    sudokuRow: sudoku.row,
    lexiRow: lexi.row,
    window,
    generatedAt: new Date().toISOString(),
    source: "cloudflare-d1-remote-readonly",
    database: DATABASE,
    environment: DATABASE.environment,
    changedDb,
  });
}

export function render(report, format) {
  assertNoAnonymousIds(report);
  return format === "json" ? `${JSON.stringify(report, null, 2)}\n` : `${toYaml(report)}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(usage()); return; }
  const window = resolveWindow({ start: args.start, end: args.end });
  const report = args.fixture ? buildFromFixture(resolve(args.fixture), window) : buildFromProduction(window);
  const output = render(report, args.format);
  if (args.output) {
    if (existsSync(args.output)) throw new Error(`Refusing to overwrite existing output file: ${args.output}`);
    writeFileSync(args.output, output);
  } else {
    process.stdout.write(output);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try { main(); } catch (error) { console.error(error.message); process.exit(1); }
}
export { parseArgs, usage, defaultWindow };
