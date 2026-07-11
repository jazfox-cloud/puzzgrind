import { expect, test } from "@playwright/test";

test("shows the PuzzGrind launch page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Play smarter");
});
