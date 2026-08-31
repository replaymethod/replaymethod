import { expect, test, type Page } from "@playwright/test";

const examples = [
  "Boost mistake: leave the net for boost",
  "Double commit mistake: both teammates go for the same ball",
  "Last man mistake: dive into a challenge too early",
  "Clear mistake: hit the ball back through the middle",
  "Rotation mistake: cut in front of a teammate",
] as const;

async function openDemo(page: Page) {
  await page.goto("/#product", { waitUntil: "domcontentloaded" });
  await page.locator(".rm-product-demo").scrollIntoViewIfNeeded();
  await expect(page.locator(".rm-product-demo")).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.route("https://replaymethod.xyz/manifest.webmanifest", route => route.fulfill({
    status: 200,
    contentType: "application/manifest+json",
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({ name: "Replay Method", start_url: "/" }),
  }));
});

test("product demo clears the simplified 30-point technical gate", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "The technical gate runs once in deterministic Chromium.");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openDemo(page);

  const demo = page.locator(".rm-product-demo");
  const checks: Array<[string, boolean]> = [];
  const add = (name: string, passed: boolean) => checks.push([name, passed]);
  const initial = await demo.evaluate(element => {
    const visible = (target: Element | null) => {
      if (!target) return false;
      const style = getComputedStyle(target);
      const rect = target.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0;
    };
    const interactive = [...element.querySelectorAll("button,a")].filter(visible);
    const boundary = element.getBoundingClientRect();
    const regions = [...element.querySelectorAll(".rm-product-demo-bar,.rm-product-demo-nav,.rm-simple-demo-grid,.rm-product-demo-foot")];
    return {
      oneDemo: document.querySelectorAll(".rm-product-demo").length === 1,
      heading: (document.querySelector<HTMLElement>(".rm-engine-intro h2")?.innerText || "").replace(/\s+/g, " ").trim(),
      exampleCount: element.querySelectorAll('.rm-product-demo-nav [role="tab"]').length,
      selectedExampleCount: element.querySelectorAll('.rm-product-demo-nav [role="tab"][aria-selected="true"]').length,
      dotCount: element.querySelectorAll(".rm-simple-demo-finding > ol li").length,
      matchCount: element.querySelectorAll('.rm-simple-demo-finding > ol li[data-match="true"]').length,
      visibleFinding: visible(element.querySelector(".rm-simple-demo-finding")),
      visibleMoment: visible(element.querySelector(".rm-simple-demo-finding article")),
      visibleAction: visible(element.querySelector(".rm-simple-demo-action")),
      visibleCta: visible(element.querySelector('.rm-simple-demo-action a[href="#ten-replay-start"]')),
      visibleDisclosure: visible(element.querySelector(".rm-product-demo-foot span:last-child")),
      headerSummary: element.querySelector(".rm-product-demo-bar small")?.textContent?.replace(/\s+/g, " ").trim(),
      onlyThreeIdeas: element.querySelectorAll(".rm-simple-demo-finding h3,.rm-simple-demo-finding article,.rm-simple-demo-action h4").length === 3,
      noStageNav: !element.querySelector(".rm-report-demo-flow"),
      noReplayTable: !element.querySelector(".rm-report-replay-list"),
      noAutoplay: !element.querySelector("video[autoplay]"),
      noCartoonPitch: !element.querySelector(".reveal-pitch,.reveal-car,.reveal-ball,.rm-product-mini-pitch,.rm-sample-media-adapter"),
      noFakeMetrics: !/accuracy|precision|recall|win rate|rank score|%/i.test(element.textContent || ""),
      noNestedInteractive: !element.querySelector("button button,a button,button a,a a"),
      namedControls: interactive.every(target => Boolean(target.getAttribute("aria-label")?.trim() || target.textContent?.trim())),
      bounded: regions.every(target => {
        const rect = target.getBoundingClientRect();
        return rect.left >= boundary.left - 1 && rect.right <= boundary.right + 1;
      }),
      invalidText: /undefined|NaN|Invalid Date/i.test(element.textContent || ""),
    };
  });

  add("01 one product surface", initial.oneDemo);
  add("02 customer problem heading", initial.heading === "Pick a mistake. See the report.");
  add("03 demo needs no upload", initial.headerSummary === "Example report — no upload needed");
  add("04 five examples", initial.exampleCount === 5);
  add("05 one selected example", initial.selectedExampleCount === 1);
  add("06 ten replay signal marks", initial.dotCount === 10);
  add("07 comparable sample moments marked", initial.matchCount === 4);
  add("08 finding visible immediately", initial.visibleFinding);
  add("09 proof moment visible immediately", initial.visibleMoment);
  add("10 one action visible immediately", initial.visibleAction);
  add("11 CTA visible", initial.visibleCta);
  add("12 disclosure visible", initial.visibleDisclosure);
  add("13 exactly three core ideas", initial.onlyThreeIdeas);
  add("14 no four-stage navigation", initial.noStageNav);
  add("15 no ten-row replay table", initial.noReplayTable);
  add("16 no autoplay dependency", initial.noAutoplay);
  add("17 no cartoon pitch", initial.noCartoonPitch);
  add("18 no fake performance metrics", initial.noFakeMetrics);
  add("19 no nested controls", initial.noNestedInteractive);
  add("20 every control named", initial.namedControls);
  add("21 major regions bounded", initial.bounded);
  add("22 no invalid rendered values", !initial.invalidText);

  await page.getByRole("tab", { name: examples[0], exact: true }).press("ArrowRight");
  add("23 keyboard advances examples", await page.getByRole("tab", { name: examples[1], exact: true }).getAttribute("aria-selected") === "true");
  await page.getByRole("tab", { name: examples[2], exact: true }).click();
  add("24 direct choice changes example", await page.getByRole("tab", { name: examples[2], exact: true }).getAttribute("aria-selected") === "true");
  await page.getByRole("tab", { name: examples[2], exact: true }).press("Home");
  add("25 keyboard returns to first example", await page.getByRole("tab", { name: examples[0], exact: true }).getAttribute("aria-selected") === "true");
  await page.getByRole("tab", { name: examples[1], exact: true }).click();
  add("26 changed example keeps one focus", await demo.locator(".rm-simple-demo-action h4").innerText() === "Let them go. Stay behind.");
  add("27 changed example keeps replay proof", (await demo.locator(".rm-simple-demo-finding article").innerText()).includes("Your teammate is already up, but you jump for the same ball."));

  await page.setViewportSize({ width: 390, height: 844 });
  await demo.scrollIntoViewIfNeeded();
  const mobile = await demo.evaluate(element => ({
    noPageOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    noDemoOverflow: element.scrollWidth <= element.clientWidth + 1,
    tapTargets: [...element.querySelectorAll("button,a")].every(target => {
      const rect = target.getBoundingClientRect();
      return rect.width >= 34 && rect.height >= 34;
    }),
  }));
  add("28 mobile page has no overflow", mobile.noPageOverflow);
  add("29 mobile demo has no overflow", mobile.noDemoOverflow);
  add("30 mobile targets remain usable", mobile.tapTargets);

  expect(checks.filter(([, passed]) => !passed).map(([name]) => name)).toEqual([]);
});

for (const viewport of [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
] as const) {
  for (const example of examples) {
    test(`simple visual pass · ${viewport.name} · ${example}`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop-chromium", "The visual matrix runs once in deterministic Chromium.");
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openDemo(page);
      await page.getByRole("tab", { name: example, exact: true }).click();

      const geometry = await page.locator(".rm-product-demo").evaluate(element => {
        const boundary = element.getBoundingClientRect();
        const regions = [".rm-product-demo-bar", ".rm-product-demo-nav", ".rm-simple-demo-finding", ".rm-simple-demo-action", ".rm-product-demo-foot"]
          .map(selector => element.querySelector<HTMLElement>(selector)?.getBoundingClientRect())
          .filter((rect): rect is DOMRect => Boolean(rect));
        return {
          bounded: regions.every(rect => rect.left >= boundary.left - 2 && rect.right <= boundary.right + 2),
          pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          regionCount: regions.length,
        };
      });
      expect(geometry.bounded).toBe(true);
      expect(geometry.pageOverflow).toBeLessThanOrEqual(1);
      expect(geometry.regionCount).toBe(5);

      await testInfo.attach(`simple-product-demo-${viewport.name}-${example}.png`, {
        body: await page.locator(".rm-product-demo").screenshot({ animations: "disabled" }),
        contentType: "image/png",
      });
    });
  }
}
