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

test("serves independent Sudoku metadata and structured data", async ({ page }) => {
  const response = await page.goto("/sudoku");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("Daily Medium Sudoku — Free Online Puzzle | PuzzGrind");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://puzzgrind.com/sudoku");
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", "https://puzzgrind.com/sudoku");
  expect(await page.locator('script[type="application/ld+json"]').textContent()).toContain('"@type":"WebApplication"');
});

test("serves Production robots and the two-URL sitemap", async ({ request }) => {
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
  expect(sitemapText.match(/<loc>/g)).toHaveLength(2);
  expect(sitemapText).toContain("<loc>https://puzzgrind.com/</loc>");
  expect(sitemapText).toContain("<loc>https://puzzgrind.com/sudoku</loc>");
  expect(sitemapText).not.toContain("/api/");
  expect(sitemapText).not.toContain("/share/");
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
