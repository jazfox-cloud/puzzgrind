import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function lines(path: string) {
  return readFileSync(resolve(root, path), "utf8").trim().split(/\r?\n/u);
}

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

describe("Lexi word-list artifacts", () => {
  it("pins the verified ESDB source and preserved license", () => {
    const source = JSON.parse(readFileSync(resolve(root, "third_party/esdb/SOURCE.json"), "utf8")) as {
      commit: string;
      copyrightSha256: string;
      release: string;
    };
    expect(source.release).toBe("rel-2026.02.25");
    expect(source.commit).toBe("7e99edab8e32f9f9ea2b15f249ca8d4d67237410");
    expect(sha256(readFileSync(resolve(root, "third_party/esdb/Copyright"))))
      .toBe(source.copyrightSha256);
  });

  it("keeps valid guesses private-shaped, sorted, unique, and separate from 180 answer candidates", () => {
    const guesses = lines("data/lexi/esdb-valid-guesses.txt");
    const candidates = lines("data/lexi/answer-candidates.review.txt");
    expect(guesses.length).toBeGreaterThan(1_000);
    expect(guesses).toEqual([...guesses].sort());
    expect(new Set(guesses).size).toBe(guesses.length);
    expect(guesses.every((word) => /^[a-z]{5}$/u.test(word))).toBe(true);
    expect(candidates).toHaveLength(180);
    expect(new Set(candidates).size).toBe(180);
    expect(candidates.every((word) => guesses.includes(word))).toBe(true);
  });

  it("records reproducible counts and hashes", () => {
    const guessesText = readFileSync(resolve(root, "data/lexi/esdb-valid-guesses.txt"), "utf8");
    const report = JSON.parse(readFileSync(resolve(root, "data/lexi/wordlist-report.json"), "utf8")) as {
      artifacts: { validGuessesSha256: string };
      counts: { answerCandidatesForHumanReview: number; validGuesses: number };
    };
    expect(report.counts.validGuesses).toBe(lines("data/lexi/esdb-valid-guesses.txt").length);
    expect(report.counts.answerCandidatesForHumanReview).toBe(180);
    expect(report.artifacts.validGuessesSha256).toBe(sha256(guessesText));
  });

  it("never places a generated lexicon in public", () => {
    expect(() => readFileSync(resolve(root, "public/esdb-valid-guesses.txt"))).toThrow();
    expect(() => readFileSync(resolve(root, "public/answer-candidates.review.txt"))).toThrow();
  });
});
