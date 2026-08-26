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
    await expect(page.getByRole("heading", { name: /Replay Method finds the mistake you keep repeating/i })).toBeVisible();
    await expect(page.locator(".reveal-promises")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "You both go. No one covers." })).toBeVisible();
    await expect(page.locator('#ten-replay-start input[type="file"][multiple]')).toHaveCount(1);
    await expect(page.getByRole("button", { name: /League of Legends|VALORANT/i })).toHaveCount(0);
    const startCard = page.locator("#ten-replay-start");
    await expect(startCard.getByText("0/10", { exact: true })).toBeVisible();
    await expect(startCard.getByText("Drop your 10 replays here", { exact: true })).toBeVisible();
    await expect(startCard.getByText(/original PC \.replay files/i)).toBeVisible();
    await expect(startCard.getByText(/Complete|report is ready|10 matches compared/i)).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Open full upload page/ })).toHaveAttribute("href", "/analyze");
    await expect(page.locator(".reveal-faq details")).toHaveCount(5);
  });

  test("the home hero accepts ten replay files without an extra navigation step", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    const startCard = page.locator("#ten-replay-start");
    await expect(startCard).toHaveAttribute("data-hydrated", "true");
    const tenReplays = Array.from({ length: 10 }, (_, index) => ({
      name: `home-match-${String(index + 1).padStart(2, "0")}.replay`,
      mimeType: "application/octet-stream",
      buffer: Buffer.from(`home-direct-selection-${index}`),
    }));
    await page.locator('#ten-replay-start input[type="file"]').setInputFiles(tenReplays);
    await expect(page).toHaveURL(/\/$/);
    await expect(startCard.locator(".reveal-home-files article.ready")).toHaveCount(10);
    await expect(startCard.getByText("10 of 10", { exact: true }).first()).toBeVisible();
    await expect(startCard.getByLabel("Email for your private report")).toBeVisible();
    await expect(startCard.getByLabel("Current playlist rank")).toBeVisible();
    await expect(startCard.getByRole("button", { name: /Verify my 10 replays/i })).toBeEnabled();
    const consentRow = await startCard.locator(".reveal-home-fields .check").boundingBox();
    const submitButton = await startCard.locator(".reveal-home-submit").boundingBox();
    expect(consentRow && submitButton).toBeTruthy();
    expect(submitButton!.y - (consentRow!.y + consentRow!.height)).toBeGreaterThanOrEqual(12);
  });

  test("the illustrative product loop supports autoplay, pointer, keyboard and swipe before opening upload", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    await expectTenReplayStart(page);
    await expect(page.locator(".reveal-review-controls")).toHaveCount(0);
    await expect(page.locator(".reveal-legend")).toHaveCount(0);
    await expect(page.locator(".reveal-goal")).toHaveCount(2);
    await expect(page.locator(".reveal-goal-arc")).toHaveCount(2);
    await expect(page.locator(".reveal-pitch")).toHaveCount(1);
    await expect(page.locator(".reveal-pitch-boundary")).toHaveCount(1);
    await expect(page.locator(".reveal-car")).toHaveCount(4);
    await expect(page.locator(".car-you span")).toHaveCount(0);
    expect(await page.locator(".car-you").evaluate(element => getComputedStyle(element, "::after").content)).toBe("none");
    expect(await page.locator(".car-you").evaluate(element => getComputedStyle(element, "::before").content)).not.toBe("none");
    const goldOutline = await page.locator(".car-you").evaluate(element => getComputedStyle(element).boxShadow);
    expect(goldOutline).toContain("8, 17, 27");
    expect(goldOutline).toContain("255, 224, 106");
    expect(goldOutline).not.toContain("255, 247, 194");
    await expect(page.locator(".reveal-zone, .reveal-path")).toHaveCount(0);
    await expect(page.locator(".reveal-motion-trail")).toHaveCount(0);
    await expect(page.locator(".reveal-ball-trail")).toHaveCount(0);
    await expect(page.locator(".reveal-restart")).toHaveCount(1);
    await page.locator("#product").scrollIntoViewIfNeeded();
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
    await page.getByRole("tab", { name: /^01 / }).click();
    await expect(page.getByRole("tab", { name: /^01 / })).toHaveAttribute("aria-selected", "true");
    await page.waitForTimeout(800);
    const setupField = await page.locator(".reveal-field").boundingBox();
    const setupBall = await page.locator(".reveal-ball").boundingBox();
    const setupUser = await page.locator(".car-you").boundingBox();
    const setupMate = await page.locator(".car-mate").boundingBox();
    const pitch = await page.locator(".reveal-pitch").boundingBox();
    const pitchBoundary = await page.locator(".reveal-pitch-boundary").boundingBox();
    const leftGoal = await page.locator(".reveal-goal-left").boundingBox();
    const rightGoal = await page.locator(".reveal-goal-right").boundingBox();
    const leftGoalArc = await page.locator(".reveal-goal-arc-left").boundingBox();
    const pitchClipPath = await page.locator(".reveal-pitch-boundary").evaluate(element => getComputedStyle(element).clipPath);
    expect(setupField && pitch && pitchBoundary && leftGoal && rightGoal && leftGoalArc).toBeTruthy();
    const closeToRatio = (actual: number, expected: number, tolerance = 0.006) => {
      expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
    };
    expect(Math.abs((pitch!.x - setupField!.x) - (pitch!.y - setupField!.y))).toBeLessThanOrEqual(1.5);
    expect(Math.abs((setupField!.x + setupField!.width - pitch!.x - pitch!.width) - (pitch!.y - setupField!.y))).toBeLessThanOrEqual(1.5);
    closeToRatio((pitchBoundary!.x - pitch!.x) / pitch!.width, 880 / (10240 + 2 * 880));
    closeToRatio(pitchBoundary!.width / pitch!.width, 10240 / (10240 + 2 * 880));
    expect(Math.abs(pitchBoundary!.y - pitch!.y)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(pitchBoundary!.height - pitch!.height)).toBeLessThanOrEqual(1.5);
    closeToRatio(leftGoal!.height / pitchBoundary!.height, 1786 / 8192, 0.01);
    closeToRatio(leftGoal!.width / pitch!.width, 880 / (10240 + 2 * 880), 0.012);
    expect(Math.abs(leftGoal!.y + leftGoal!.height / 2 - (pitchBoundary!.y + pitchBoundary!.height / 2))).toBeLessThanOrEqual(1.5);
    expect(Math.abs(rightGoal!.y + rightGoal!.height / 2 - (pitchBoundary!.y + pitchBoundary!.height / 2))).toBeLessThanOrEqual(1.5);
    expect(Math.abs(leftGoalArc!.x - pitchBoundary!.x)).toBeLessThanOrEqual(1.5);
    expect(pitchClipPath).toContain("11.25%");
    expect(pitchClipPath).toContain("14.0625%");
    expect(pitchClipPath).toContain("88.75%");
    expect(pitchClipPath).toContain("85.9375%");
    await page.getByRole("tab", { name: /^02 / }).click();
    await expect(page.getByRole("tab", { name: /^02 / })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#loop-stage-panel")).toContainText("Both of you committed.");
    await page.waitForTimeout(800);
    const mistakeOpponent = await page.locator(".car-opp").boundingBox();
    const mistakeOpponentTwo = await page.locator(".car-opp-two").boundingBox();
    const mistakeBall = await page.locator(".reveal-ball").boundingBox();
    const mistakeUser = await page.locator(".car-you").boundingBox();
    const mistakeMate = await page.locator(".car-mate").boundingBox();
    const mistakeField = await page.locator(".reveal-field").boundingBox();
    expect(setupField && setupBall && setupUser && setupMate && mistakeOpponent && mistakeOpponentTwo && mistakeBall && mistakeUser && mistakeMate && mistakeField).toBeTruthy();
    const centerDistance = (first: NonNullable<typeof mistakeBall>, second: NonNullable<typeof mistakeBall>) => Math.hypot(
      first.x + first.width / 2 - second.x - second.width / 2,
      first.y + first.height / 2 - second.y - second.height / 2,
    );
    const rotationDegrees = async (selector: string) => page.locator(selector).evaluate((element) => {
      const values = getComputedStyle(element).transform.match(/-?\d*\.?\d+/g)?.map(Number) ?? [];
      return Math.atan2(values[1] ?? 0, values[0] ?? 1) * 180 / Math.PI;
    });
    const lowerRightNoseCornerContact = async (selector: string) => page.locator(selector).evaluate((element) => {
      const car = element as HTMLElement;
      const field = car.closest(".reveal-field") as HTMLElement;
      const ball = field.querySelector(".reveal-ball") as HTMLElement;
      const fieldRect = field.getBoundingClientRect();
      const ballRect = ball.getBoundingClientRect();
      const values = getComputedStyle(car).transform.match(/-?\d*\.?\d+/g)?.map(Number) ?? [];
      const [a = 1, b = 0, c = 0, d = 1] = values;
      const carCenterX = fieldRect.left + car.offsetLeft + car.offsetWidth / 2;
      const carCenterY = fieldRect.top + car.offsetTop + car.offsetHeight / 2;
      const cornerX = carCenterX + a * (car.offsetWidth / 2) + c * (car.offsetHeight / 2);
      const cornerY = carCenterY + b * (car.offsetWidth / 2) + d * (car.offsetHeight / 2);
      const ballCenterX = ballRect.left + ballRect.width / 2;
      const ballCenterY = ballRect.top + ballRect.height / 2;
      return {
        surfaceGap: Math.hypot(cornerX - ballCenterX, cornerY - ballCenterY) - ballRect.width / 2,
        horizontalOffset: cornerX - ballCenterX,
        verticalOffset: cornerY - ballCenterY,
      };
    });
    expect(setupUser!.x).toBeLessThan(setupMate!.x - setupField!.width * 0.08);
    expect(setupUser!.y + setupUser!.height).toBeLessThan(setupField!.y + setupField!.height / 2);
    expect(mistakeBall!.x).toBeGreaterThan(setupBall!.x + setupField!.width * 0.015);
    expect(mistakeBall!.y).toBeLessThan(setupBall!.y - setupField!.height * 0.015);
    expect(centerDistance(mistakeUser!, mistakeBall!)).toBeLessThan(centerDistance(setupUser!, setupBall!));
    expect(centerDistance(mistakeMate!, mistakeBall!)).toBeLessThan(centerDistance(setupMate!, setupBall!));
    expect(mistakeUser!.x + mistakeUser!.width).toBeLessThan(mistakeBall!.x);
    expect(mistakeMate!.x + mistakeMate!.width).toBeLessThan(mistakeBall!.x);
    expect(mistakeUser!.x).toBeLessThan(mistakeMate!.x - mistakeField!.width * 0.08);
    expect(centerDistance(mistakeUser!, mistakeMate!)).toBeGreaterThan(mistakeField!.width * 0.08);
    expect(mistakeOpponent!.x).toBeGreaterThan(mistakeBall!.x);
    const mistakeContact = await lowerRightNoseCornerContact(".car-opp");
    expect(mistakeContact.surfaceGap).toBeGreaterThanOrEqual(0);
    expect(mistakeContact.surfaceGap).toBeLessThanOrEqual(2);
    expect(mistakeContact.horizontalOffset).toBeGreaterThan(0);
    expect(await rotationDegrees(".car-you")).toBeCloseTo(40, 0);
    expect(await rotationDegrees(".car-mate")).toBeCloseTo(29, 0);
    expect(centerDistance(mistakeOpponent!, mistakeBall!)).toBeLessThan(mistakeField!.width * 0.09);
    await page.getByRole("tab", { name: /^02 / }).press("ArrowRight");
    await expect(page.getByRole("tab", { name: /^03 / })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#loop-stage-panel")).toContainText("Nobody covered the next ball.");
    await expect(page.locator("#loop-stage-panel")).toContainText("shoots toward your open net");
    await page.waitForTimeout(950);
    const consequenceField = await page.locator(".reveal-field").boundingBox();
    const consequenceOpponent = await page.locator(".car-opp").boundingBox();
    const consequenceOpponentTwo = await page.locator(".car-opp-two").boundingBox();
    const consequenceBall = await page.locator(".reveal-ball").boundingBox();
    const consequenceUser = await page.locator(".car-you").boundingBox();
    const consequenceMate = await page.locator(".car-mate").boundingBox();
    expect(mistakeOpponent && consequenceField && consequenceOpponent && consequenceOpponentTwo && consequenceBall && consequenceUser && consequenceMate).toBeTruthy();
    expect(consequenceOpponent!.x).toBeLessThan(mistakeOpponent!.x - consequenceField!.width * 0.05);
    expect(consequenceOpponentTwo!.x).toBeGreaterThan(mistakeOpponentTwo!.x + consequenceField!.width * 0.04);
    expect(consequenceOpponentTwo!.y).toBeGreaterThan(mistakeOpponentTwo!.y + consequenceField!.height * 0.08);
    expect(consequenceBall!.x).toBeLessThan(consequenceOpponent!.x);
    expect(consequenceBall!.x).toBeLessThan(consequenceField!.x + consequenceField!.width * 0.1);
    expect(consequenceBall!.y).toBeGreaterThan(mistakeBall!.y + consequenceField!.height * 0.08);
    expect(consequenceMate!.x).toBeGreaterThan(mistakeBall!.x - consequenceField!.width * 0.02);
    const shotStart = { x: consequenceBall!.x + consequenceBall!.width / 2, y: consequenceBall!.y + consequenceBall!.height / 2 };
    const shotEnd = { x: mistakeBall!.x + mistakeBall!.width / 2, y: mistakeBall!.y + mistakeBall!.height / 2 };
    const userCenterX = consequenceUser!.x + consequenceUser!.width / 2;
    const userShotProgress = (userCenterX - shotStart.x) / (shotEnd.x - shotStart.x);
    const shotYAtUser = shotStart.y + (shotEnd.y - shotStart.y) * userShotProgress;
    expect(consequenceUser!.y + consequenceUser!.height).toBeLessThan(shotYAtUser - 2);
    const demo = page.locator(".reveal-demo");
    await demo.evaluate((element) => {
      const swipe = (type: string, clientX: number) => {
        const event = new Event(type, { bubbles: true });
        Object.defineProperty(event, "changedTouches", { value: [{ clientX }] });
        element.dispatchEvent(event);
      };
      swipe("touchstart", 320);
      swipe("touchend", 120);
    });
    await expect(page.getByRole("tab", { name: /^04 / })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#loop-stage-panel")).toContainText("Run the same moment again.");
    await expect(page.locator(".reveal-field")).toHaveClass(/show-replay-cue/);
    await expect(page.locator(".reveal-restart")).toHaveCSS("animation-name", "reveal-restart-circle");
    await expect(page.locator(".reveal-scene")).toHaveCSS("animation-name", "reveal-restart-scene");
    await expect(page.locator(".reveal-restart-spinner")).toHaveCSS("animation-name", "reveal-restart-spin");
    await expect(page.locator(".reveal-restart-mark")).toHaveCount(1);
    await expect(page.locator(".reveal-restart-mark")).toHaveText("↻");
    await expect(page.locator(".reveal-restart-mark")).toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(page.locator(".reveal-restart-arcs")).toHaveCount(0);
    await expect(page.locator(".reveal-restart-head")).toHaveCount(0);
    await expect(page.locator(".reveal-restart")).toHaveCSS("background-color", "rgba(0, 0, 0, 0.34)");
    await expect(page.locator(".reveal-goal-arc-left")).toHaveCSS("border-top-color", "rgba(255, 255, 255, 0.12)");
    await expect(page.locator(".reveal-goal-arc-right")).toHaveCSS("border-top-color", "rgba(255, 255, 255, 0.12)");
    const restartVeil = await page.locator(".reveal-restart").boundingBox();
    const restartField = await page.locator(".reveal-field").boundingBox();
    expect(restartVeil && restartField).toBeTruthy();
    expect(Math.abs(restartVeil!.x + restartVeil!.width / 2 - restartField!.x - restartField!.width / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(restartVeil!.y + restartVeil!.height / 2 - restartField!.y - restartField!.height / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(restartVeil!.width - restartVeil!.height)).toBeLessThanOrEqual(1);
    expect(restartVeil!.width).toBeLessThan(restartField!.width / 3);
    const restartMark = await page.locator(".reveal-restart-mark").boundingBox();
    expect(restartMark).toBeTruthy();
    expect(Math.abs(restartMark!.x + restartMark!.width / 2 - restartVeil!.x - restartVeil!.width / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(restartMark!.y + restartMark!.height / 2 - restartVeil!.y - restartVeil!.height / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(restartMark!.width - restartMark!.height)).toBeLessThanOrEqual(1);
    const replayMotion = await page.locator(".reveal-restart-spinner").evaluate((element) => {
      const animation = element.getAnimations()[0];
      const effect = animation.effect as KeyframeEffect;
      return {
        duration: effect.getTiming().duration,
        offsets: effect.getKeyframes().map(frame => frame.offset),
      };
    });
    expect(replayMotion.duration).toBe(2000);
    expect(replayMotion.offsets).toEqual([0, 0.25, 0.7, 1]);
    await page.waitForTimeout(950);
    const rewindUser = await page.locator(".car-you").boundingBox();
    const rewindMate = await page.locator(".car-mate").boundingBox();
    const rewindOpponentTwo = await page.locator(".car-opp-two").boundingBox();
    await page.getByRole("tab", { name: /^05 / }).click();
    await page.waitForTimeout(950);
    const decisionOpponent = await page.locator(".car-opp").boundingBox();
    const decisionOpponentTwo = await page.locator(".car-opp-two").boundingBox();
    const decisionBall = await page.locator(".reveal-ball").boundingBox();
    const decisionUser = await page.locator(".car-you").boundingBox();
    const decisionMate = await page.locator(".car-mate").boundingBox();
    expect(rewindUser && rewindMate && rewindOpponentTwo && decisionOpponent && decisionOpponentTwo && decisionBall && decisionUser && decisionMate && consequenceField).toBeTruthy();
    expect(decisionUser!.x).toBeLessThan(rewindUser!.x - consequenceField!.width * 0.07);
    expect(decisionMate!.x).toBeGreaterThan(rewindMate!.x + consequenceField!.width * 0.05);
    expect(rewindMate!.y).toBeLessThan(decisionMate!.y - consequenceField!.height * 0.08);
    expect(decisionOpponentTwo!.x).toBeGreaterThan(rewindOpponentTwo!.x + consequenceField!.width * 0.05);
    expect(decisionOpponent!.x).toBeGreaterThan(decisionBall!.x);
    expect(decisionOpponent!.y).toBeLessThan(decisionBall!.y);
    const decisionContact = await lowerRightNoseCornerContact(".car-opp");
    expect(decisionContact.surfaceGap).toBeGreaterThanOrEqual(0);
    expect(decisionContact.surfaceGap).toBeLessThanOrEqual(2);
    expect(decisionContact.horizontalOffset).toBeGreaterThan(0);
    expect(await rotationDegrees(".car-you")).toBeCloseTo(-6, 0);
    expect(await rotationDegrees(".car-mate")).toBeCloseTo(31, 0);
    expect(await rotationDegrees(".car-opp-two")).toBeCloseTo(135, 0);
    expect(centerDistance(decisionOpponent!, decisionBall!)).toBeLessThan(consequenceField!.width * 0.09);
    await page.getByRole("tab", { name: /^06 / }).click();
    await page.waitForTimeout(950);
    const resultOpponent = await page.locator(".car-opp").boundingBox();
    const resultOpponentTwo = await page.locator(".car-opp-two").boundingBox();
    const resultUser = await page.locator(".car-you").boundingBox();
    const resultBall = await page.locator(".reveal-ball").boundingBox();
    expect(resultOpponent && resultOpponentTwo && resultUser && resultBall).toBeTruthy();
    expect(resultOpponent!.x).toBeGreaterThan(resultBall!.x);
    expect(await rotationDegrees(".car-opp-two")).toBeCloseTo(180, 0);
    expect(resultBall!.x - (resultUser!.x + resultUser!.width)).toBeGreaterThanOrEqual(3);
    expect(resultBall!.x - (resultUser!.x + resultUser!.width)).toBeLessThanOrEqual(6);
    expect(Math.abs((resultBall!.y + resultBall!.height / 2) - (resultUser!.y + resultUser!.height / 2))).toBeLessThanOrEqual(2);
    await expect(page.getByText("Illustrative example, not your analysis.", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: /Open full upload page/ }).click();
    await expect(page).toHaveURL(/\/analyze$/);
  });

  test("local review exposes both demo variants while the public default stays clean", async ({ page }) => {
    await page.goto("/?demoReview=1&demoAutoplay=off", { waitUntil: "load" });
    await page.locator("#product").scrollIntoViewIfNeeded();
    const demo = page.locator(".reveal-demo");
    await expect(page.getByLabel("Local demo review controls")).toBeVisible();
    await expect(demo).toHaveClass(/reveal-variant-tactical/);
    await expect(page.getByRole("button", { name: "Play demo", exact: true })).toBeVisible();
    await page.getByRole("button", { name: /B · Focus mode/ }).click();
    await expect(demo).toHaveClass(/reveal-variant-focus/);
    await expect(page.locator(".reveal-legend")).toHaveCount(0);
  });

  test("the public demo finishes once and then offers replay", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    await page.locator("#product").scrollIntoViewIfNeeded();
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
    await page.waitForTimeout(16_000);
    await expect(page.getByRole("button", { name: "Replay", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toHaveCount(0);
  });

  test("reduced motion keeps the product loop legible without animated state", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/", { waitUntil: "load" });
    await expectTenReplayStart(page);
    await expect(page.getByRole("button", { name: "Play demo", exact: true })).toBeVisible();
    await page.getByRole("link", { name: /Open full upload page/ }).click();
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

  test("a ready ten-match session reopens its private report after reload", async ({ page }) => {
    const saved = {
      batchId: "ready-batch",
      batchToken: "ready-token",
      reportUrl: "/report/ready-batch?token=ready-token",
      validCount: 10,
      targetCount: 10,
      status: "ready",
    };
    await page.addInitScript((value) => localStorage.setItem("replaymethod-ten-replay-batch", JSON.stringify(value)), saved);
    await page.route("**/api/replay-batches", async route => {
      if (route.request().method() === "POST") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(saved) });
      return route.continue();
    });
    await page.route("**/report/ready-batch?token=ready-token", route => route.fulfill({ status: 200, contentType: "text/html", body: "<main>Ready report</main>" }));
    await page.goto("/analyze", { waitUntil: "load" });
    await expect(page.getByText("Your ten-match report is ready.", { exact: true })).toBeVisible();
    const resume = page.getByRole("button", { name: "CONTINUE SAVED REVIEW · 10/10 →" });
    await expect(resume).toBeEnabled();
    await resume.click();
    await expect(page).toHaveURL(/\/report\/ready-batch\?token=ready-token$/);
  });

  test("Rocket League is active while League and VALORANT are explicitly deferred", async ({ page }) => {
    await page.goto("/rocket-league");
    await expect(page.locator('#ten-replay-start input[type="file"][multiple]')).toHaveCount(1);
    await expect(page.getByText("Drop your 10 replays here", { exact: true })).toBeVisible();
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
    await page.getByRole("link", { name: /Open full upload page/ }).click();
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
    await expect(page.getByText("Planned for Premium", { exact: true })).toBeVisible();
    await expect(page.getByText(/up to 35 each week/i)).toBeVisible();
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
    { width: 1366, height: 768 },
    { width: 1280, height: 800 },
    { width: 1024, height: 768 },
    { width: 768, height: 1024 },
    { width: 640, height: 900 },
    { width: 430, height: 932 },
    { width: 390, height: 844 },
    { width: 375, height: 812 },
    { width: 360, height: 800 },
    { width: 320, height: 800 },
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
