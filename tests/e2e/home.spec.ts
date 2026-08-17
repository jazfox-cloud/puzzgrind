import { expect, test } from "@playwright/test";

test("shows the PuzzGrind launch page", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Play smarter");
  await expect(page).toHaveTitle("Daily Logic and Word Puzzles | PuzzGrind");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /Lexi Daily/i);
  await expect(page.getByText("Daily logic and word puzzles", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Play Daily Sudoku" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Play Lexi Daily" })).toBeVisible();
  await expect(page.getByText("Hints that teach", { exact: true })).toBeVisible();
  await expect(page.getByText("Learn the move, not just the answer.")).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://puzzgrind.com/");
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", "https://puzzgrind.com/");
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "Daily Logic and Word Puzzles | PuzzGrind");
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  expect(await page.locator('script[type="application/ld+json"]').textContent()).toContain('"@type":"WebSite"');
});

test("keeps the Production homepage canonical on query URLs", async ({ page }) => {
  const response = await page.goto("/?query=params");
  expect(response?.status()).toBe(200);
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://puzzgrind.com/");
});

test("does not load GA4 before a Production visitor chooses analytics", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Accept analytics" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reject analytics" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Privacy settings" })).toBeVisible();
  await expect(page.locator('script[src*="googletagmanager.com"]')).toHaveCount(0);
  await expect(page.locator("script#_next-ga-init")).toHaveCount(0);
});

test("loads GA4 once only after Accept without contacting the test endpoint", async ({ page }) => {
  let googleRequests = 0;
  await page.route("https://www.googletagmanager.com/**", async (route) => {
    googleRequests += 1;
    await route.abort();
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Accept analytics" }).click();
  const loader = page.locator('script[src="https://www.googletagmanager.com/gtag/js?id=G-TESTONLY"]');
  await expect(loader).toHaveCount(1);
  const initializer = page.locator("script#_next-ga-init");
  await expect(initializer).toHaveCount(1);
  expect(await initializer.textContent()).toMatch(
    /gtag\('config',\s*'G-TESTONLY'\s*\)/,
  );
  expect(googleRequests).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem("puzzgrind.analytics-consent.v1"))).toBe("granted");
});

test("keeps GA4 absent after Reject", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Reject analytics" }).click();
  await expect(page.locator('script[src*="googletagmanager.com"]')).toHaveCount(0);
  await expect(page.locator("script#_next-ga-init")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("puzzgrind.analytics-consent.v1"))).toBe("denied");
});

test("serves independent Sudoku metadata and structured data", async ({ page }) => {
  const response = await page.goto("/sudoku");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Daily Sudoku");
  await expect(page).toHaveTitle("Daily Sudoku with Logical Hints | PuzzGrind");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /explainable hints/i);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://puzzgrind.com/sudoku");
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", "https://puzzgrind.com/sudoku");
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  expect(await page.locator('script[type="application/ld+json"]').textContent()).toContain('"@type":"WebApplication"');
});

const dailyPuzzle = {
  puzzleId: "daily-test",
  puzzleDate: "2026-07-14",
  difficulty: "medium",
  givens: "530070000600195000098000060800060003400803001700020006060000280000419005000080079",
  expiresAt: "2026-07-15T00:00:00.000Z",
  boardSize: 9,
};

test("shows the welcome guide once without blocking the puzzle request", async ({ page }) => {
  await page.route("**/api/sudoku/today", (route) => route.fulfill({ json: dailyPuzzle }));
  await page.route("**/api/sudoku/session/start", (route) => route.fulfill({ status: 503, json: { error: "session_start_failed" } }));
  await page.goto("/sudoku");
  await expect(page.getByRole("dialog", { name: "Welcome to PuzzGrind" })).toBeVisible();
  await expect(page.getByRole("grid", { name: "Daily Sudoku board" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start Playing" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Welcome to PuzzGrind" })).toHaveCount(0);
  await page.evaluate(() => localStorage.removeItem("puzzgrind_sudoku_onboarding_seen_v1"));
  await page.reload();
  await page.getByRole("button", { name: "Start Playing" }).click();
  await page.reload();
  await expect(page.getByRole("dialog", { name: "Welcome to PuzzGrind" })).toHaveCount(0);
});

test("recovers from a daily puzzle error and keeps local progress after refresh", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("puzzgrind_sudoku_onboarding_seen_v1", "true"));
  let requests = 0;
  await page.route("**/api/sudoku/today", (route) => {
    requests += 1;
    return requests === 1
      ? route.fulfill({ status: 503, json: { error: "daily_puzzle_unavailable" } })
      : route.fulfill({ json: dailyPuzzle });
  });
  await page.route("**/api/sudoku/session/start", (route) => route.fulfill({ status: 503, json: { error: "session_start_failed" } }));
  await page.goto("/sudoku");
  await expect(page.getByRole("button", { name: "Try Again" })).toBeVisible();
  await page.getByRole("button", { name: "Try Again" }).click();
  const cell = page.getByRole("gridcell", { name: "Row 1, column 3, empty" });
  await cell.click();
  await page.getByRole("button", { name: "7", exact: true }).click();
  await expect(page.getByRole("gridcell", { name: "Row 1, column 3, 7" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("gridcell", { name: "Row 1, column 3, 7" })).toBeVisible();
});

test("analytics rejection does not prevent Sudoku play", async ({ page }) => {
  await page.route("**/api/sudoku/today", (route) => route.fulfill({ json: dailyPuzzle }));
  await page.route("**/api/sudoku/session/start", (route) => route.fulfill({ status: 503, json: { error: "session_start_failed" } }));
  await page.goto("/");
  await page.getByRole("button", { name: "Reject analytics" }).click();
  await page.goto("/sudoku");
  await page.getByRole("button", { name: "Start Playing" }).click();
  await page.getByRole("gridcell", { name: "Row 1, column 3, empty" }).click();
  await page.getByRole("button", { name: "7", exact: true }).click();
  await expect(page.getByRole("gridcell", { name: "Row 1, column 3, 7" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("puzzgrind.analytics-consent.v1"))).toBe("denied");
});

test("reveals one hint in three stages, highlights it, and lets Apply Move be undone", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("puzzgrind_sudoku_onboarding_seen_v1", "true"));
  await page.route("**/api/sudoku/today", (route) => route.fulfill({ json: dailyPuzzle }));
  await page.route("**/api/sudoku/session/start", (route) => route.fulfill({ json: { sessionId: "session-test", sessionToken: "token-test" } }));
  await page.route("**/api/sudoku/session/save", (route) => route.fulfill({ json: { ok: true } }));
  let hintRequests = 0;
  await page.route("**/api/sudoku/hint", (route) => {
    hintRequests += 1;
    return route.fulfill({
      json: {
        hint: {
          candidate: 4,
          explanation: "Look at Row 1. One number has only one possible position.",
          level: 1,
          relatedCells: [0, 1, 3, 4, 5, 6, 7, 8],
          targetCells: [2],
          technique: "hidden_single",
          title: "Hidden Single",
        },
      },
    });
  });

  await page.goto("/sudoku");
  await page.getByRole("button", { name: "Get a hint" }).click();
  await expect(page.getByText("Step 1 of 3 · Hidden Single")).toBeVisible();
  await expect(page.getByRole("gridcell", { name: "Row 1, column 1, 5" })).toHaveClass(/ring-amber-400/);
  await page.getByRole("button", { name: "Show More" }).click();
  await expect(page.getByText("Step 2 of 3 · Hidden Single")).toBeVisible();
  await page.getByRole("button", { name: "Show the Cell" }).click();
  await expect(page.getByText("Step 3 of 3 · Hidden Single")).toBeVisible();
  await expect(page.getByRole("gridcell", { name: "Row 1, column 3, empty" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Apply Move" }).click();
  await expect(page.getByRole("gridcell", { name: "Row 1, column 3, 4" })).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("gridcell", { name: "Row 1, column 3, empty" })).toBeVisible();
  expect(hintRequests).toBe(1);
});

test("verifies completion once, restores it after refresh, and fits the result dialog at 390px", async ({ page }) => {
  const solved = "534678912672195348198342567859761423426853791713924856961537284287419635345286179";
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(({ board }) => {
    localStorage.setItem("puzzgrind_sudoku_onboarding_seen_v1", "true");
    if (!localStorage.getItem("puzzgrind_sudoku_daily-test")) localStorage.setItem("puzzgrind_sudoku_daily-test", JSON.stringify({
      completedResult: null,
      future: [],
      hintCount: 1,
      history: [],
      maxHintLevel: 3,
      mistakes: 0,
      noteMode: false,
      notes: Array.from({ length: 81 }, () => []),
      paused: false,
      puzzleId: "daily-test",
      savedAt: Date.now(),
      seconds: 522,
      selected: 2,
      values: [...board].map((value, index) => index === 2 ? 0 : Number(value)),
      version: 2,
    }));
    if (!localStorage.getItem("puzzgrind_sudoku_engagement_v1")) localStorage.setItem("puzzgrind_sudoku_engagement_v1", JSON.stringify({
      bestStreak: 2,
      completionTime: 600,
      currentStreak: 2,
      feedbackByPuzzleId: {},
      hintsUsed: 0,
      lastCompletedDate: "2026-07-13",
      lastCompletedPuzzleId: "daily-yesterday",
      puzzlesCompleted: 2,
    }));
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (text: string) => { (window as typeof window & { copiedResult?: string }).copiedResult = text; } },
    });
  }, { board: solved });
  await page.route("**/api/sudoku/today", (route) => route.fulfill({ json: dailyPuzzle }));
  await page.route("**/api/sudoku/session/start", (route) => route.fulfill({ json: { sessionId: "session-test", sessionToken: "token-test" } }));
  await page.route("**/api/sudoku/session/save", (route) => route.fulfill({ json: { ok: true } }));
  let completionRequests = 0;
  await page.route("**/api/sudoku/session/complete", (route) => {
    completionRequests += 1;
    return route.fulfill({ json: { result: { durationSeconds: 522, hintCount: 1, maxHintLevel: 3, mistakes: 0 } } });
  });

  await page.goto("/sudoku");
  await page.getByRole("button", { name: "4", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Puzzle complete!" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("08:42")).toBeVisible();
  await expect(dialog.getByText("3 days")).toBeVisible();
  await expect(dialog.getByTestId("tomorrow-countdown")).toHaveText(/^\d{2}:\d{2}:\d{2}$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await dialog.getByRole("button", { name: "Copy Result" }).click();
  await expect(dialog.getByText("Result copied to clipboard.")).toBeVisible();
  expect(await page.evaluate(() => (window as typeof window & { copiedResult?: string }).copiedResult)).toBe(
    "PuzzGrind Daily Sudoku\nSolved in 08:42\nHints used: 1\n🔥 3 day streak\n\nCan you solve today’s puzzle?\nhttps://puzzgrind.com/sudoku",
  );
  await expect.poll(() => page.evaluate(() => {
    const saved = localStorage.getItem("puzzgrind_sudoku_daily-test");
    return saved ? Boolean((JSON.parse(saved) as { completedResult?: unknown }).completedResult) : false;
  })).toBe(true);
  await page.reload();
  await expect(page.getByRole("dialog", { name: "Puzzle complete!" })).toBeVisible();
  expect(completionRequests).toBe(1);
});

test("shows Top 10/20 and lets a completed anonymous player join at 390px with Analytics denied", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const entries = Array.from({ length: 20 }, (_, index) => ({
    displayName: index === 9 ? "VeryLongName-1234" : `Player ${index + 1}`,
    durationSeconds: 90 + index,
    hintsUsed: Math.floor(index / 5),
    isYou: false,
    rank: index + 1,
  }));
  await page.addInitScript(() => {
    localStorage.setItem("puzzgrind_sudoku_onboarding_seen_v1", "true");
    localStorage.setItem("puzzgrind.analytics-consent.v1", "denied");
    localStorage.setItem("puzzgrind_sudoku_daily-test", JSON.stringify({
      completedResult: { durationSeconds: 522, hintCount: 1, maxHintLevel: 3, mistakes: 0 },
      future: [], hintCount: 1, history: [], maxHintLevel: 3, mistakes: 0, noteMode: false,
      notes: Array.from({ length: 81 }, () => []), paused: false, puzzleId: "daily-test",
      savedAt: Date.now(), seconds: 522, selected: null,
      values: [..."534678912672195348198342567859761423426853791713924856961537284287419635345286179"].map(Number),
      version: 2,
    }));
  });
  await page.route("**/api/sudoku/today", (route) => route.fulfill({ json: dailyPuzzle }));
  await page.route("**/api/sudoku/session/start", (route) => route.fulfill({ json: { sessionId: "session-test", sessionToken: "token-test" } }));
  await page.route("**/api/sudoku/leaderboard**", (route) => {
    if (route.request().method() === "POST") return route.fulfill({ status: 201, json: {
      completionCount: 26, entries: entries.map((entry) => entry.rank === 12 ? { ...entry, displayName: "Ada-42", isYou: true } : entry),
      joinedCount: 20, ownRank: 12, puzzleDate: dailyPuzzle.puzzleDate, puzzleId: dailyPuzzle.puzzleId,
    } });
    const expanded = route.request().url().includes("limit=20");
    return route.fulfill({ json: {
      completionCount: 25, entries: entries.slice(0, expanded ? 20 : 10), joinedCount: 20, ownRank: null,
      puzzleDate: dailyPuzzle.puzzleDate, puzzleId: dailyPuzzle.puzzleId,
    } });
  });

  await page.goto("/sudoku");
  await expect(page.getByRole("heading", { name: "Today's Leaderboard" })).toBeVisible();
  await expect(page.getByText("25 completed · 20 joined", { exact: true })).toBeVisible();
  const leaderboardSection = page.locator('section[aria-labelledby="daily-leaderboard-title"]');
  await expect(leaderboardSection.getByRole("listitem")).toHaveCount(10);

  const dialog = page.getByRole("dialog", { name: "Puzzle complete!" });
  await dialog.getByRole("button", { name: "Join today’s leaderboard" }).click();
  await dialog.getByLabel("Anonymous nickname").fill("Ada-42");
  await dialog.getByRole("button", { name: "Submit score" }).click();
  await expect(dialog.getByText("You ranked #12 today")).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Show Top 20" }).click();
  await expect(leaderboardSection.getByRole("listitem")).toHaveCount(20);
  await expect(page.locator('script[src*="googletagmanager.com"]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("keeps the launch page and game within a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("puzzgrind_sudoku_onboarding_seen_v1", "true"));
  await page.route("**/api/sudoku/today", (route) => route.fulfill({ json: dailyPuzzle }));
  await page.route("**/api/sudoku/session/start", (route) => route.fulfill({ status: 503, json: { error: "session_start_failed" } }));
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.goto("/sudoku");
  await expect(page.getByRole("grid", { name: "Daily Sudoku board" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("serves Production robots and the four-URL sitemap", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  const robotsText = await robots.text();
  expect(robotsText).toContain("User-Agent: *");
  expect(robotsText).toContain("Disallow: /api/");
  expect(robotsText).toContain("Disallow: /sudoku/share/");
  expect(robotsText).toContain("Sitemap: https://puzzgrind.com/sitemap.xml");

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  const sitemapText = await sitemap.text();
  expect(sitemapText.match(/<loc>/g)).toHaveLength(4);
  expect(sitemapText).toContain("<loc>https://puzzgrind.com/</loc>");
  expect(sitemapText).toContain("<loc>https://puzzgrind.com/sudoku</loc>");
  expect(sitemapText).toContain("<loc>https://puzzgrind.com/games/lexi-daily</loc>");
  expect(sitemapText).toContain("<loc>https://puzzgrind.com/privacy</loc>");
  expect(sitemapText).not.toContain("/api/");
  expect(sitemapText).not.toContain("/share/");
});

test("serves the indexable privacy information page", async ({ page }) => {
  const response = await page.goto("/privacy");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Privacy and analytics");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://puzzgrind.com/privacy");
  await expect(page.getByText("G-N1NLGSYBKD")).toBeVisible();
  await expect(page.getByRole("button", { name: "Privacy settings" })).toBeVisible();
});

test("serves public brand assets and a noindex 404", async ({ page, request }) => {
  for (const path of ["/favicon.svg", "/icons/icon-192.png", "/icons/apple-touch-icon.png", "/og/puzzgrind-social.png", "/manifest.webmanifest"]) {
    expect((await request.get(path)).status()).toBe(200);
  }
  const response = await page.goto("/missing-seo-page");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("This square is empty");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});
