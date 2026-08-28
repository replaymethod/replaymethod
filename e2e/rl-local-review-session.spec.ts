import { expect, test } from "@playwright/test";

const ownerToken = "e2e-owner-local-review-token-0123456789abcdef";
const reviewerToken = "e2e-reviewer-local-review-token-0123456789abcdef";

async function enterLocalReview(page: import("@playwright/test").Page, identity: { name: string; email: string; token: string }) {
  await page.goto("/local-review-access");
  await page.getByLabel("DISPLAY NAME").fill(identity.name);
  await page.getByLabel("REVIEW IDENTITY EMAIL").fill(identity.email);
  await page.getByLabel("LOCAL ACCESS CODE").fill(identity.token);
  await page.getByRole("button", { name: "OPEN PRIVATE REVIEW" }).click();
}

test("loopback-only local sessions keep owner and two reviewers independent", async ({ browser, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One desktop journey covers the shared local identity boundary.");
  const runId = `${Date.now()}-${testInfo.workerIndex}`;
  const owner = await browser.newContext();
  const reviewerA = await browser.newContext();
  const reviewerB = await browser.newContext();
  const ownerPage = await owner.newPage();
  const reviewerAPage = await reviewerA.newPage();
  const reviewerBPage = await reviewerB.newPage();
  const reviewerAEmail = `local-reviewer-a-${runId}@example.invalid`;
  const reviewerBEmail = `local-reviewer-b-${runId}@example.invalid`;

  await enterLocalReview(ownerPage, { name: "Local Owner", email: `local-owner-${runId}@example.invalid`, token: ownerToken });
  await expect(ownerPage).toHaveURL(/\/local-review-owner$/);
  await expect(ownerPage.getByRole("heading", { name: /Teach the engine/ })).toBeVisible();

  await enterLocalReview(reviewerAPage, { name: "Independent Reviewer A", email: reviewerAEmail, token: reviewerToken });
  await expect(reviewerAPage.getByText("Your reviewer request is recorded.")).toBeVisible();
  await enterLocalReview(reviewerBPage, { name: "Independent Reviewer B", email: reviewerBEmail, token: reviewerToken });
  await expect(reviewerBPage.getByText("Your reviewer request is recorded.")).toBeVisible();

  const reviewerListResponse = await ownerPage.request.get("/api/admin/rl-reviewers");
  expect(reviewerListResponse.ok(), await reviewerListResponse.text()).toBeTruthy();
  const reviewerList = await reviewerListResponse.json() as { reviewers: Array<{ id: number; email: string }> };
  for (const email of [reviewerAEmail, reviewerBEmail]) {
    const reviewerId = reviewerList.reviewers.find(item => item.email === email)?.id;
    expect(reviewerId).toBeTruthy();
    const approval = await ownerPage.request.patch("/api/admin/rl-reviewers", {
      headers: { Origin: baseURL!, "Content-Type": "application/json" },
      data: {
        id: reviewerId,
        status: "active",
        qualification: "competitive_player",
        platform: "epic",
        qualificationNotes: "Local E2E identity boundary verification only; not expert evidence.",
        qualificationConfirmed: true,
        playlistQualifications: Object.fromEntries(["1v1", "2v2", "3v3"].map(mode => [mode, { currentRank: "Champion II", highestRank: "Grand Champion II" }])),
      },
    });
    expect(approval.ok(), await approval.text()).toBeTruthy();
  }

  await reviewerAPage.reload();
  await reviewerBPage.reload();
  await expect(reviewerAPage.getByRole("heading", { name: /Judge the moment/ })).toBeVisible();
  await expect(reviewerBPage.getByRole("heading", { name: /Judge the moment/ })).toBeVisible();

  await reviewerAPage.goto("/local-review-access");
  await expect(reviewerAPage.getByText(reviewerAEmail)).toBeVisible();
  await reviewerAPage.getByRole("button", { name: "END LOCAL SESSION" }).click();
  await expect(reviewerAPage.getByRole("heading", { name: "Enter the private review room." })).toBeVisible();

  await owner.close();
  await reviewerA.close();
  await reviewerB.close();
});
