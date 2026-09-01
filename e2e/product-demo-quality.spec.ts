import { expect, test, type Page } from "@playwright/test";

const examples = [
  "Booming the Ball Away fault example",
  "Boost Over Ball fault example",
  "Ball-Side Rotation fault example",
  "Defensive Corner Dive fault example",
  "Low-Percentage Mechanics fault example",
  "Ignoring Back Post fault example",
  "Jumping for Everything fault example",
  "Cutting Your Teammate fault example",
  "Over-Flipping fault example",
  "Poor 50/50 Selection fault example",
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

test("product demo clears the simplified 33-point technical gate", async ({ page }, testInfo) => {
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
    const interactive = [...element.querySelectorAll("button,a,summary")].filter(visible);
    const boundary = element.getBoundingClientRect();
    const regions = [...element.querySelectorAll(".rm-product-demo-bar,.rm-product-demo-nav,.rm-simple-demo-grid,.rm-product-demo-foot")];
    const evidence = element.querySelector(".rm-demo-evidence");
    const replayRows = evidence?.querySelectorAll(".rm-demo-breakdown-row").length ?? 0;
    const timestampCount = evidence?.querySelectorAll(".rm-demo-breakdown-row time").length ?? 0;
    const detectedRails = evidence?.querySelectorAll('.rm-demo-replay-rail li[data-detected="true"]').length ?? 0;
    const metricValues = [...(evidence?.querySelectorAll(".rm-demo-metrics > div > strong") ?? [])].map(target => Number.parseInt(target.textContent || "", 10));
    return {
      oneDemo: document.querySelectorAll(".rm-product-demo").length === 1,
      heading: (document.querySelector<HTMLElement>(".rm-engine-intro h2")?.innerText || "").replace(/\s+/g, " ").trim(),
      exampleCount: element.querySelectorAll('.rm-product-demo-nav [role="tab"]').length,
      selectedExampleCount: element.querySelectorAll('.rm-product-demo-nav [role="tab"][aria-selected="true"]').length,
      clearlyIllustrative: /illustrative example/i.test(element.textContent || "") && /example report/i.test(element.textContent || ""),
      noRankOrModeSelector: !element.querySelector('select,[role="combobox"]'),
      visibleFinding: visible(element.querySelector(".rm-simple-demo-finding")),
      visibleMoment: visible(element.querySelector(".rm-simple-demo-finding article")),
      visibleAction: visible(element.querySelector(".rm-simple-demo-action")),
      visibleCta: visible(element.querySelector('.rm-simple-demo-action a[href="#ten-replay-start"]')),
      visibleDisclosure: visible(element.querySelector(".rm-product-demo-foot > span"))
        && visible(element.querySelector(".rm-product-demo-foot > small")),
      headerSummary: element.querySelector(".rm-product-demo-bar small")?.textContent?.replace(/\s+/g, " ").trim(),
      onlyThreeIdeas: element.querySelectorAll(".rm-simple-demo-finding h3,.rm-simple-demo-finding article,.rm-simple-demo-action h4").length === 3,
      noStageNav: !element.querySelector(".rm-report-demo-flow"),
      noReplayTable: !element.querySelector(".rm-report-replay-list"),
      noAutoplay: !element.querySelector("video[autoplay]"),
      noCartoonPitch: !element.querySelector(".reveal-pitch,.reveal-car,.reveal-ball,.rm-product-mini-pitch,.rm-sample-media-adapter"),
      noFakeMetrics: !/accuracy|precision|recall|win rate|rank score|%/i.test(element.textContent || ""),
      noNestedInteractive: !element.querySelector("button button,a button,button a,a a"),
      namedControls: interactive.every(target => Boolean(target.getAttribute("aria-label")?.trim() || target.textContent?.trim())),
      recurrenceMathMatches: metricValues[0] === replayRows && metricValues[1] === timestampCount && metricValues[0] === detectedRails,
      breakdownStartsClosed: !element.querySelector(".rm-demo-breakdown[open]"),
      bounded: regions.every(target => {
        const rect = target.getBoundingClientRect();
        return rect.left >= boundary.left - 1 && rect.right <= boundary.right + 1;
      }),
      invalidText: /undefined|NaN|Invalid Date/i.test(element.textContent || ""),
    };
  });

  add("01 one product surface", initial.oneDemo);
  add("02 product demo heading", initial.heading === "Select a common ranked RL mistake below and get a brief look at the deep feedback Replay Method can provide.");
  add("03 demo needs no upload", initial.headerSummary === "Example report — no upload needed");
  add("04 ten examples", initial.exampleCount === 10);
  add("05 one selected example", initial.selectedExampleCount === 1);
  add("06 example data is explicitly illustrative", initial.clearlyIllustrative);
  add("07 no rank or mode selector", initial.noRankOrModeSelector);
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
  add("21 recurrence totals match replay rows", initial.recurrenceMathMatches);
  add("22 breakdown starts compact", initial.breakdownStartsClosed);
  add("23 major regions bounded", initial.bounded);
  add("24 no invalid rendered values", !initial.invalidText);

  await page.getByRole("tab", { name: examples[0], exact: true }).press("ArrowRight");
  add("25 keyboard advances examples", await page.getByRole("tab", { name: examples[1], exact: true }).getAttribute("aria-selected") === "true");
  await page.getByRole("tab", { name: examples[2], exact: true }).click();
  add("26 direct choice changes example", await page.getByRole("tab", { name: examples[2], exact: true }).getAttribute("aria-selected") === "true");
  await page.getByRole("tab", { name: examples[2], exact: true }).press("Home");
  add("27 keyboard returns to first example", await page.getByRole("tab", { name: examples[0], exact: true }).getAttribute("aria-selected") === "true");
  await page.getByRole("tab", { name: examples[1], exact: true }).click();
  add("28 changed example keeps one focus", await demo.locator(".rm-simple-demo-action h4").innerText() === "Stay connected to the play.");
  add("29 changed example keeps replay proof", (await demo.locator(".rm-simple-demo-finding article").innerText()).includes("You leave the play for corner boost while the ball is still reachable."));
  await demo.locator(".rm-demo-breakdown summary").press("Enter");
  add("30 keyboard opens replay breakdown", await demo.locator(".rm-demo-breakdown").getAttribute("open") === "");

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
  add("31 mobile page has no overflow", mobile.noPageOverflow);
  add("32 mobile demo has no overflow", mobile.noDemoOverflow);
  add("33 mobile targets remain usable", mobile.tapTargets);

  expect(checks.filter(([, passed]) => !passed).map(([name]) => name)).toEqual([]);
});

test("all ten product-demo views keep identical collapsed geometry", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "The geometry comparison runs once in deterministic Chromium.");

  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await openDemo(page);

    const measurements: Array<{ demo: number; grid: number; finding: number; action: number }> = [];
    for (const example of examples) {
      await page.getByRole("tab", { name: example, exact: true }).click();
      measurements.push(await page.locator(".rm-product-demo").evaluate(element => {
        const height = (selector: string) => element.querySelector<HTMLElement>(selector)?.getBoundingClientRect().height ?? 0;
        return {
          demo: element.getBoundingClientRect().height,
          grid: height(".rm-simple-demo-grid"),
          finding: height(".rm-simple-demo-finding"),
          action: height(".rm-simple-demo-action"),
        };
      }));
    }

    for (const key of ["demo", "grid", "finding", "action"] as const) {
      const values = measurements.map(measurement => measurement[key]);
      expect(Math.max(...values) - Math.min(...values), `${viewport.width}px ${key} height drift`).toBeLessThanOrEqual(1);
    }
  }
});

test("homepage uses the warm monochrome product palette", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "The palette check runs once in deterministic Chromium.");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openDemo(page);

  const palette = await page.locator(".reveal-home").evaluate(home => {
    const color = (selector: string, property: "color" | "backgroundColor" | "borderTopColor") => {
      const target = home.matches(selector) ? home : home.querySelector<HTMLElement>(selector);
      return target ? getComputedStyle(target)[property] : "";
    };
    const discardedAccentValues = ["rgb(107, 82, 238)", "rgb(124, 91, 255)", "rgba(124, 91, 255", "rgb(11, 95, 255)", "rgb(24, 183, 232)", "rgb(255, 122, 26)"];
    const visibleDiscardedAccent = [...home.querySelectorAll<HTMLElement>("*")].some(target => {
      const rect = target.getBoundingClientRect();
      const style = getComputedStyle(target);
      if (rect.width === 0 || rect.height === 0 || style.display === "none" || style.visibility === "hidden") return false;
      return [style.color, style.backgroundColor, style.borderTopColor, style.borderRightColor, style.borderBottomColor, style.borderLeftColor, style.outlineColor, style.boxShadow]
        .some(value => discardedAccentValues.some(accent => value.includes(accent)));
    });

    return {
      accent: getComputedStyle(home).getPropertyValue("--rm-accent").trim(),
      status: color(".rm-product-demo-bar > span > i", "backgroundColor"),
      activeTabBorder: color('.rm-product-demo-nav [role="tab"][aria-selected="true"]', "borderTopColor"),
      analysisLabel: color(".rm-simple-demo-signal span", "color"),
      faultLabel: color(".rm-simple-demo-signal b", "color"),
      detectedBar: color('.rm-demo-replay-rail li[data-detected="true"] i', "backgroundColor"),
      quickFix: color(".rm-simple-demo-action-copy > span", "color"),
      findingSurface: color(".rm-simple-demo-finding", "backgroundColor"),
      evidenceSurface: color(".rm-demo-metrics > div", "backgroundColor"),
      canvas: color(".reveal-home", "backgroundColor"),
      visibleDiscardedAccent,
    };
  });

  expect(palette).toEqual({
    accent: "#07192b",
    status: "rgb(7, 25, 43)",
    activeTabBorder: "rgba(7, 25, 43, 0.12)",
    analysisLabel: "rgba(250, 250, 248, 0.58)",
    faultLabel: "rgb(250, 250, 248)",
    detectedBar: "rgb(250, 250, 248)",
    quickFix: "rgb(7, 25, 43)",
    findingSurface: "rgb(7, 25, 43)",
    evidenceSurface: "rgb(18, 42, 62)",
    canvas: "rgb(248, 247, 244)",
    visibleDiscardedAccent: false,
  });
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
        const evidence = element.querySelector(".rm-demo-evidence");
        const metricValues = [...(evidence?.querySelectorAll(".rm-demo-metrics > div > strong") ?? [])].map(target => Number.parseInt(target.textContent || "", 10));
        const replayRows = evidence?.querySelectorAll(".rm-demo-breakdown-row").length ?? 0;
        const timestampCount = evidence?.querySelectorAll(".rm-demo-breakdown-row time").length ?? 0;
        return {
          bounded: regions.every(rect => rect.left >= boundary.left - 2 && rect.right <= boundary.right + 2),
          pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          regionCount: regions.length,
          recurrenceMathMatches: metricValues[0] === replayRows && metricValues[1] === timestampCount,
        };
      });
      expect(geometry.bounded).toBe(true);
      expect(geometry.pageOverflow).toBeLessThanOrEqual(1);
      expect(geometry.regionCount).toBe(5);
      expect(geometry.recurrenceMathMatches).toBe(true);

      await testInfo.attach(`simple-product-demo-${viewport.name}-${example}.png`, {
        body: await page.locator(".rm-product-demo").screenshot({ animations: "disabled" }),
        contentType: "image/png",
      });
    });
  }
}
