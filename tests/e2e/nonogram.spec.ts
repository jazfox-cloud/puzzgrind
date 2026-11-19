import { expect, test } from "@playwright/test";

import { puzzleForDate, puzzleNumber } from "../../lib/nonogram/calendar";
import { NONOGRAM_COUNTS } from "../../lib/nonogram/copy";

const day = "2026-07-14";
const nextDay = "2026-07-15";

async function denyAnalytics(page: import("@playwright/test").Page) {
  await page.addInitScript(() => localStorage.setItem("puzzgrind.analytics-consent.v1", "denied"));
}

test("serves indexable Daily Nonogram instructions and metadata", async ({ page, request }) => {
  const response = await page.goto("/games/nonogram");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Daily Nonogram");
  await expect(page).toHaveTitle("Daily Nonogram — Picture Logic Puzzle | PuzzGrind");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /5×5 or 10×10/i);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://puzzgrind.com/games/nonogram");
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", "https://puzzgrind.com/games/nonogram");
  await expect(page.getByRole("heading", { name: "How to play Nonogram" })).toBeVisible();
  await expect(page.locator("#faq")).toContainText("00:00 UTC");
  await expect(page.locator("#how-to-play")).toContainText(`${NONOGRAM_COUNTS.five} original 5×5`);
  await expect(page.locator("#faq")).toContainText("How do the row and column numbers work?");
  expect(await page.locator('script[type="application/ld+json"]').allTextContents()).toEqual(expect.arrayContaining([
    expect.stringContaining('"@type":"WebApplication"'),
    expect.stringContaining('"@type":"FAQPage"'),
  ]));
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("<loc>https://puzzgrind.com/games/nonogram</loc>");
});

test("fills, crosses, undoes, redoes, confirms reset, and restores after refresh", async ({ page }) => {
  await denyAnalytics(page);
  await page.clock.install({ time: new Date(`${day}T15:00:00.000Z`) });
  await page.goto("/games/nonogram");
  const puzzle = puzzleForDate(5, day);
  await expect(page.getByTestId("nonogram-date")).toHaveText(`${day} UTC · 5×5 · puzzle ${puzzleNumber(5, day)} of ${NONOGRAM_COUNTS.five}`);
  const filledIndex = puzzle.solution.indexOf(1);
  const emptyIndex = puzzle.solution.indexOf(0);
  const filled = page.locator(`[data-cell-index="${filledIndex}"]`);
  const empty = page.locator(`[data-cell-index="${emptyIndex}"]`);
  await filled.click();
  await expect(filled).toHaveAttribute("aria-label", /filled/);
  await page.getByRole("button", { name: "Cross", exact: true }).click();
  await empty.click();
  await expect(empty).toHaveAttribute("aria-label", /crossed/);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(empty).toHaveAttribute("aria-label", /empty/);
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(empty).toHaveAttribute("aria-label", /crossed/);
  await page.getByRole("button", { name: "Reset" }).click();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(filled).toHaveAttribute("aria-label", /filled/);
  await page.getByRole("button", { name: "Reset" }).click();
  await page.getByRole("dialog", { name: "Reset this puzzle?" }).getByRole("button", { name: "Clear this puzzle" }).click();
  await expect(filled).toHaveAttribute("aria-label", /empty/);
  await expect(page.getByTestId("nonogram-timer")).toHaveText("00:00");
  await page.getByRole("button", { name: "Fill", exact: true }).click();
  await filled.click();
  await expect.poll(() => page.evaluate((id) => {
    const saved = localStorage.getItem("puzzgrind-nonogram-v1");
    return saved?.includes(`"fill"`) && saved.includes(id);
  }, puzzle.id)).toBe(true);
  await page.reload();
  await expect(page.locator(`[data-cell-index="${filledIndex}"]`)).toHaveAttribute("aria-label", /filled/);
});

test("marks a cell from the keyboard and drags a fill onto the next cell", async ({ page }) => {
  await denyAnalytics(page);
  await page.clock.install({ time: new Date(`${day}T15:00:00.000Z`) });
  await page.goto("/games/nonogram");
  const cell = page.locator('[data-cell-index="0"]');
  await cell.focus();
  await cell.press("x");
  await expect(cell).toHaveAttribute("aria-label", /crossed/);
  await cell.press("ArrowRight");
  await page.locator('[data-cell-index="1"]').press("f");
  await expect(page.locator('[data-cell-index="1"]')).toHaveAttribute("aria-label", /filled/);
  const start = page.locator('[data-cell-index="2"]');
  const end = page.locator('[data-cell-index="3"]');
  await start.hover();
  await page.mouse.down();
  await end.hover();
  await page.mouse.up();
  await expect(start).toHaveAttribute("aria-label", /filled/);
  await expect(end).toHaveAttribute("aria-label", /filled/);
});

test("completes the 5×5, keeps the result, and switches to an empty 10×10", async ({ page }) => {
  await denyAnalytics(page);
  await page.clock.install({ time: new Date(`${day}T15:00:00.000Z`) });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/games/nonogram");
  const puzzle = puzzleForDate(5, day);
  for (let index = 0; index < puzzle.solution.length; index += 1) {
    if (puzzle.solution[index] === 1) await page.locator(`[data-cell-index="${index}"]`).click();
  }
  const dialog = page.getByRole("dialog", { name: "Puzzle complete" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(/\d{2}:\d{2}/);
  await dialog.getByRole("button", { name: "View the picture" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Puzzle complete." })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("dialog", { name: "Puzzle complete" })).toBeVisible();
  await page.getByRole("button", { name: "View the picture" }).click();
  await page.getByRole("button", { name: /10×10/ }).click();
  await expect(page.getByTestId("nonogram-date")).toContainText("10×10");
  await expect(page.getByRole("dialog", { name: "Puzzle complete" })).toHaveCount(0);
  await expect(page.locator('[data-cell-index="0"]')).toHaveAttribute("aria-label", /empty/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("stores one UTC day and shows the next picture on the next UTC day", async ({ page }) => {
  await denyAnalytics(page);
  await page.clock.install({ time: new Date(`${day}T23:30:00.000Z`) });
  await page.goto("/games/nonogram");
  const today = puzzleForDate(5, day);
  const tomorrow = puzzleForDate(5, nextDay);
  expect(today.id).not.toBe(tomorrow.id);
  const index = today.solution.indexOf(1);
  await page.locator(`[data-cell-index="${index}"]`).click();
  await expect.poll(() => page.evaluate((id) => localStorage.getItem("puzzgrind-nonogram-v1")?.includes(id) ?? false, today.id)).toBe(true);
  await page.clock.setFixedTime(new Date(`${nextDay}T00:30:00.000Z`));
  await page.reload();
  await expect(page.getByTestId("nonogram-date")).toContainText(nextDay);
  await expect(page.locator(`[data-cell-index="${index}"]`)).toHaveAttribute("aria-label", /empty/);
  await page.clock.setFixedTime(new Date(`${day}T23:30:00.000Z`));
  await page.reload();
  await expect(page.locator(`[data-cell-index="${index}"]`)).toHaveAttribute("aria-label", /filled/);
});

test("plays when saved JSON is corrupt and replaces it with a valid save", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("puzzgrind.analytics-consent.v1", "denied");
    if (!sessionStorage.getItem("nonogram-corrupt-seeded")) {
      localStorage.setItem("puzzgrind-nonogram-v1", "{");
      sessionStorage.setItem("nonogram-corrupt-seeded", "1");
    }
  });
  await page.clock.install({ time: new Date(`${day}T15:00:00.000Z`) });
  await page.goto("/games/nonogram");
  await expect(page.getByRole("grid", { name: "Nonogram board, 5 by 5" })).toBeVisible();
  await expect(page.getByText("Browser storage is unavailable")).toHaveCount(0);
  const index = puzzleForDate(5, day).solution.indexOf(1);
  await page.locator(`[data-cell-index="${index}"]`).click();
  await expect(page.locator(`[data-cell-index="${index}"]`)).toHaveAttribute("aria-label", /filled/);
  await expect.poll(() => page.evaluate((cellIndex) => {
    try {
      const file = JSON.parse(localStorage.getItem("puzzgrind-nonogram-v1") ?? "") as { puzzles?: Record<string, { cells?: string[] }> };
      return Object.values(file.puzzles ?? {}).some((puzzle) => puzzle.cells?.[cellIndex] === "fill");
    } catch { return false; }
  }, index)).toBe(true);
  await page.reload();
  await expect(page.locator(`[data-cell-index="${index}"]`)).toHaveAttribute("aria-label", /filled/);
  expect(errors).toEqual([]);
});

test("keeps the board playable when storage methods or the storage object throw", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const deny = () => { throw new DOMException("The operation is insecure.", "SecurityError"); };
    const storage = { getItem: deny, setItem: deny, removeItem: deny, clear: deny, key: deny, length: 0 };
    Object.defineProperty(window, "localStorage", { configurable: true, get: () => storage });
  });
  await page.clock.install({ time: new Date(`${day}T15:00:00.000Z`) });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/games/nonogram");
  const index = puzzleForDate(5, day).solution.indexOf(1);
  const cell = page.locator(`[data-cell-index="${index}"]`);
  await expect(page.getByRole("grid", { name: "Nonogram board, 5 by 5" })).toBeVisible();
  await expect(page.getByText("Browser storage is unavailable. You can play, but progress may not be saved.")).toBeVisible();
  await cell.click();
  await expect(cell).toHaveAttribute("aria-label", /filled/);
  await page.getByRole("button", { name: /^10×10/ }).click();
  await expect(page.getByRole("grid", { name: "Nonogram board, 10 by 10" })).toBeVisible();
  await page.getByRole("button", { name: /^5×5/ }).click();
  await expect(cell).toHaveAttribute("aria-label", /filled/);
  await page.screenshot({ path: "/opt/cursor/artifacts/nonogram-storage-denied-mobile.png", fullPage: false });
  expect(errors).toEqual([]);
});

test("keeps the board playable when reading localStorage itself throws", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() { throw new DOMException("The operation is insecure.", "SecurityError"); },
    });
  });
  await page.clock.install({ time: new Date(`${day}T15:00:00.000Z`) });
  await page.goto("/games/nonogram");
  const index = puzzleForDate(5, day).solution.indexOf(1);
  await expect(page.getByRole("grid", { name: "Nonogram board, 5 by 5" })).toBeVisible();
  await expect(page.getByText("Browser storage is unavailable")).toBeVisible();
  await page.locator(`[data-cell-index="${index}"]`).click();
  await expect(page.locator(`[data-cell-index="${index}"]`)).toHaveAttribute("aria-label", /filled/);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.locator(`[data-cell-index="${index}"]`)).toHaveAttribute("aria-label", /empty/);
  expect(errors).toEqual([]);
});

test("fits the daily board on a phone and a desktop window", async ({ page }) => {
  await denyAnalytics(page);
  await page.clock.install({ time: new Date(`${day}T15:00:00.000Z`) });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/games/nonogram");
  await expect(page.getByRole("grid", { name: /Nonogram board/ })).toBeVisible();
  await page.screenshot({ path: "/opt/cursor/artifacts/nonogram-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: /10×10/ }).click();
  await expect(page.getByRole("grid", { name: "Nonogram board, 10 by 10" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "/opt/cursor/artifacts/nonogram-mobile.png", fullPage: false });
});
