import { expect, test } from "@playwright/test";

test("shows the PuzzGrind launch page", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Play smarter");
  await expect(page).toHaveTitle("Daily Sudoku with Explainable Hints | PuzzGrind");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /hints that explain/i);
  await expect(page.getByText("Daily Sudoku with explainable hints", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Play Today's Sudoku" })).toBeVisible();
  await expect(page.getByText("Hints that teach", { exact: true })).toBeVisible();
  await expect(page.getByText("Learn the move, not just the answer.")).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://puzzgrind.com/");
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", "https://puzzgrind.com/");
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "Daily Sudoku with Explainable Hints | PuzzGrind");
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  expect(await page.locator('script[type="application/ld+json"]').textContent()).toContain('"@type":"WebSite"');
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

test("serves Production robots and the three-URL sitemap", async ({ request }) => {
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
  expect(sitemapText.match(/<loc>/g)).toHaveLength(3);
  expect(sitemapText).toContain("<loc>https://puzzgrind.com/</loc>");
  expect(sitemapText).toContain("<loc>https://puzzgrind.com/sudoku</loc>");
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
