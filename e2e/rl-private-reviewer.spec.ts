import { expect, test } from "@playwright/test";
import { existsSync } from "node:fs";

const queuePath = process.env.RL_REVIEW_QUEUE_PATH;
const momentsPath = process.env.RL_REVIEW_MOMENTS_PATH;
const authHeaders = (email: string, id: string, name: string) => ({
  "oai-authenticated-user-email": email,
  "oai-authenticated-user-id": id,
  "oai-authenticated-user-full-name": encodeURIComponent(name),
  "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
});

test("locked private set supports a blind autosaved first judgment end to end", async ({ browser, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One real desktop reviewer journey covers the shared responsive workflow.");
  test.skip(!queuePath || !momentsPath || !existsSync(queuePath) || !existsSync(momentsPath), "Pass the two private artifact paths to run the owner-authorized reviewer journey.");

  const runId = `${Date.now()}-${testInfo.workerIndex}`;
  const owner = await browser.newContext({ extraHTTPHeaders: authHeaders("owner@example.invalid", "e2e-owner", "E2E Owner") });
  const ownerPage = await owner.newPage();
  await ownerPage.goto("/");
  const importResponse = await ownerPage.request.post("/api/admin/rl-review-queue", {
    headers: { Origin: baseURL! },
    multipart: {
      queue: { name: "opportunity-review-queue.json.gz", mimeType: "application/gzip", buffer: await import("node:fs/promises").then(fs => fs.readFile(queuePath!)) },
      moments: { name: "opportunity-review-moments.json.gz", mimeType: "application/gzip", buffer: await import("node:fs/promises").then(fs => fs.readFile(momentsPath!)) },
    },
  });
  expect(importResponse.ok(), await importResponse.text()).toBeTruthy();
  const imported = await importResponse.json() as { imported: number; replayCount: number; holdoutOverlapCount: number };
  expect(imported).toMatchObject({ imported: 343, replayCount: 85, holdoutOverlapCount: 0 });

  const reviewerEmail = `reviewer-${runId}@example.invalid`;
  const reviewer = await browser.newContext({ extraHTTPHeaders: authHeaders(reviewerEmail, `e2e-reviewer-${runId}`, "E2E Reviewer") });
  const reviewPage = await reviewer.newPage();
  await reviewPage.goto("/admin/rl-review");
  await expect(reviewPage.getByText("Your reviewer request is recorded.")).toBeVisible();

  const reviewerListResponse = await ownerPage.request.get("/api/admin/rl-reviewers");
  expect(reviewerListResponse.ok(), await reviewerListResponse.text()).toBeTruthy();
  const reviewerList = await reviewerListResponse.json() as { reviewers: Array<{ id: number; email: string }> };
  const reviewerId = reviewerList.reviewers.find(item => item.email === reviewerEmail)?.id;
  expect(reviewerId).toBeTruthy();
  const approvalResponse = await ownerPage.request.patch("/api/admin/rl-reviewers", {
    headers: { Origin: baseURL!, "Content-Type": "application/json" },
    data: {
      id: reviewerId,
      status: "active",
      qualification: "competitive_player",
      platform: "epic",
      qualificationNotes: "E2E stable identity and playlist scope verification; test reviewer only.",
      qualificationConfirmed: true,
      playlistQualifications: Object.fromEntries(["1v1", "2v2", "3v3"].map(mode => [mode, { currentRank: "Champion II", highestRank: "Grand Champion II" }])),
    },
  });
  expect(approvalResponse.ok(), await approvalResponse.text()).toBeTruthy();

  await reviewPage.reload();
  await expect(reviewPage.getByText("0 / 172")).toBeVisible();
  await expect(reviewPage.getByText("0 / 343 overall")).toBeVisible();
  const firstCandidate = reviewPage.locator(".rl-candidate").first();
  await expect(firstCandidate.getByText("BLIND GAMEPLAY CANDIDATE")).toBeVisible();
  await expect(firstCandidate.getByLabel("Detector observation revealed after lock")).toHaveCount(0);
  await firstCandidate.getByLabel("GAMEPLAY TRUTH").selectOption("present");
  await expect(firstCandidate.getByText("Draft autosaved · safe to resume later")).toBeVisible();

  await reviewPage.reload();
  const resumedCandidate = reviewPage.locator(".rl-candidate").first();
  await expect(resumedCandidate.getByLabel("GAMEPLAY TRUTH")).toHaveValue("present");
  await resumedCandidate.getByLabel("TIMESTAMP").selectOption("verified");
  await resumedCandidate.getByLabel("MODE / RANK CONTEXT").selectOption("verified");
  await resumedCandidate.getByLabel("COACHING RELEVANCE").selectOption("actionable");
  reviewPage.once("dialog", dialog => dialog.accept());
  await resumedCandidate.getByRole("button", { name: "Lock independent judgment" }).click();
  await expect(reviewPage.getByText("1 / 172")).toBeVisible();
  await expect(reviewPage.getByText("1 / 343 overall")).toBeVisible();
  const lockedCandidate = reviewPage.locator(".rl-candidate").first();
  await expect(lockedCandidate.getByText("INDEPENDENT JUDGMENT LOCKED")).toBeVisible();
  await expect(lockedCandidate.getByLabel("Detector observation revealed after lock")).toBeVisible();
  await expect(lockedCandidate.getByRole("button", { name: "Lock independent judgment" })).toHaveCount(0);

  await reviewPage.getByLabel("REVIEW PASS").selectOption("2");
  await reviewPage.getByRole("button", { name: "Apply" }).click();
  await expect(reviewPage.getByText("0 / 171")).toBeVisible();
  await expect(reviewPage.getByText("1 / 343 overall")).toBeVisible();

  await owner.close();
  await reviewer.close();
});
