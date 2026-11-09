import { test, expect } from "@playwright/test";

for (const viewport of [{ width: 1280, height: 800 }, { width: 375, height: 812 }]) {
  test(`guide journeys and notes at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/guides");
    await expect(page.getByRole("heading", { name: "Puzzle Articles & Guides" })).toBeVisible();
    await page.getByRole("link", { name: "How to Use Notes in 6×6 Sudoku", exact: true }).click();
    await expect(page.getByRole("heading", { name: "How to Use Notes in 6×6 Sudoku" })).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://puzzgrind.com/guides/6x6-sudoku-notes");
    await expect(page.getByText("row 1, column 2", { exact: false }).first()).toBeVisible();
    await page.getByRole("link", { name: "Find a hidden single" }).click();
    await expect(page.getByRole("heading", { name: "Find a Hidden Single in 6×6 Sudoku" })).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://puzzgrind.com/guides/6x6-sudoku-hidden-single");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await page.getByRole("link", { name: "Play Mini Sudoku", exact: true }).first().click();
    await expect(page.getByRole("heading", { name: "Mini Sudoku", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Row 1, column 2, empty" }).click();
    await page.getByRole("button", { name: "Notes: off" }).click();
    await page.getByRole("button", { name: "1", exact: true }).click();
    await page.getByRole("button", { name: "6", exact: true }).click();
    await expect(page.getByRole("button", { name: "Row 1, column 2, empty, notes 1, 6" })).toBeVisible();
    await page.getByRole("button", { name: "Notes: on" }).click();
    await page.getByRole("button", { name: "Row 2, column 2, empty" }).click();
    await page.getByRole("button", { name: "6", exact: true }).click();
    await expect(page.getByRole("button", { name: "Row 2, column 2, value 6" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Row 1, column 2, empty, notes 1, 6" })).toBeVisible();
  });
}
