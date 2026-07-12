const baseGivens = "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
const baseSolution = "534678912672195348198342567859761423426853791713924856961537284287419635345286179";
const permutations = [
  [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0],
];

function argument(name, fallback) {
  const prefix = `--${name}=`;
  const match = process.argv.find((value) => value.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function dateAt(start, offset) {
  const date = new Date(`${start}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function order(groups, within) {
  return groups.flatMap((group) => within.map((position) => group * 3 + position));
}

function transform(board, index) {
  const rowOrder = order(permutations[Math.floor(index / 6) % 6], permutations[index % 6]);
  const columnOrder = order(permutations[Math.floor(index / 216) % 6], permutations[Math.floor(index / 36) % 6]);
  const digitShift = index % 9;
  let output = "";
  for (const row of rowOrder) {
    for (const column of columnOrder) {
      const value = Number(board[row * 9 + column]);
      output += value === 0 ? "0" : String(((value - 1 + digitShift) % 9) + 1);
    }
  }
  return output;
}

function validate(givens, solution) {
  if (givens.length !== 81 || solution.length !== 81) throw new Error("Generated board has an invalid length");
  for (let index = 0; index < 81; index += 1) {
    if (givens[index] !== "0" && givens[index] !== solution[index]) throw new Error("A given does not match its solution");
  }
  const groups = [];
  for (let index = 0; index < 9; index += 1) {
    groups.push(Array.from({ length: 9 }, (_, offset) => index * 9 + offset));
    groups.push(Array.from({ length: 9 }, (_, offset) => offset * 9 + index));
  }
  for (let boxRow = 0; boxRow < 3; boxRow += 1) {
    for (let boxColumn = 0; boxColumn < 3; boxColumn += 1) {
      groups.push(Array.from({ length: 9 }, (_, offset) => (boxRow * 3 + Math.floor(offset / 3)) * 9 + boxColumn * 3 + offset % 3));
    }
  }
  for (const group of groups) {
    if (new Set(group.map((cell) => solution[cell])).size !== 9) throw new Error("Generated solution is invalid");
  }
}

const start = argument("start", new Date().toISOString().slice(0, 10));
const days = Number(argument("days", "120"));
if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !Number.isInteger(days) || days < 1 || days > 366) {
  throw new Error("Use --start=YYYY-MM-DD and --days=1..366");
}

const statements = ["BEGIN TRANSACTION;"];
const seen = new Set();
for (let index = 0; index < days; index += 1) {
  const date = dateAt(start, index);
  const givens = transform(baseGivens, index);
  const solution = transform(baseSolution, index);
  validate(givens, solution);
  if (seen.has(givens)) throw new Error(`Duplicate generated puzzle at ${date}`);
  seen.add(givens);
  const profile = JSON.stringify({ generator: "symmetry_transform", base: "classic-001" }).replaceAll("'", "''");
  statements.push(`INSERT OR IGNORE INTO sudoku_puzzles (id, puzzle_date, difficulty, givens, solution, technique_profile_json, source_type, source_reference, validation_version, status, published_at) VALUES ('daily-${date}', '${date}', 'medium', '${givens}', '${solution}', '${profile}', 'internal_generated', 'puzzgrind-generator-v1:${date}', 'solver-v1', 'published', unixepoch());`);
}
statements.push("COMMIT;");
const sql = `${statements.join("\n")}\n`;
const output = argument("output", "");
if (output) {
  writeFileSync(output, sql, "utf8");
  console.error(`Validated ${days} unique daily puzzles and wrote ${output}`);
} else {
  process.stdout.write(sql);
}
import { writeFileSync } from "node:fs";
