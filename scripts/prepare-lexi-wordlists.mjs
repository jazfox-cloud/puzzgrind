import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const EXPECTED = {
  commit: "7e99edab8e32f9f9ea2b15f249ca8d4d67237410",
  copyrightSha256: "090575a131b4260926c7a6b30a90aca0f5db5fbb5c46778e0c5855227bf6ebc3",
  release: "rel-2026.02.25",
};

function argument(name) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? "";
}

function fail(message) {
  throw new Error(`Lexi word-list preparation failed: ${message}`);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function readLines(path) {
  return readFileSync(path, "utf8").split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
}

function sourceRevision(sourceDir) {
  const result = spawnSync("git", ["-C", sourceDir, "rev-parse", "HEAD"], { encoding: "utf8" });
  if (result.status !== 0) fail("the ESDB source must be a Git checkout at the fixed commit");
  return result.stdout.trim();
}

function exportWords(sourceDir, extraArguments) {
  const scowl = resolve(sourceDir, "scowl");
  const database = resolve(sourceDir, "scowl.db");
  if (!existsSync(scowl) || !existsSync(database)) {
    fail("missing scowl or scowl.db; run `make scowl.db` in the fixed ESDB checkout first");
  }
  const noSuggest = "vulgar-1,vulgar-2,vulgar-3,offensive-1,offensive-2,offensive-3";
  const result = spawnSync(scowl, [
    "--db", database,
    "word-list", "60", "A", "1",
    `--nosuggest=${noSuggest}`,
    ...extraArguments,
  ], { cwd: sourceDir, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  if (result.status !== 0) fail(`ESDB export failed: ${result.stderr.trim()}`);

  const entries = new Map();
  let duplicateLines = 0;
  for (const line of result.stdout.split(/\r?\n/u).map((value) => value.trim()).filter(Boolean)) {
    const noSuggestEntry = line.endsWith("/!");
    const word = noSuggestEntry ? line.slice(0, -2) : line;
    if (entries.has(word)) duplicateLines += 1;
    entries.set(word, { noSuggest: noSuggestEntry || entries.get(word)?.noSuggest === true });
  }
  return { duplicateLines, entries };
}

function difference(left, right) {
  return [...left.keys()].filter((word) => !right.has(word)).length;
}

function loadManualExclusions(path) {
  const exclusions = new Map();
  for (const line of readLines(path)) {
    if (line.startsWith("#")) continue;
    const [category, word, extra] = line.split(":");
    if (extra || !["noise", "offensive"].includes(category) || !/^[a-z]{5}$/u.test(word ?? "")) {
      fail(`invalid manual exclusion: ${line}`);
    }
    exclusions.set(word, category);
  }
  return exclusions;
}

const sourceDirArgument = argument("source-dir");
if (!sourceDirArgument) fail("use --source-dir=/absolute/path/to/fixed-esdb-checkout");
const sourceDir = resolve(sourceDirArgument);
const projectRoot = resolve(import.meta.dirname, "..");
const sourceCopyright = readFileSync(resolve(sourceDir, "Copyright"));
const committedCopyright = readFileSync(resolve(projectRoot, "third_party/esdb/Copyright"));

if (sourceRevision(sourceDir) !== EXPECTED.commit) fail(`expected commit ${EXPECTED.commit}`);
if (sha256(sourceCopyright) !== EXPECTED.copyrightSha256) fail("upstream Copyright hash changed; stop for license review");
if (!sourceCopyright.equals(committedCopyright)) fail("the preserved Copyright file differs from upstream");

const defaultExport = exportWords(sourceDir, []);
const withoutAbbreviations = exportWords(sourceDir, ["--wo-poses=abbr"]);
const ordinaryExport = exportWords(sourceDir, ["--wo-poses=abbr", "--categories="]);
const manualExclusions = loadManualExclusions(resolve(projectRoot, "data/lexi/manual-exclusions.txt"));

const filters = {
  abbreviationOrAbbreviationOnly: difference(defaultExport.entries, withoutAbbreviations.entries),
  specialCategoryOnly: difference(withoutAbbreviations.entries, ordinaryExport.entries),
  manualNoise: 0,
  manualOffensive: 0,
  noSuggestOffensive: 0,
  nonAsciiOrDiacritic: 0,
  properCaseOrName: 0,
  punctuationOrCompound: 0,
  wrongLength: 0,
};
const valid = [];

for (const [word, metadata] of ordinaryExport.entries) {
  if (manualExclusions.has(word)) {
    filters[manualExclusions.get(word) === "offensive" ? "manualOffensive" : "manualNoise"] += 1;
  } else if (metadata.noSuggest) {
    filters.noSuggestOffensive += 1;
  } else if (/[A-Z]/u.test(word)) {
    filters.properCaseOrName += 1;
  } else if (/[^\x00-\x7F]/u.test(word)) {
    filters.nonAsciiOrDiacritic += 1;
  } else if (/[-' .]/u.test(word)) {
    filters.punctuationOrCompound += 1;
  } else if (!/^[a-z]{5}$/u.test(word)) {
    filters.wrongLength += 1;
  } else {
    valid.push(word);
  }
}

valid.sort();
const validSet = new Set(valid);
if (validSet.size !== valid.length) fail("valid guess output contains duplicates");

const candidatesPath = resolve(projectRoot, "data/lexi/answer-candidates.review.txt");
const candidates = readLines(candidatesPath).filter((line) => !line.startsWith("#"));
if (candidates.length !== 180 || new Set(candidates).size !== candidates.length) {
  fail("the answer review set must contain exactly 180 unique words");
}
for (const candidate of candidates) {
  if (!/^[a-z]{5}$/u.test(candidate) || !validSet.has(candidate)) {
    fail(`answer candidate is not in the filtered valid guesses: ${candidate}`);
  }
}

const guessesText = `${valid.join("\n")}\n`;
writeFileSync(resolve(projectRoot, "data/lexi/esdb-valid-guesses.txt"), guessesText, "utf8");
const report = {
  source: {
    release: EXPECTED.release,
    commit: EXPECTED.commit,
    copyrightSha256: EXPECTED.copyrightSha256,
    generationCommand: "scowl --db scowl.db word-list 60 A 1 --wo-poses=abbr --categories= --nosuggest=<all-levels>",
  },
  counts: {
    sourceDefaultUnique: defaultExport.entries.size,
    sourceOrdinaryUnique: ordinaryExport.entries.size,
    validGuesses: valid.length,
    answerCandidatesForHumanReview: candidates.length,
  },
  filters,
  duplicateSourceLines: {
    default: defaultExport.duplicateLines,
    ordinary: ordinaryExport.duplicateLines,
  },
  artifacts: {
    validGuessesSha256: sha256(guessesText),
    answerCandidatesSha256: sha256(readFileSync(candidatesPath)),
  },
};
writeFileSync(resolve(projectRoot, "data/lexi/wordlist-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
