import { readFileSync } from "node:fs";

const BASE_URL = "https://puzzgrind-staging.jazfoxbrook.workers.dev";
const fetchText = async (path) => {
  const response = await fetch(new URL(path, BASE_URL), { signal: AbortSignal.timeout(30_000) });
  return { response, text: await response.text() };
};
const pages = await Promise.all([fetchText("/"), fetchText("/games/lexi-daily")]);
if (pages.some(({ response }) => response.status !== 200)) throw new Error("Could not read Staging HTML");
const html = pages.map(({ text }) => text).join("\n");
const scriptPaths = [...new Set([...html.matchAll(/<script[^>]+src="([^"]+)"/gu)].map((match) => match[1]))];
const scripts = await Promise.all(scriptPaths.map(fetchText));
if (scripts.some(({ response }) => response.status !== 200)) throw new Error("Could not read a referenced client script");
const client = scripts.map(({ text }) => text).join("\n");
const candidates = readFileSync(new URL("../data/lexi/answer-candidates.review.txt", import.meta.url), "utf8")
  .split(/\r?\n/u).map((word) => word.trim()).filter(Boolean);
const candidateRun = JSON.stringify(candidates.slice(0, 20)).slice(1, -1);
const forbiddenPatterns = [
  '"aback","abaft","abase","abash"',
  "VALID_LEXI_GUESS_COUNT",
  candidateRun,
  "answer-candidates.review.txt",
  "esdb-valid-guesses.txt",
];
for (const pattern of forbiddenPatterns) {
  if (html.includes(pattern) || client.includes(pattern)) throw new Error(`Client leak pattern detected: ${pattern.slice(0, 32)}`);
}
if (/sourceMappingURL=/u.test(client)) throw new Error("A client source map reference was deployed");
const privatePaths = [
  "/data/lexi/answer-candidates.review.txt",
  "/data/lexi/esdb-valid-guesses.txt",
  "/answer-candidates.review.txt",
  "/lexi-staging-seed.sql.local",
];
const privateResponses = await Promise.all(privatePaths.map(async (path) => ({ path, status: (await fetch(new URL(path, BASE_URL))).status })));
if (privateResponses.some(({ status }) => status !== 404)) throw new Error("A private Lexi data path is publicly reachable");
const maps = await Promise.all(scriptPaths.slice(0, 5).map(async (path) => (await fetch(new URL(`${path}.map`, BASE_URL))).status));
if (maps.some((status) => status === 200)) throw new Error("A client source map is publicly reachable");
console.log(JSON.stringify({ htmlRscChecked: true, clientScriptsChecked: scriptPaths.length,
  completeLexiconAbsent: true, candidateRunAbsent: true, privatePaths, sourceMapsAbsent: true }, null, 2));
