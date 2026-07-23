import { readFileSync, realpathSync } from "node:fs";
import { relative, resolve } from "node:path";

export function readPrivateLexiQaAnswers(argv = process.argv.slice(2)) {
  const args = argv.filter((value) => value !== "--");
  const index = args.indexOf("--qa-file");
  if (index < 0 || !args[index + 1]) throw new Error("--qa-file is required");
  const privateRoot = resolve(process.cwd(), ".private/lexi-staging");
  const file = realpathSync(resolve(process.cwd(), args[index + 1]));
  const pathFromRoot = relative(privateRoot, file);
  if (pathFromRoot.startsWith("..") || pathFromRoot === "") {
    throw new Error("QA answers must be read from .private/lexi-staging/");
  }
  const parsed = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(parsed.answers) || parsed.answers.length !== 3 ||
    parsed.answers.some((word) => typeof word !== "string" || !/^[a-z]{5}$/u.test(word)) ||
    new Set(parsed.answers).size !== 3) {
    throw new Error("Private Staging QA input must contain exactly three unique lowercase ASCII five-letter answers");
  }
  return parsed.answers;
}
