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

async function expectLandingFunnel(page: Page) {
  await expect(page.locator('main.marcel-home[data-hydrated="true"]')).toBeVisible();
  await expect(page.locator("main.marcel-home > section")).toHaveCount(5);
  await expect(page.locator(".rm-home-hero-actions").getByRole("link", { name: /Start free analysis/ })).toHaveAttribute("href", "/analyze");
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
    await expect(page.getByRole("heading", { name: /Stop guessing.*decision holding you back/i })).toBeVisible();
    await expect(page.locator(".reveal-promises")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "From replay files to one useful focus." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "One common mistake. Two very different outcomes." })).toBeVisible();
    await expect(page.getByRole("heading", { name: /A pattern needs evidence.*confidence theatre/i })).toBeVisible();
    await expect(page.locator('main.marcel-home input[type="file"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: /League of Legends|VALORANT/i })).toHaveCount(0);
    await expect(page.locator(".rm-home-hero-actions").getByRole("link", { name: /Start free analysis/ })).toHaveAttribute("href", "/analyze");
    await expect(page.locator(".reveal-faq details")).toHaveCount(0);
  });

  test("the home hero leads directly to the focused ten-replay intake", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    await page.locator(".rm-home-hero-actions").getByRole("link", { name: /Start free analysis/ }).click();
    await expect(page).toHaveURL(/\/analyze$/);
    await expect(page.getByText("Choose ten ranked matches.", { exact: true })).toBeVisible();
    await expect(page.locator('input[type="file"][multiple]')).toHaveCount(1);
  });

  test("the illustrative product loop supports autoplay, pointer, keyboard and swipe before opening upload", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    await expectLandingFunnel(page);
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
    // Rendering engines can land the intended tangent contact a few hundredths
    // of a CSS pixel inside the ball after transforms are rasterized.
    expect(mistakeContact.surfaceGap).toBeGreaterThanOrEqual(-0.05);
    expect(mistakeContact.surfaceGap).toBeLessThanOrEqual(2);
    expect(mistakeContact.horizontalOffset).toBeGreaterThan(0);
    expect(await rotationDegrees(".car-you")).toBeCloseTo(33, 0);
    expect(await rotationDegrees(".car-mate")).toBeCloseTo(34, 0);
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
    expect(consequenceOpponent!.y).toBeGreaterThan(mistakeOpponent!.y + consequenceField!.height * 0.08);
    expect(consequenceOpponentTwo!.x).toBeLessThan(mistakeOpponentTwo!.x - consequenceField!.width * 0.02);
    expect(consequenceOpponentTwo!.y).toBeLessThan(mistakeOpponentTwo!.y - consequenceField!.height * 0.03);
    expect(consequenceBall!.x).toBeLessThan(consequenceOpponent!.x);
    expect(consequenceBall!.x).toBeLessThan(consequenceField!.x + consequenceField!.width * 0.1);
    expect(consequenceBall!.y).toBeGreaterThan(mistakeBall!.y + consequenceField!.height * 0.08);
    expect(consequenceMate!.x).toBeGreaterThan(mistakeMate!.x + consequenceField!.width * 0.03);
    expect(consequenceMate!.y).toBeGreaterThan(mistakeMate!.y + consequenceField!.height * 0.06);
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
    await expect(page.locator(".reveal-restart-mark svg")).toHaveCount(1);
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
      const scene = document.querySelector(".reveal-scene")!.getAnimations()[0]?.effect as KeyframeEffect;
      const circle = document.querySelector(".reveal-restart")!.getAnimations()[0]?.effect as KeyframeEffect;
      return {
        duration: effect.getTiming().duration,
        sceneDuration: scene.getTiming().duration,
        circleDuration: circle.getTiming().duration,
        offsets: effect.getKeyframes().map(frame => frame.offset),
      };
    });
    expect(replayMotion.duration).toBe(980);
    expect(replayMotion.sceneDuration).toBe(980);
    expect(replayMotion.circleDuration).toBe(980);
    expect(replayMotion.offsets).toHaveLength(16);
    expect(replayMotion.offsets[0]).toBe(0);
    expect(replayMotion.offsets.at(-1)).toBe(1);
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
    expect(decisionUser!.x).toBeLessThan(rewindUser!.x - consequenceField!.width * 0.05);
    expect(decisionMate!.x).toBeGreaterThan(rewindMate!.x + consequenceField!.width * 0.05);
    expect(rewindMate!.y).toBeLessThan(decisionMate!.y - consequenceField!.height * 0.08);
    expect(decisionOpponentTwo!.x + decisionOpponentTwo!.width / 2).toBeGreaterThan(rewindOpponentTwo!.x + rewindOpponentTwo!.width / 2);
    expect(decisionOpponentTwo!.y).toBeLessThan(rewindOpponentTwo!.y - consequenceField!.height * 0.15);
    expect(decisionOpponent!.x).toBeGreaterThan(decisionBall!.x);
    expect(decisionOpponent!.y).toBeLessThan(decisionBall!.y);
    const decisionContact = await lowerRightNoseCornerContact(".car-opp");
    expect(decisionContact.surfaceGap).toBeGreaterThanOrEqual(-0.05);
    expect(decisionContact.surfaceGap).toBeLessThanOrEqual(2);
    expect(decisionContact.horizontalOffset).toBeGreaterThan(0);
    expect(await rotationDegrees(".car-you")).toBeCloseTo(-6, 0);
    expect(await rotationDegrees(".car-mate")).toBeCloseTo(34, 0);
    expect(await rotationDegrees(".car-opp-two")).toBeCloseTo(-90, 0);
    expect(centerDistance(decisionOpponent!, decisionBall!)).toBeLessThan(consequenceField!.width * 0.09);
    await page.getByRole("tab", { name: /^06 / }).click();
    await page.waitForTimeout(950);
    const resultOpponent = await page.locator(".car-opp").boundingBox();
    const resultOpponentTwo = await page.locator(".car-opp-two").boundingBox();
    const resultUser = await page.locator(".car-you").boundingBox();
    const resultBall = await page.locator(".reveal-ball").boundingBox();
    expect(resultOpponent && resultOpponentTwo && resultUser && resultBall).toBeTruthy();
    expect(resultOpponent!.x).toBeGreaterThan(resultBall!.x);
    expect(await rotationDegrees(".car-opp-two")).toBeCloseTo(-150, 0);
    expect(resultBall!.x - (resultUser!.x + resultUser!.width)).toBeGreaterThanOrEqual(2);
    expect(resultBall!.x - (resultUser!.x + resultUser!.width)).toBeLessThanOrEqual(6);
    expect(Math.abs((resultBall!.y + resultBall!.height / 2) - (resultUser!.y + resultUser!.height / 2))).toBeLessThanOrEqual(2);
    await expect(page.getByText("This demo", { exact: true })).toBeVisible();
    await expect(page.getByText("Your real analysis", { exact: true })).toBeVisible();
    await page.locator(".rm-header-cta").click();
    await expect(page).toHaveURL(/\/analyze$/);
  });

  test("all six stages preserve the sketched replay pairs and nose directions", async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 600, "The reviewed reference captures use the desktop field.");
    await page.goto("/?demoReview=1&demoAutoplay=off", { waitUntil: "load" });
    await page.locator("#product").scrollIntoViewIfNeeded();

    const targets = [
      [[21, 22.8, 0], [31.4, 14.2, 20], [80.5, 13.4, 143], [80.7, 72.7, 275]],
      [[47.5, 26.8, 33], [56.2, 27.7, 34], [66.6, 36.1, 112], [82.9, 50.8, 270]],
      [[51.8, 31.6, 28], [61.2, 39.2, 55], [66.8, 50.4, 90], [79.7, 44.6, 210]],
      [[21, 22.8, 0], [31.4, 14.2, 20], [80.5, 13.4, 143], [80.7, 72.7, 275]],
      [[14.9, 51.9, 354], [56.2, 27.7, 34], [66.6, 36.1, 112], [82.9, 50.8, 270]],
      [[12.2, 50.6, 10], [61.2, 39.2, 55], [66.8, 50.4, 90], [79.7, 44.6, 210]],
    ] as const;
    const captured: number[][][] = [];

    for (const [index, target] of targets.entries()) {
      await page.getByRole("tab", { name: new RegExp(`^0${index + 1} `) }).click();
      await page.waitForTimeout(1000);
      const actual = await page.locator(".reveal-car").evaluateAll((cars) => {
        const field = cars[0]!.closest(".reveal-field") as HTMLElement;
        return cars.map((car) => {
          const element = car as HTMLElement;
          const matrix = getComputedStyle(element).transform.match(/-?\d*\.?\d+/g)?.map(Number) ?? [];
          const degrees = (Math.atan2(matrix[1] ?? 0, matrix[0] ?? 1) * 180 / Math.PI + 360) % 360;
          return [element.offsetLeft / field.clientWidth * 100, element.offsetTop / field.clientHeight * 100, degrees];
        });
      });
      captured.push(actual);

      for (const [carIndex, expected] of target.entries()) {
        expect(actual[carIndex]![0]).toBeCloseTo(expected[0], 0);
        expect(actual[carIndex]![1]).toBeCloseTo(expected[1], 0);
        const angleGap = Math.abs(actual[carIndex]![2] - expected[2]);
        expect(Math.min(angleGap, 360 - angleGap)).toBeLessThanOrEqual(1);
      }
    }

    const expectSameCar = (firstStage: number, secondStage: number, carIndex: number) => {
      expect(captured[firstStage]![carIndex]![0]).toBeCloseTo(captured[secondStage]![carIndex]![0], 1);
      expect(captured[firstStage]![carIndex]![1]).toBeCloseTo(captured[secondStage]![carIndex]![1], 1);
      const angleGap = Math.abs(captured[firstStage]![carIndex]![2] - captured[secondStage]![carIndex]![2]);
      expect(Math.min(angleGap, 360 - angleGap)).toBeLessThanOrEqual(1);
    };
    [0, 1, 2, 3].forEach(carIndex => expectSameCar(0, 3, carIndex));
    [1, 2, 3].forEach(carIndex => expectSameCar(1, 4, carIndex));
    [1, 2, 3].forEach(carIndex => expectSameCar(2, 5, carIndex));
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
    await expectLandingFunnel(page);
    await expect(page.getByRole("button", { name: "Play demo", exact: true })).toBeVisible();
    await page.locator(".rm-home-hero-actions").getByRole("link", { name: /Start free analysis/ }).click();
    await expect(page).toHaveURL(/\/analyze$/);
  });

  test("the intake requires exactly ten originals and one shared context", async ({ page }) => {
    await page.goto("/analyze", { waitUntil: "load" });
    await expect(page.locator('main.batch-intake-page[data-hydrated="true"]')).toBeVisible();
    await expect(page.locator(".intake-card")).toBeVisible();
    await expect(page.getByText("Choose ten ranked matches.", { exact: true })).toBeVisible();
    await expect(page.getByLabel("0 of 10 verified replays")).toBeVisible();
    await expect(page.getByText(/same player.*ranked.*playlist/i).first()).toBeVisible();
    await expect(page.getByLabel("Email for the private report *")).toBeVisible();
    await expect(page.getByLabel("Current playlist rank *")).toBeVisible();
    await expect(page.locator('input[type="file"][multiple]')).toHaveCount(1);
    await expect(page.getByRole("button", { name: /START MY PRIVATE ANALYSIS/ })).toBeVisible();
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

  test("legacy game URLs collapse into the Rocket League product", async ({ page }) => {
    await page.goto("/rocket-league");
    await expect(page).toHaveURL(/\/$/);
    await expectLandingFunnel(page);
    for (const route of ["/league", "/valorant"] as const) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/$/);
      await expectLandingFunnel(page);
      await expect(page.getByText(/COMING LATER/i)).toHaveCount(0);
    }
  });

  test("the archived Climb Check routes into the Rocket League field note", async ({ page }) => {
    await page.goto("/climb-check", { waitUntil: "load" });
    await expect(page).toHaveURL(/\/guides\/rocket-league-replay-review-checklist$/);
    await expect(page.getByRole("heading", { name: /Stop watching the goal/i })).toBeVisible();
  });
});

test.describe("truthful product boundaries", () => {
  test("Rocket League accepts only original ranked PC replays and makes the boundary explicit", async ({ page }) => {
    await page.goto("/analyze?game=rocket-league&platform=pc", { waitUntil: "load" });
    await expect(page.locator('main.batch-intake-page[data-hydrated="true"]')).toBeVisible();
    await expect(page.locator(".intake-card")).toBeVisible();
    await expect(page.getByText(/original PC files/i).first()).toBeVisible();
    await expect(page.locator('input[type="file"]')).toHaveCount(1);
    await expect(page.getByText(/same ranked 1v1, 2v2 or 3v3 playlist/i)).toBeVisible();
    await expect(page.getByText(/Console video analysis/i)).toHaveCount(0);
  });

  test("landing explains evidence and abstention without an FAQ detour", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    await expectLandingFunnel(page);
    await expect(page.getByText("Several matches, not one clip.", { exact: true })).toBeVisible();
    await expect(page.getByText("No signal means no forced answer.", { exact: true })).toBeVisible();
    await expect(page.getByText(/your free analysis remains available/i)).toBeVisible();
  });

  test("the public start link reaches the same 10-replay intake on mobile and desktop", async ({ page }) => {
    await page.goto("/?utm_source=community&token=private", { waitUntil: "load" });
    await expectLandingFunnel(page);
    await page.locator(".rm-home-hero-actions").getByRole("link", { name: /Start free analysis/ }).click();
    await expect(page).toHaveURL(/\/analyze$/);
    await expect(page.getByRole("heading", { name: /Ten replays. One pattern worth fixing/i })).toBeVisible();
    expect(new URL(page.url()).searchParams.has("token")).toBe(false);
  });

  test("League and VALORANT have no separate public funnel", async ({ page }) => {
    for (const route of ["/league", "/valorant"] as const) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/$/);
      await expectLandingFunnel(page);
      await expect(page.getByText(/LEAGUE OF LEGENDS|VALORANT|COMING LATER/i)).toHaveCount(0);
    }
  });

  test("the commercial landing does not distract with pricing or checkout", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#pricing")).toHaveCount(1);
    await expect(page.getByText(/Planned for Premium|up to 35 representative replays each week/i)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /Ten replays.*One thing to improve/i })).toBeVisible();
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
