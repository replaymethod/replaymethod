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

  test("the landing page explains one problem, one method and one free next step", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Stop losing for the same reason");
    await expect(page.getByRole("link", { name: /Try the free Climb Check/i })).toBeVisible();
    await expect(page.getByText("Problem. Decision. Next move.")).toBeVisible();
    await expect(page.getByText("No fake “live” labels.")).toBeVisible();
  });

  test("all three games have distinct copy and a usable decision preview", async ({ page }) => {
    const cases = [
      ["/rocket-league", "Your teammate commits", "Rotate through back post"],
      ["/valorant", "You have one flash", "Flash, wait for spacing, then swing"],
      ["/league", "Dragon in 38 seconds", "Reset, then place river vision"],
    ] as const;
    for (const [route, question, answer] of cases) {
      await page.goto(route);
      await expect(page.getByRole("heading", { name: new RegExp(question, "i") })).toBeVisible();
      await page.getByRole("button", { name: answer }).click();
      await expect(page.getByText("THAT'S THE CUE")).toBeVisible();
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
  test("Rocket League PC and console lanes stop before collecting unusable evidence", async ({ page }) => {
    await page.goto("/analyze?game=rocket-league&platform=pc", { waitUntil: "networkidle" });
    await expect(page.getByText(/PC parser is online, but public coaching is still in quality validation/i)).toBeVisible();
    await page.getByRole("button", { name: /PS5/ }).click();
    await expect(page.getByText(/Console video analysis is not live yet/i)).toBeVisible();
    await page.getByLabel("Current rank *").fill("Gold 3");
    await page.getByLabel("Exact in-game player name *").fill("kuxir97");
    await page.getByLabel("What do you want to stop repeating? *").fill("I keep double committing after my teammate challenges.");
    await page.getByRole("button", { name: /CONTINUE/ }).click();
    await expect(page.getByRole("heading", { name: "This lane is not open yet." })).toBeVisible();
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
  });

  test("League and VALORANT are described as official-access requests, not live analysis", async ({ page }) => {
    for (const game of ["league", "valorant"] as const) {
      await page.goto(`/analyze?game=${game}`);
      await expect(page.getByText(/Automated Riot match analysis is not live yet/i)).toBeVisible();
      await expect(page.getByText("WAITLIST", { exact: true })).toBeVisible();
    }
  });

  test("pricing shows totals, renewal cadence and closed checkout", async ({ page }) => {
    await page.goto("/#pricing");
    await expect(page.locator('[data-plan="monthly"]')).toContainText("$6.99 charged today and monthly");
    await expect(page.locator('[data-plan="quarterly"]')).toContainText("$17.99 charged today and at renewal");
    await expect(page.locator('[data-plan="semiannual"]')).toContainText("$28.99 charged today and at renewal");
    await expect(page.getByText("Plan comparison ready. Checkout intentionally closed.")).toBeVisible();
  });

  test("closed analysis API rejects before storing a replay", async ({ request }) => {
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
    expect(response.status()).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringMatching(/validation|closed|available/i) });
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
    test(`${viewport.width}x${viewport.height} keeps critical journeys inside the viewport`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop-chromium", "The matrix runs once in Chromium.");
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
