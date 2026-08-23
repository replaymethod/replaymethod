import { expect, test } from "@playwright/test";

const exactMessage = "Den här mejladressen har redan använt sin kostnadsfria analys.";

test("used-free entitlement is explicit, actionable, and responsive", async ({ page }) => {
  await page.goto("/analyze?game=rocket-league&freeAnalysisUsed=1", { waitUntil: "load" });
  const state = page.getByRole("alert", { name: exactMessage });
  await expect(state).toBeVisible();
  await expect(state.getByRole("heading", { name: exactMessage })).toBeVisible();
  await expect(state).toContainText("Ingen fil laddades upp och ingen ny analys eller allowance skapades.");
  await expect(state.getByRole("link", { name: "Öppna tidigare rapport" })).toHaveAttribute("href", "/reports#report-history");
  await expect(state.getByRole("link", { name: "Verifiera eller logga in" })).toHaveAttribute("href", "/reports#verification");
  await expect(state.getByRole("link", { name: "Visa framtida planer" })).toHaveAttribute("href", "/#pricing");

  const dimensions = await state.evaluate(element => ({
    left: element.getBoundingClientRect().left,
    right: element.getBoundingClientRect().right,
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
  }));
  expect(dimensions.left).toBeGreaterThanOrEqual(-1);
  expect(dimensions.right).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport + 1);
});
