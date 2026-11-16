import { test, expect } from "@playwright/test";

for (const viewport of [{ width: 1280, height: 800 }, { width: 375, height: 812 }]) {
  test(`new techniques directory and game at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/guides");
    for (const guide of [
      { title: "How to Find a Naked Pair in 6×6 Sudoku", slug: "6x6-sudoku-naked-pairs" },
      { title: "Use Box-Line Elimination in 6×6 Sudoku", slug: "6x6-sudoku-box-line" },
    ]) {
      await page.getByRole("link", { name: guide.title, exact: true }).click();
      await expect(page.getByRole("heading", { name: guide.title, exact: true })).toBeVisible();
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://puzzgrind.com/guides/${guide.slug}`);
      await expect(page.getByRole("link", { name: "Play Mini Sudoku", exact: true }).first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
      await page.getByRole("link", { name: "Articles", exact: true }).first().click();
    }
    await page.getByRole("link", { name: "How to Find a Naked Pair in 6×6 Sudoku", exact: true }).click();
    await page.getByRole("link", { name: "Play Mini Sudoku", exact: true }).first().click();
    await expect(page.getByRole("heading", { name: "Mini Sudoku", exact: true })).toBeVisible();
  });
}
