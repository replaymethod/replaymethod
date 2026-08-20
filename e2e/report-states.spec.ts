import { expect, test } from "@playwright/test";

const reports = {
  loading: "/report/11111111111111111111111111111111",
  blocked: "/report/22222222222222222222222222222222",
  ready: "/report/33333333333333333333333333333333",
  stale: "/report/44444444444444444444444444444444",
  identity: "/report/55555555555555555555555555555555",
};

test.describe("private report states", () => {
  test("active processing communicates the exact stage", async ({ page }) => {
    await page.goto(reports.loading);
    await expect(page.getByText("PROCESSING", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Reading match data" })).toBeVisible();
    await expect(page.getByText("Keep this private link.")).toBeVisible();
  });

  test("a terminal input error explains what happened", async ({ page }) => {
    await page.goto(reports.blocked);
    await expect(page.getByText("PAUSED", { exact: true })).toBeVisible();
    await expect(page.getByText("MATCH COULD NOT BE READ")).toBeVisible();
    await expect(page.getByRole("heading", { name: /could not verify enough evidence/i })).toBeVisible();
  });

  test("a completed report shows one finding, evidence and next rule", async ({ page }) => {
    await page.goto(reports.ready);
    await expect(page.getByText("READY", { exact: true })).toBeVisible();
    await expect(page.getByText("YOUR PRIMARY LEAK")).toBeVisible();
    await expect(page.getByText("At 3:47, both teammates cross the ball line")).toBeVisible();
    await expect(page.getByText(/protect back post until the play resets/i)).toBeVisible();
  });

  test("an interrupted worker never leaves an endless spinner", async ({ page }) => {
    await page.goto(reports.stale);
    await expect(page.getByText("AUTOMATIC RECOVERY STARTED")).toBeVisible();
    await expect(page.getByRole("heading", { name: /took too long/i })).toBeVisible();
    await expect(page.getByText(/do not need to upload the replay again/i)).toBeVisible();
  });

  test("a mismatched player can select a parsed identity without re-uploading", async ({ page }) => {
    let submittedPlayer = "";
    await page.route("**/api/analyses/55555555555555555555555555555555", async route => {
      if (route.request().method() !== "POST") return route.continue();
      submittedPlayer = String((await route.request().postDataJSON()).player || "");
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ queued: true, jobPublicId: "fixture" }) });
    });
    await page.goto(reports.identity);
    await expect(page.getByRole("heading", { name: "Which one is you?" })).toBeVisible();
    await page.getByRole("radio", { name: "Turtle" }).click();
    await page.getByRole("button", { name: /Analyze this saved replay/i }).click();
    await expect.poll(() => submittedPlayer).toBe("Turtle");
    await expect(page.getByRole("heading", { name: "Player selected · replay preserved" })).toBeVisible();
  });
});
