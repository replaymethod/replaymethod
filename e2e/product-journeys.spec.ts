import { expect, test, type Page } from "@playwright/test";

const publicRoutes = [
  "/",
  "/rocket-league",
  "/valorant",
  "/league",
  "/climb-check",
  "/analyze",
  "/replay-upload",
  "/guides",
  "/privacy",
  "/terms",
  "/beta-terms",
  "/reports",
  "/billing/success",
];

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
  }));
  expect(dimensions.page, `page width ${dimensions.page}px exceeded viewport ${dimensions.viewport}px`).toBeLessThanOrEqual(dimensions.viewport + 1);
}

function collectBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", error => errors.push(error.message));
  return errors;
}

test.describe("first-time visitor funnel", () => {
  for (const route of publicRoutes) {
    test(`${route} renders without overflow or browser errors`, async ({ page }) => {
      const errors = collectBrowserErrors(page);
      const response = await page.goto(route, { waitUntil: "networkidle" });
      expect(response?.status()).toBeLessThan(400);
      await expect(page.locator("main")).toBeVisible();
      await expectNoHorizontalOverflow(page);
      expect(errors).toEqual([]);
    });
  }

  test("the landing page explains one problem and exposes one immediate replay action", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Stop grinding blind/i })).toBeVisible();
    await expect(page.getByText("Drop a replay. Let the match fill in the rest.", { exact: true })).toBeVisible();
    await expect(page.locator('input[type="file"]')).toHaveCount(1);
    await expect(page.getByLabel("Exact in-game name")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /League of Legends|VALORANT/i })).toHaveCount(0);
    await expect(page.getByText("Drop the replay", { exact: true })).toBeVisible();
    await expect(page.getByText("Reveal one pattern", { exact: true })).toBeVisible();
    await expect(page.getByText("Play with one rule", { exact: true })).toBeVisible();
  });

  test("context appears only after an original replay is selected", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.locator('input[type="file"]').setInputFiles({
      name: "representative-match.replay",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("playwright-calibration-fixture"),
    });
    await expect(page.getByLabel("Where should we send your result?")).toBeVisible();
    await expect(page.locator('.quick-check input[type="checkbox"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /Analyze this replay/i })).toBeVisible();
  });

  test("Rocket League is active while League and VALORANT are explicitly deferred", async ({ page }) => {
    await page.goto("/rocket-league");
    await expect(page.locator('input[type="file"]')).toHaveCount(1);
    for (const [route, game] of [["/league", "League of Legends"], ["/valorant", "VALORANT"]] as const) {
      await page.goto(route);
      await expect(page.getByText(`${game.toUpperCase()} · COMING LATER`, { exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: /Evidence before expansion/i })).toBeVisible();
      await expect(page.locator('input[type="file"]')).toHaveCount(0);
    }
  });

  test("the free Climb Check gives a useful result without login or email", async ({ page }) => {
    await page.goto("/climb-check", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Rocket League/ }).click();
    await expect(page.getByRole("heading", { name: /Which one sounds most like your sessions/i })).toBeVisible();
    await page.getByRole("button", { name: /double committing/i }).click();
    await expect(page.getByText("YOUR STARTING HYPOTHESIS")).toBeVisible();
    await expect(page.getByText("YOUR NEXT-QUEUE RULE")).toBeVisible();
    await expect(page.getByText(/based on your answer, not match data/i)).toBeVisible();
  });
});

test.describe("truthful product boundaries", () => {
  test("Rocket League PC accepts original replays while console lanes stop before unusable evidence", async ({ page }) => {
    await page.goto("/analyze?game=rocket-league&platform=pc", { waitUntil: "networkidle" });
    await expect(page.getByText(/Original PC \.replay file when the public quality gate opens/i)).toBeVisible();
    await expect(page.locator('input[type="file"]')).toHaveCount(1);
    await page.getByRole("button", { name: /PS5/ }).click();
    await expect(page.getByText(/Console video analysis is not live yet/i)).toBeVisible();
    await expect(page.getByText("This evidence lane is not open yet.", { exact: true })).toBeVisible();
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
    await expect(page.getByLabel("Current rank *")).toHaveCount(0);
  });

  test("League and VALORANT are described as official-access requests, not live analysis", async ({ page }) => {
    for (const game of ["league", "valorant"] as const) {
      await page.goto(`/analyze?game=${game}`);
      await expect(page.getByText(/Automated Riot match analysis is not live yet/i)).toBeVisible();
      await expect(page.getByText("WAITLIST", { exact: true })).toBeVisible();
    }
  });

  test("the commercial landing does not distract with pricing or checkout", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#pricing")).toHaveCount(0);
    await expect(page.locator('[data-plan="monthly"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: /buy|subscribe|checkout/i })).toHaveCount(0);
  });

  test("invalid analysis API input rejects before storing a replay", async ({ request }) => {
    const response = await request.post("/api/analyses", {
      multipart: {
        game: "rocket-league",
        platform: "pc",
        currentRank: "Gold 3",
        targetRank: "Champion 1",
        playerContext: "kuxir97",
        goal: "Stop double committing in defense",
        email: "qa@example.invalid",
        dataConsent: "true",
        replay: {
          name: "invalid.txt",
          mimeType: "text/plain",
          buffer: Buffer.from("not a replay"),
        },
      },
      headers: { Origin: "http://127.0.0.1:5175" },
    });
    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringMatching(/replay|invalid|original/i) });
  });
});

test.describe("required responsive matrix", () => {
  const viewports = [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 1024, height: 768 },
    { width: 768, height: 1024 },
    { width: 430, height: 932 },
    { width: 390, height: 844 },
    { width: 360, height: 800 },
  ];

  for (const viewport of viewports) {
    test(`${viewport.width}x${viewport.height} keeps critical journeys inside the viewport`, async ({ page }) => {
      await page.setViewportSize(viewport);
      for (const route of ["/", "/rocket-league", "/analyze", "/climb-check"]) {
        await page.goto(route, { waitUntil: "networkidle" });
        await expectNoHorizontalOverflow(page);
        const clipped = await page.evaluate(() => {
          const viewportWidth = document.documentElement.clientWidth;
          return [...document.querySelectorAll<HTMLElement>("button, input, textarea, select")]
            .filter(element => {
              const style = getComputedStyle(element);
              const rect = element.getBoundingClientRect();
              return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0 && (rect.left < -1 || rect.right > viewportWidth + 1);
            })
            .map(element => `${element.tagName.toLowerCase()}.${element.className}`);
        });
        expect(clipped, `${route} clipped controls at ${viewport.width}x${viewport.height}`).toEqual([]);
      }
    });
  }
});
