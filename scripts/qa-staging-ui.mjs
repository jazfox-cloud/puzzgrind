import { chromium } from "@playwright/test";
import { readPrivateLexiQaAnswers } from "./lib/read-private-lexi-qa.mjs";

const BASE_URL = "https://puzzgrind-staging.jazfoxbrook.workers.dev";
const [qaAnswer] = readPrivateLexiQaAnswers();
const checks = [];
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const browser = await chromium.launch({ headless: true });

async function contextFor(viewport) {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport });
  await context.addInitScript(() => {
    localStorage.setItem("puzzgrind.analytics-consent.v1", "denied");
    localStorage.setItem("puzzgrind_sudoku_onboarding_seen_v1", "true");
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      writeText: async (text) => { window.__qaShare = text; },
    } });
  });
  return context;
}

try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    const context = await contextFor(viewport);
    const page = await context.newPage();
    const errors = [];
    const failedPaths = [];
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 400) failedPaths.push(`${response.status()} ${new URL(response.url()).pathname}`);
    });

    const home = await page.goto("/", { waitUntil: "networkidle" });
    assert(home?.status() === 200, "Home did not return 200");
    assert(await page.getByRole("link", { name: "Play Daily Sudoku" }).isVisible(), "Sudoku home entry missing");
    assert(await page.getByRole("link", { name: "Play Lexi Daily" }).isVisible(), "Lexi home entry missing");
    assert(await page.locator("footer").isVisible(), "Footer missing");
    assert(await page.locator('link[rel="canonical"]').count() === 0, "Staging emitted a Production canonical");
    assert(await page.locator('meta[property="og:url"]').count() === 0, "Staging emitted a Production og:url");
    assert((await page.locator('meta[name="robots"]').getAttribute("content"))?.includes("noindex"), "Staging noindex missing");
    assert((await page.locator('script[type="application/ld+json"]').textContent())?.includes('"@type":"WebSite"'), "Home JSON-LD missing");
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "Home scrolls horizontally");

    await page.goto("/games/lexi-daily", { waitUntil: "networkidle" });
    assert(await page.getByRole("heading", { level: 1, name: "Lexi Daily" }).isVisible(), "Lexi heading missing");
    assert(await page.getByRole("grid", { name: "Lexi guess grid" }).isVisible(), "Lexi grid missing");
    assert(await page.getByRole("button", { name: "Start today’s Lexi" }).isVisible(), "Lexi start unavailable");
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "Lexi scrolls horizontally");
    if (viewport.width === 390) {
      await page.getByRole("button", { name: "Start today’s Lexi" }).click();
      await page.getByText("One letter hint per game", { exact: true }).waitFor({ state: "visible", timeout: 15_000 });
      for (const letter of qaAnswer.toUpperCase()) {
        await page.getByRole("button", { name: letter, exact: true }).click();
      }
      await page.getByRole("button", { name: "Enter", exact: true }).click();
      await page.waitForTimeout(2_000);
      const correctCells = await page.getByRole("gridcell", { name: /correct$/ }).count();
      const liveMessage = (await page.locator('[aria-live="polite"]').first().textContent())?.trim() ?? "";
      assert(correctCells === 5, `Lexi UI submit failed (correct cells: ${correctCells}; message: ${liveMessage || "none"})`);
      const dialog = page.getByRole("dialog", { name: "Lexi solved" });
      await dialog.waitFor({ state: "visible", timeout: 15_000 });
      assert(await page.getByRole("gridcell", { name: "L, correct" }).first().isVisible(), "Lexi state lacks text alternative");
      await dialog.getByRole("button", { name: "Share result" }).click();
      const share = await page.evaluate(() => window.__qaShare);
      assert(typeof share === "string" && share.includes("PuzzGrind / Lexi Daily"), "Lexi share was not copied");
      assert(!share.toLowerCase().includes(qaAnswer) && !share.includes("eyJ"), "Lexi share leaked answer or token-like data");
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("puzzgrind_lexi_daily_v1") ?? "{}"));
      assert(saved.status === "won" && saved.stats?.currentStreak >= 1, "Lexi local streak was not saved");
    }

    await page.goto("/sudoku", { waitUntil: "networkidle" });
    assert(await page.getByRole("heading", { level: 1, name: "Daily Sudoku" }).isVisible(), "Sudoku heading missing");
    assert(await page.getByRole("grid", { name: "Daily Sudoku board" }).isVisible(), "Sudoku board missing");
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "Sudoku scrolls horizontally");
    assert(errors.length === 0, `Browser console errors at ${viewport.width}px: ${errors.join(" | ")}; responses: ${failedPaths.join(" | ")}`);
    checks.push({ viewport: `${viewport.width}x${viewport.height}`, home: true, lexi: true, sudoku: true, horizontalScroll: false });
    await context.close();
  }

  const context = await contextFor({ width: 1440, height: 900 });
  const page = await context.newPage();
  const privacy = await page.goto("/privacy", { waitUntil: "networkidle" });
  assert(privacy?.status() === 200 && await page.getByRole("heading", { level: 1 }).isVisible(), "Privacy page failed");
  const notFound = await page.goto("/qa-not-a-real-page", { waitUntil: "networkidle" });
  assert(notFound?.status() === 404 && await page.getByRole("heading", { level: 1, name: "This square is empty." }).isVisible(), "404 page failed");
  const robots = await (await context.request.get("/robots.txt")).text();
  const sitemap = await (await context.request.get("/sitemap.xml")).text();
  const manifest = await context.request.get("/manifest.webmanifest");
  assert(robots.includes("Disallow: /"), "Staging robots does not block crawling");
  assert((sitemap.match(/<loc>/g) ?? []).length === 4, "Sitemap does not contain four URLs");
  assert(manifest.status() === 200 && (await manifest.json()).name === "PuzzGrind", "Manifest failed");
  checks.push({ privacy: true, notFound: true, robots: true, sitemapUrls: 4, manifest: true });
  await context.close();
} finally {
  await browser.close();
}

console.log(JSON.stringify({ baseUrl: BASE_URL, checks }, null, 2));
