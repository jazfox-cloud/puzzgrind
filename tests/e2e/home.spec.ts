import { expect, test } from "@playwright/test";

test("shows the PuzzGrind launch page", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Play smarter");
  await expect(page).toHaveTitle("Free Daily Sudoku with Hints | PuzzGrind");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /free Daily Sudoku/i);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://puzzgrind.com/");
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", "https://puzzgrind.com/");
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
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
  await expect(page).toHaveTitle("Daily Medium Sudoku — Free Online Puzzle | PuzzGrind");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://puzzgrind.com/sudoku");
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", "https://puzzgrind.com/sudoku");
  expect(await page.locator('script[type="application/ld+json"]').textContent()).toContain('"@type":"WebApplication"');
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
