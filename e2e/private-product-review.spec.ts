import { expect, test } from "@playwright/test";

const authHeaders = (email: string, id: string, name: string) => ({
  "oai-authenticated-user-email": email,
  "oai-authenticated-user-id": id,
  "oai-authenticated-user-full-name": encodeURIComponent(name),
  "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
});

const commercialSections = ["Purchase intent", "Conversion", "Free → paid", "Pricing", "Retention", "LTV", "Acquisition", "AI defensibility", "Commercial risks"];
const uxSections = ["Comprehension", "Decisions & clicks", "Feedback speed", "Red thread", "Friction", "App feel", "High-octane simplicity"];

test("commercial product reviewer has separate protected draft, evidence and locked submission", async ({ browser, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One desktop product-review journey covers the shared responsive form.");
  const runId = `${Date.now()}-${testInfo.workerIndex}`;
  const owner = await browser.newContext({ extraHTTPHeaders: authHeaders("owner@example.invalid", "e2e-owner", "E2E Owner") });
  const ownerPage = await owner.newPage();
  await ownerPage.goto("/");
  const reviewerEmail = `commercial-${runId}@example.invalid`;
  const reviewer = await browser.newContext({ extraHTTPHeaders: authHeaders(reviewerEmail, `e2e-commercial-${runId}`, "E2E Commercial Reviewer") });
  const page = await reviewer.newPage();

  await page.goto("/product-review");
  await expect(page.getByText("Your secure review request is recorded.")).toBeVisible();
  const listResponse = await ownerPage.request.get("/api/admin/product-reviewers");
  expect(listResponse.ok(), await listResponse.text()).toBeTruthy();
  const list = await listResponse.json() as { reviewers: Array<{ id: number; email: string }> };
  const reviewerId = list.reviewers.find(item => item.email === reviewerEmail)?.id;
  expect(reviewerId).toBeTruthy();
  const approval = await ownerPage.request.patch("/api/admin/product-reviewers", {
    headers: { Origin: baseURL!, "Content-Type": "application/json" },
    data: { id: reviewerId, status: "active", reviewKind: "commercial" }
  });
  expect(approval.ok(), await approval.text()).toBeTruthy();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Commercial checklist" })).toBeVisible();
  await expect(page.locator('.product-review-form[data-hydrated="true"]')).toBeVisible();
  await expect(page.getByText("Never counted as an RL detector label")).toBeVisible();
  for (const label of commercialSections) {
    await page.getByLabel(`${label} score`).selectOption("4");
    await page.getByLabel(`${label} finding`).fill(`${label} is testable with a concrete observation.`);
  }
  await page.getByLabel("Issue 1 severity").selectOption("high");
  await page.getByLabel("Issue 1 problem").fill("The free-to-paid boundary is not visible in the first real journey.");
  await page.getByLabel("Issue 1 steps").fill("Open the homepage, choose the primary action, then inspect the promised next state.");
  await page.getByLabel("Issue 1 suggestion").fill("Show the first free diagnosis and label the later paid continuation separately.");
  await page.getByLabel("Issue 1 evidence").setInputFiles({ name: "commercial-evidence.png", mimeType: "image/png", buffer: Buffer.from("89504e470d0a1a0a", "hex") });
  await page.getByLabel("Overall recommendation").fill("Keep the first diagnosis free and make continued verification the paid reason to return.");
  await page.getByLabel("Session notes").fill("Desktop Chrome, 1440×900, homepage through the real free path.");
  await page.getByRole("button", { name: "Save private draft" }).click();
  await expect(page.getByText("Private draft saved · safe to resume on another device")).toBeVisible();

  await page.reload();
  await expect(page.locator('.product-review-form[data-hydrated="true"]')).toBeVisible();
  await expect(page.getByLabel("Purchase intent finding")).toHaveValue("Purchase intent is testable with a concrete observation.");
  await expect(page.getByText("Secured privately: commercial-evidence.png")).toBeVisible();
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Submit & lock review" }).click();
  await expect(page.getByText(/Submitted and locked/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit & lock review" })).toHaveCount(0);

  await ownerPage.goto("/admin");
  const reviewerRow = ownerPage.locator(".admin-product-reviewers article").filter({ hasText: reviewerEmail });
  await expect(reviewerRow).toBeVisible();
  await expect(reviewerRow.getByText(/commercial · submitted · 1 evidence files/)).toBeVisible();
  const manifestPath = await reviewerRow.getByRole("link", { name: "Private evidence manifest" }).getAttribute("href");
  expect(manifestPath).toBeTruthy();
  const manifestResponse = await ownerPage.request.get(manifestPath!);
  const manifest = await manifestResponse.json() as { evidence: Array<{ download: string; sha256: string }> };
  expect(manifestResponse.ok(), JSON.stringify(manifest)).toBeTruthy();
  expect(manifest.evidence).toHaveLength(1);
  expect(manifest.evidence[0].sha256).toMatch(/^[a-f0-9]{64}$/);
  const evidenceResponse = await ownerPage.request.get(manifest.evidence[0].download);
  expect(evidenceResponse.ok(), await evidenceResponse.text()).toBeTruthy();
  expect(evidenceResponse.headers()["cache-control"]).toContain("private, no-store");
  const anonymous = await browser.newContext();
  expect((await anonymous.request.get(manifest.evidence[0].download)).status()).toBe(401);
  await anonymous.close();
  const deletion = await ownerPage.request.delete("/api/admin/product-reviewers", {
    headers: { Origin: baseURL!, "Content-Type": "application/json" },
    data: { id: reviewerId, confirmation: "DELETE" }
  });
  const deletionBody = await deletion.json();
  expect(deletion.ok(), JSON.stringify(deletionBody)).toBeTruthy();
  expect(deletionBody).toMatchObject({ deleted: true, evidenceObjectsDeleted: 1 });
  await page.reload();
  await expect(page.getByText("Your secure review request is recorded.")).toBeVisible();
  await owner.close();
  await reviewer.close();
});

test("product review mutation rejects anonymous access", async ({ request, baseURL }) => {
  const response = await request.post("/api/product-review", {
    headers: { Origin: baseURL! },
    multipart: { payload: JSON.stringify({ state: "draft" }) }
  });
  expect(response.status()).toBe(401);
});

test("UX reviewer receives only the separate mobile UX and funnel checklist", async ({ browser, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "The companion mobile path verifies the distinct UX assignment responsively.");
  const runId = `${Date.now()}-${testInfo.workerIndex}`;
  const owner = await browser.newContext({ extraHTTPHeaders: authHeaders("owner@example.invalid", "e2e-owner", "E2E Owner") });
  const ownerPage = await owner.newPage();
  await ownerPage.goto("/");
  const reviewerEmail = `ux-${runId}@example.invalid`;
  const reviewer = await browser.newContext({ extraHTTPHeaders: authHeaders(reviewerEmail, `e2e-ux-${runId}`, "E2E UX Reviewer") });
  const page = await reviewer.newPage();
  await page.goto("/product-review");
  const listResponse = await ownerPage.request.get("/api/admin/product-reviewers");
  const list = await listResponse.json() as { reviewers: Array<{ id: number; email: string }> };
  const reviewerId = list.reviewers.find(item => item.email === reviewerEmail)?.id;
  expect(reviewerId).toBeTruthy();
  const approval = await ownerPage.request.patch("/api/admin/product-reviewers", {
    headers: { Origin: baseURL!, "Content-Type": "application/json" },
    data: { id: reviewerId, status: "active", reviewKind: "ux" }
  });
  expect(approval.ok(), await approval.text()).toBeTruthy();
  await page.reload();
  await expect(page.getByRole("heading", { name: "UX / funnel checklist" })).toBeVisible();
  await expect(page.locator('.product-review-form[data-hydrated="true"]')).toBeVisible();
  for (const label of uxSections) await expect(page.getByLabel(`${label} score`)).toBeVisible();
  await expect(page.getByLabel("Purchase intent score")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy();
  await owner.close();
  await reviewer.close();
});
