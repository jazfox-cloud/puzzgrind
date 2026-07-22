import { expect, test } from "@playwright/test";

const daily = { puzzleId: "lexi-e2e", puzzleDate: "2099-07-22", wordLength: 5, maxAttempts: 6,
  expiresAt: "2099-07-23T00:00:00.000Z" };
const absent = ["absent", "absent", "absent", "absent", "absent"];

test("plays, restores, hints, shares, and joins Lexi at mobile width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("puzzgrind.analytics-consent.v1", "denied");
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (text: string) => {
      (window as typeof window & { lexiShare?: string }).lexiShare = text;
    } } });
  });
  const guesses: Array<{ guess: string; evaluation: string[] }> = [];
  let status = "started";
  let hintCount = 0;
  const scores = Array.from({ length: 20 }, (_, index) => ({ attempts: 2 + Math.floor(index / 5),
    completionSeconds: 30 + index, displayName: `Player ${index + 1}`, hints: Math.floor(index / 10),
    isYou: false, rank: index + 1 }));
  await page.route("**/api/lexi/today", (route) => route.fulfill({ json: daily }));
  await page.route("**/api/lexi/session/start", (route) => route.fulfill({ status: guesses.length ? 200 : 201, json: {
    attemptCount: guesses.length, durationSeconds: status === "won" ? 42 : null, guesses, hintCount,
    hintLetter: hintCount ? "v" : null, restored: guesses.length > 0, revision: guesses.length,
    status, token: "opaque-e2e-token",
  } }));
  await page.route("**/api/lexi/leaderboard**", (route) => {
    if (route.request().method() === "POST") return route.fulfill({ status: 201, json: { joinedCount: 1, ownRank: 1,
      entries: [{ attempts: 3, completionSeconds: 42, displayName: "Ada-42", hints: 1, isYou: true, rank: 1 }] } });
    const limit = route.request().url().includes("limit=20") ? 20 : 10;
    return route.fulfill({ json: { joinedCount: 20, ownRank: null, entries: scores.slice(0, limit) } });
  });
  await page.route("**/api/lexi/guess", async (route) => {
    const body = route.request().postDataJSON() as { guess: string };
    const guess = body.guess.toLowerCase();
    if (guess === "xxxxx") return route.fulfill({ status: 422, json: { error: "invalid_word" } });
    if (guesses.some((row) => row.guess === guess)) return route.fulfill({ status: 409, json: { error: "duplicate_guess" } });
    const evaluation = guess === "level" ? ["correct", "correct", "correct", "correct", "correct"] :
      guess === "cigar" ? ["absent", "absent", "absent", "present", "absent"] : absent;
    guesses.push({ guess, evaluation });
    status = guess === "level" ? "won" : "in_progress";
    return route.fulfill({ json: { attemptCount: guesses.length, durationSeconds: status === "won" ? 42 : null,
      evaluation, revision: guesses.length, status } });
  });
  await page.route("**/api/lexi/hint", (route) => { hintCount = 1; return route.fulfill({ json: { hintCount: 1, letter: "v" } }); });

  await page.goto("/games/lexi-daily");
  await expect(page).toHaveTitle(/Lexi Daily/);
  const leaderboard = page.locator('section[aria-labelledby="lexi-leaderboard"]');
  await expect(leaderboard.getByRole("listitem")).toHaveCount(10);
  await page.getByRole("button", { name: "Show Top 20" }).click();
  await expect(leaderboard.getByRole("listitem")).toHaveCount(20);
  await page.getByRole("button", { name: "Start today’s Lexi" }).click();
  await expect(page.getByRole("button", { name: "Start today’s Lexi" })).toHaveCount(0);
  await page.keyboard.type("xxxxx"); await page.keyboard.press("Enter");
  await expect(page.getByText("That word is not in the Lexi word list.")).toBeVisible();
  await page.keyboard.press("Backspace"); await page.keyboard.press("Backspace"); await page.keyboard.press("Backspace"); await page.keyboard.press("Backspace"); await page.keyboard.press("Backspace");
  await page.keyboard.type("cigar"); await page.keyboard.press("Enter");
  await expect(page.getByRole("gridcell", { name: "A, present" })).toBeVisible();
  await page.keyboard.type("cigar"); await page.keyboard.press("Enter");
  await expect(page.getByText("You already tried this word.")).toBeVisible();
  for (let index = 0; index < 5; index += 1) await page.getByRole("button", { name: "Backspace" }).click();
  await page.keyboard.type("rebut"); await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Use my hint" }).click();
  await expect(page.getByRole("button", { name: /Hint: the answer contains V/ })).toBeVisible();
  await page.keyboard.type("level"); await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Lexi solved" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Share result" }).click();
  const shared = await page.evaluate(() => (window as typeof window & { lexiShare?: string }).lexiShare);
  expect(shared).toContain("PuzzGrind / Lexi Daily"); expect(shared).not.toContain("level"); expect(shared).not.toContain("opaque-e2e-token");
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await page.getByLabel("Anonymous nickname").fill("Ada-42");
  await page.getByRole("button", { name: "Join leaderboard" }).click();
  await expect(page.getByText("You ranked #1 today.")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.reload();
  await expect(page.getByRole("dialog", { name: "Lexi solved" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("puzzgrind.analytics-consent.v1"))).toBe("denied");
});

test("closes input on an expired Lexi session without consuming a client attempt", async ({ page }) => {
  await page.route("**/api/lexi/today", (route) => route.fulfill({ json: daily }));
  await page.route("**/api/lexi/leaderboard**", (route) => route.fulfill({ json: { joinedCount: 0, ownRank: null, entries: [] } }));
  await page.route("**/api/lexi/session/start", (route) => route.fulfill({ status: 201, json: { attemptCount: 0,
    durationSeconds: null, guesses: [], hintCount: 0, hintLetter: null, restored: false, revision: 0,
    status: "started", token: "token" } }));
  await page.route("**/api/lexi/guess", (route) => route.fulfill({ status: 409, json: { error: "session_expired" } }));
  await page.goto("/games/lexi-daily"); await page.getByRole("button", { name: "Start today’s Lexi" }).click();
  await expect(page.getByRole("button", { name: "Start today’s Lexi" })).toHaveCount(0);
  await page.keyboard.type("cigar"); await page.keyboard.press("Enter");
  await expect(page.getByText(/expired/)).toBeVisible();
  await expect(page.getByRole("gridcell", { name: "C, not submitted" })).toBeVisible();
});

test("restores a failed game and keeps the desktop result usable", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const guesses = ["cigar", "rebut", "sissy", "humph", "awake", "blush"].map((guess) => ({ guess, evaluation: absent }));
  await page.addInitScript(({ puzzle, rows }) => localStorage.setItem("puzzgrind_lexi_daily_v1", JSON.stringify({
    version: 1, puzzleId: puzzle.puzzleId, puzzleDate: puzzle.puzzleDate, token: "failed-token", revision: 6,
    guesses: rows, hintCount: 0, hintLetter: null, status: "lost", displayName: "Player",
    stats: { bestStreak: 0, currentStreak: 0, lastCompletedDate: null, lastCompletedPuzzleId: null, puzzlesCompleted: 0 },
  })), { puzzle: daily, rows: guesses });
  await page.route("**/api/lexi/today", (route) => route.fulfill({ json: daily }));
  await page.route("**/api/lexi/leaderboard**", (route) => route.fulfill({ json: { joinedCount: 0, ownRank: null, entries: [] } }));
  await page.route("**/api/lexi/session/start", (route) => route.fulfill({ json: { answer: "level", attemptCount: 6,
    durationSeconds: 180, guesses, hintCount: 0, hintLetter: null, restored: true, revision: 6,
    status: "lost", token: "failed-token" } }));
  await page.goto("/games/lexi-daily");
  const dialog = page.getByRole("dialog", { name: "Lexi result" });
  await expect(dialog.getByText(/answer was/i)).toContainText("level");
  await expect(page.getByRole("button", { name: "Join leaderboard" })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
