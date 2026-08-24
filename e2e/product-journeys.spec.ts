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

test.beforeEach(async ({ page }) => {
  // metadataBase intentionally points at production. Keep local cross-engine
  // checks same-origin-equivalent instead of asking WebKit to fetch production.
  await page.route("https://replaymethod.xyz/manifest.webmanifest", route => route.fulfill({
    status: 200,
    contentType: "application/manifest+json",
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({ name: "Replay Method", start_url: "/" }),
  }));
});

async function expectTenReplayStart(page: Page) {
  await expect(page.locator('main.marcel-home[data-hydrated="true"]')).toBeVisible();
  await expect(page.locator('#ten-replay-start')).toBeVisible();
}

test.describe("first-time visitor funnel", () => {
  for (const route of publicRoutes) {
    test(`${route} renders without overflow or browser errors`, async ({ page }) => {
      const errors = collectBrowserErrors(page);
      const response = await page.goto(route, { waitUntil: "load" });
      expect(response?.status()).toBeLessThan(400);
      await expect(page.locator("main")).toBeVisible();
      await expectNoHorizontalOverflow(page);
      expect(errors).toEqual([]);
    });
  }

  test("the landing page explains one cross-match problem and exposes one immediate replay action", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Upload 10 ranked replays/i })).toBeVisible();
    await expect(page.locator(".marcel-trust-row").getByText("One free 10-match review · Private · No card", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ten matches. One next move." })).toBeVisible();
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: /League of Legends|VALORANT/i })).toHaveCount(0);
    await expect(page.getByText("See what keeps happening", { exact: true })).toBeVisible();
    await expect(page.getByText("Know what to try next", { exact: true })).toBeVisible();
    await expect(page.getByText("Check if it improves", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /Choose 10 replays/ }).first()).toHaveAttribute("href", "/analyze");
    await expect(page.locator(".marcel-faq details")).toHaveCount(5);
  });

  test("the illustrative product loop supports autoplay, pointer, keyboard and swipe before opening upload", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    await expectTenReplayStart(page);
    await page.getByRole("tab", { name: "0–2 SEC", exact: true }).click();
    await expect(page.getByRole("tab", { name: "0–2 SEC", exact: true })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("tab", { name: "2–4 SEC", exact: true }).click();
    await expect(page.getByRole("tab", { name: "2–4 SEC", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#loop-stage-panel")).toContainText("The clear beats both of you.");
    await page.getByRole("tab", { name: "2–4 SEC", exact: true }).press("ArrowRight");
    await expect(page.getByRole("tab", { name: "4–6 SEC", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#loop-stage-panel")).toContainText("You followed too close. Nobody covered the clear.");
    const demo = page.locator(".marcel-demo");
    await demo.evaluate((element) => {
      const swipe = (type: string, clientX: number) => {
        const event = new Event(type, { bubbles: true });
        Object.defineProperty(event, "changedTouches", { value: [{ clientX }] });
        element.dispatchEvent(event);
      };
      swipe("touchstart", 320);
      swipe("touchend", 120);
    });
    await expect(page.getByRole("tab", { name: "6–8 SEC", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#loop-stage-panel")).toContainText("Let them go. Cover what happens next.");
    await expect(page.getByText("NOT YOUR ANALYSIS", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: /Find the mistake I keep repeating/ }).click();
    await expect(page).toHaveURL(/\/analyze$/);
  });

  test("reduced motion keeps the product loop legible without animated state", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/", { waitUntil: "load" });
    await expectTenReplayStart(page);
    await expect(page.locator(".marcel-demo-stages button").first()).toHaveCSS("animation-name", "none");
    await expect(page.locator(".marcel-demo .scan-line")).toHaveCSS("display", "none");
    await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
    await page.getByRole("link", { name: /Find the mistake I keep repeating/ }).click();
    await expect(page).toHaveURL(/\/analyze$/);
  });

  test("the intake requires exactly ten originals and one shared context", async ({ page }) => {
    await page.goto("/analyze", { waitUntil: "load" });
    await expect(page.locator('main.batch-intake-page[data-hydrated="true"]')).toBeVisible();
    await expect(page.locator(".intake-card")).toBeVisible();
    await expect(page.getByText("Choose your ten replays.", { exact: true })).toBeVisible();
    await expect(page.getByLabel("0 of 10 verified replays")).toBeVisible();
    await expect(page.getByText(/same player.*ranked.*playlist/i).first()).toBeVisible();
    await expect(page.getByLabel("Email for the private report *")).toBeVisible();
    await expect(page.getByLabel("Current playlist rank *")).toBeVisible();
    await expect(page.locator('input[type="file"][multiple]')).toHaveCount(1);
    await expect(page.getByRole("button", { name: /VERIFY MY 10 REPLAYS/ })).toBeVisible();
    const uploadLayout = await page.locator(".file-drop").evaluate(element => {
      const label = element.querySelector("b")?.getBoundingClientRect();
      const helper = element.querySelector("small")?.getBoundingClientRect();
      const style = getComputedStyle(element);
      return { display: style.display, direction: style.flexDirection, separation: label && helper ? helper.top - label.bottom : -1 };
    });
    expect(uploadLayout).toMatchObject({ display: "flex", direction: "column" });
    expect(uploadLayout.separation).toBeGreaterThanOrEqual(0);
  });

  test("ten-file selection and drag-and-drop keep good files when one needs replacing", async ({ page }) => {
    await page.goto("/analyze", { waitUntil: "load" });
    await expect(page.locator('main.batch-intake-page[data-hydrated="true"]')).toBeVisible();
    const tenReplays = Array.from({ length: 10 }, (_, index) => ({
      name: `match-${String(index + 1).padStart(2, "0")}.replay`,
      mimeType: "application/octet-stream",
      buffer: Buffer.from(`synthetic-selection-${index}`),
    }));
    await page.locator('input[type="file"]').setInputFiles(tenReplays);
    await expect(page.locator(".batch-file-list article.ready")).toHaveCount(10);
    await expect(page.getByText("10 files ready. Each replay will be verified separately; a rejected file will not remove the others.", { exact: true })).toBeVisible();

    await page.reload({ waitUntil: "load" });
    await expect(page.locator('main.batch-intake-page[data-hydrated="true"]')).toBeVisible();
    await page.locator(".file-drop").evaluate(element => {
      const transfer = new DataTransfer();
      for (let index = 0; index < 9; index += 1) {
        transfer.items.add(new File([`drop-${index}`], `drop-${index + 1}.replay`, { type: "application/octet-stream" }));
      }
      transfer.items.add(new File(["wrong"], "wrong-file.txt", { type: "text/plain" }));
      element.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: transfer }));
    });
    await expect(page.locator(".batch-file-list article.ready")).toHaveCount(9);
    await expect(page.locator(".batch-file-list article.excluded")).toHaveCount(1);
    await expect(page.getByText("Choose original Rocket League .replay files.", { exact: true })).toBeVisible();
    await expect(page.getByText("Choose or drop 1 replacement file", { exact: true })).toBeVisible();

    await page.locator('input[type="file"]').setInputFiles({
      name: "match-10.replay",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("synthetic-selection-10"),
    });
    await expect(page.locator(".batch-file-list article.ready")).toHaveCount(10);
    await expect(page.getByText("10 files ready. Each replay will be verified separately; a rejected file will not remove the others.", { exact: true })).toBeVisible();

    await page.reload({ waitUntil: "load" });
    await expect(page.locator('main.batch-intake-page[data-hydrated="true"]')).toBeVisible();
    await page.locator(".file-drop").evaluate(element => {
      const transfer = new DataTransfer();
      for (let index = 0; index < 10; index += 1) {
        transfer.items.add(new File([`drop-${index}`], `drop-${index + 1}.replay`, { type: "application/octet-stream" }));
      }
      element.dispatchEvent(new DragEvent("dragover", { bubbles: true, dataTransfer: transfer }));
      element.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: transfer }));
    });
    await expect(page.locator(".batch-file-list article.ready")).toHaveCount(10);
    await expect(page.getByText("10 files ready. Each replay will be verified separately; a rejected file will not remove the others.", { exact: true })).toBeVisible();
  });

  test("Rocket League is active while League and VALORANT are explicitly deferred", async ({ page }) => {
    await page.goto("/rocket-league");
    await expect(page.getByRole("link", { name: /Choose 10 replays/ }).first()).toBeVisible();
    for (const [route, game] of [["/league", "League of Legends"], ["/valorant", "VALORANT"]] as const) {
      await page.goto(route);
      await expect(page.getByText(`${game.toUpperCase()} · COMING LATER`, { exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: /Evidence before expansion/i })).toBeVisible();
      await expect(page.locator('input[type="file"]')).toHaveCount(0);
    }
  });

  test("the free Climb Check gives a useful result without login or email", async ({ page }) => {
    await page.goto("/climb-check", { waitUntil: "load" });
    await expect(page.locator('main.tool-page[data-hydrated="true"]')).toBeVisible();
    await page.getByRole("button", { name: /Rocket League/ }).click();
    await expect(page.getByRole("heading", { name: /Which one sounds most like your sessions/i })).toBeVisible();
    await page.getByRole("button", { name: /double committing/i }).click();
    await expect(page.getByText("YOUR STARTING HYPOTHESIS")).toBeVisible();
    await expect(page.getByText("YOUR NEXT-QUEUE RULE")).toBeVisible();
    await expect(page.getByText(/based on your answer, not match data/i)).toBeVisible();
  });
});

test.describe("truthful product boundaries", () => {
  test("Rocket League accepts only original ranked PC replays and makes the boundary explicit", async ({ page }) => {
    await page.goto("/analyze?game=rocket-league&platform=pc", { waitUntil: "load" });
    await expect(page.locator('main.batch-intake-page[data-hydrated="true"]')).toBeVisible();
    await expect(page.locator(".intake-card")).toBeVisible();
    await expect(page.getByText(/ten original ranked PC replays/i).first()).toBeVisible();
    await expect(page.locator('input[type="file"]')).toHaveCount(1);
    await expect(page.getByText(/same ranked 1v1, 2v2 or 3v3 playlist/i)).toBeVisible();
    await expect(page.getByText(/Console video analysis/i)).toHaveCount(0);
  });

  test("landing FAQ explains replacement and abstention without opening another product lane", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    await expectTenReplayStart(page);
    await page.locator("summary").filter({ hasText: "What if one file is invalid?" }).click();
    await expect(page.getByText(/does not consume a valid slot/i)).toBeVisible();
    await page.locator("summary").filter({ hasText: "Why might Replay Method abstain?" }).click();
    await expect(page.getByText(/explains why it cannot name a habit yet/i)).toBeVisible();
  });

  test("the public start link reaches the same 10-replay intake on mobile and desktop", async ({ page }) => {
    await page.goto("/?utm_source=community&token=private", { waitUntil: "load" });
    await expectTenReplayStart(page);
    await page.getByRole("link", { name: /Choose 10 replays/ }).first().click();
    await expect(page).toHaveURL(/\/analyze$/);
    await expect(page.getByRole("heading", { name: /Upload 10 ranked replays/i })).toBeVisible();
    expect(new URL(page.url()).searchParams.has("token")).toBe(false);
  });

  test("League and VALORANT are described as official-access requests, not live analysis", async ({ page }) => {
    for (const game of ["league", "valorant"] as const) {
      await page.goto(`/${game}`);
      await expect(page.getByText(new RegExp(`${game === "league" ? "LEAGUE OF LEGENDS" : "VALORANT"} · COMING LATER`))).toBeVisible();
      await expect(page.getByRole("heading", { name: /Evidence before expansion/i })).toBeVisible();
      await expect(page.locator('input[type="file"]')).toHaveCount(0);
    }
  });

  test("the commercial landing does not distract with pricing or checkout", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#pricing")).toHaveCount(1);
    await expect(page.getByText("PREMIUM · COMING LATER", { exact: true })).toBeVisible();
    await expect(page.getByText(/35 representative replays per week/i)).toBeVisible();
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
        await page.goto(route, { waitUntil: "load" });
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
