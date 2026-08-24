import { expect, test } from "@playwright/test";

const reports = {
  loading: "/report/11111111111111111111111111111111",
  blocked: "/report/22222222222222222222222222222222",
  ready: "/report/33333333333333333333333333333333",
  stale: "/report/44444444444444444444444444444444",
  identity: "/report/55555555555555555555555555555555",
  abstained: "/report/66666666666666666666666666666666",
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

  test("a completed Early Access report separates verified facts, one experimental insight and the next rule", async ({ page }) => {
    await page.goto(reports.ready);
    await expect(page.getByText("READY", { exact: true })).toBeVisible();
    await expect(page.getByText("Invalid Date", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Your match in 20 seconds." })).toBeVisible();
    await expect(page.getByLabel("Evidence status and sample size").getByText("EXPERIMENTAL COACHING", { exact: true })).toBeVisible();
    await expect(page.getByText("FULL MATCH STATS", { exact: true })).toBeVisible();
    await expect(page.getByText("CONFIDENCE & LIMITATIONS", { exact: true })).toBeVisible();
    await expect(page.getByText("THE DECISION TO FIX FIRST", { exact: true })).toBeVisible();
    await expect(page.getByText("YOUR NEXT 3 MATCHES", { exact: true })).toBeVisible();
    await expect(page.getByText("Advanced details", { exact: true })).toBeVisible();
    const sectionOrder = await page.locator("#report-strength, #decision-first, #moments, #action-plan, #performance, #confidence, #feedback").evaluateAll(sections => sections.map(section => section.id));
    expect(sectionOrder).toEqual(["report-strength", "decision-first", "moments", "action-plan", "performance", "confidence", "feedback"]);
    await expect(page.getByText(/not been human-reviewed/i)).toBeVisible();
    await expect(page.getByText("At 3:47, both teammates cross the ball line").first()).toBeVisible();
    await expect(page.getByText(/protect back post until the play resets/i).first()).toBeVisible();
  });

  test("the one-focus action transfers focus once without locking later scrolling", async ({ page }) => {
    await page.goto(reports.ready);
    await page.getByRole("button", { name: /SHOW MY ONE-FOCUS PLAN/ }).click();
    await expect(page.locator("#action-plan")).toBeFocused();
    expect(new URL(page.url()).hash).toBe("");
    const anchored = await page.evaluate(() => window.scrollY);
    await page.keyboard.press("PageDown");
    await page.waitForTimeout(900);
    const after = await page.evaluate(() => window.scrollY);
    expect(after).toBeGreaterThan(anchored + 40);
    expect(new URL(page.url()).hash).toBe("");
  });

  test("an interrupted worker never leaves an endless spinner", async ({ page }) => {
    await page.goto(reports.stale);
    await expect(page.getByText("AUTOMATIC RECOVERY STARTED")).toBeVisible();
    await expect(page.getByRole("heading", { name: /took too long/i })).toBeVisible();
    await expect(page.getByText(/do not need to upload the replay again/i)).toBeVisible();
  });

  test("a successful parse remains a complete report when coaching abstains locally", async ({ page }) => {
    await page.goto(reports.abstained);
    await expect(page.getByText("READY", { exact: true })).toBeVisible();
    await expect(page.getByText("Invalid Date", { exact: true })).toHaveCount(0);
    await expect(page.getByText("FULL MATCH STATS · UNAVAILABLE", { exact: true })).toBeVisible();
    await expect(page.getByText("YOUR NEXT 3 MATCHES · ABSTAINED", { exact: true })).toBeVisible();
    await expect(page.getByText(/did not turn neutral measurements into a fake mistake or generic drill/i)).toBeVisible();
    await expect(page.getByText("EARLY ACCESS PRODUCT FEEDBACK", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Evidence status and sample size").getByText("FACTS ONLY", { exact: true })).toBeVisible();
  });

  test("missing detailed measures keep the Stats destination truthful and navigable", async ({ page }) => {
    await page.goto(reports.abstained);
    await page.getByRole("button", { name: /Stats/ }).click();
    await expect(page.locator("#performance")).toBeFocused();
    await expect(page.getByText("FULL MATCH STATS · UNAVAILABLE", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Detailed match measures were not available/i })).toBeVisible();
    await expect(page.getByText(/did not estimate or fill in missing metrics/i)).toBeVisible();
    await expect(page.getByText("Detailed measures unavailable", { exact: true })).toBeVisible();
    await expect(page.getByText(/No missing match measures were estimated/i)).toBeVisible();
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
    await page.locator(".player-resolution select").selectOption("Champion II");
    await page.getByRole("button", { name: /Analyze this saved replay/i }).click();
    await expect.poll(() => submittedPlayer).toBe("Turtle");
    await expect(page.getByRole("heading", { name: "Player selected · replay preserved" })).toBeVisible();
  });
});
