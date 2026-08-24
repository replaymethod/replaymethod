import { expect, test } from "@playwright/test";

test("verified owner activation produces the dedicated server-session UI state", async ({ page }) => {
  await page.setExtraHTTPHeaders({
    "oai-authenticated-user-email": "owner@example.invalid",
    "oai-authenticated-user-id": "e2e-owner",
  });
  await page.route("**/api/player/owner-qa-session", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "Set-Cookie": "__Host-rm_player_session=e2e; Path=/; HttpOnly; Secure; SameSite=Lax" },
    body: JSON.stringify({ ok: true, ownerQa: true, redirect: "/#replay-upload" }),
  }));
  await page.route("**/api/player/access", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ authenticated: true, ownerQa: true }),
  }));
  await page.goto("/owner-qa");
  await expect(page.getByRole("heading", { name: "Activate owner QA." })).toBeVisible();
  await expect(page.locator('.owner-qa-activate[data-hydrated="true"]')).toBeVisible();
  await page.getByRole("button", { name: /ACTIVATE OWNER QA/ }).click();
  await expect(page).toHaveURL(/\/#replay-upload$/);
  await expect(page.getByText("Drop a replay. Let the match fill in the rest.", { exact: true })).toBeVisible();
});
