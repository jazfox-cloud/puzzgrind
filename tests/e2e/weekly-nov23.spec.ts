import { test, expect } from "@playwright/test";

for (const viewport of [{ width: 1280, height: 800 }, { width: 375, height: 812 }]) {
  test(`new guides directory and game at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/guides");
    for (const guide of [
      { title: "Find a Hidden Pair in 6×6 Sudoku", slug: "6x6-sudoku-hidden-pairs" },
      { title: "How Mini Sudoku Saves Your Progress", slug: "mini-sudoku-save-progress" },
    ]) {
      await page.getByRole("link", { name: guide.title, exact: true }).click();
      await expect(page.getByRole("heading", { name: guide.title, exact: true })).toBeVisible();
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://puzzgrind.com/guides/${guide.slug}`);
      await expect(page.getByRole("link", { name: "Mini Sudoku", exact: true }).or(page.getByRole("link", { name: "Play Mini Sudoku", exact: true })).first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
      await page.getByRole("link", { name: "Articles", exact: true }).first().click();
    }
    await page.getByRole("link", { name: "How Mini Sudoku Saves Your Progress", exact: true }).click();
    await page.getByRole("link", { name: "Mini Sudoku", exact: true }).first().click();
    await expect(page.getByRole("heading", { name: "Mini Sudoku", exact: true })).toBeVisible();
  });
}

test("Mini Sudoku restores a board and notes but not undo history", async ({ page }) => {
  await page.goto("/games/mini-sudoku");
  await page.getByRole("button", { name: "Row 1, column 2, empty" }).click();
  await page.getByRole("button", { name: "Notes: off" }).click();
  await page.getByRole("button", { name: "1", exact: true }).click();
  await page.getByRole("button", { name: "Notes: on" }).click();
  await page.getByRole("button", { name: "Row 2, column 2, empty" }).click();
  await page.getByRole("button", { name: "6", exact: true }).click();
  await expect(page.getByRole("button", { name: "Row 2, column 2, value 6" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Row 2, column 2, value 6" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Row 1, column 2, empty, notes 1" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("button", { name: "Reset puzzle" }).click();
  await expect(page.getByRole("button", { name: "Row 2, column 2, value 6" })).toBeVisible();
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Reset puzzle" }).click();
  await expect(page.getByRole("button", { name: "Row 2, column 2, empty" })).toBeVisible();
});

test("Mini Sudoku warns when storage is denied", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { configurable: true, get: () => { throw new Error("denied"); } });
  });
  await page.goto("/games/mini-sudoku");
  await expect(page.getByRole("status")).toContainText("Browser storage is unavailable");
  await page.getByRole("button", { name: "Row 1, column 2, empty" }).click();
  await page.getByRole("button", { name: "1", exact: true }).click();
  await expect(page.getByRole("button", { name: "Row 1, column 2, value 1" })).toBeVisible();
});
