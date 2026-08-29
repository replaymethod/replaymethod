import { expect, test, type Page } from "@playwright/test";

const examples = ["Boost", "Double commit", "Last player", "Clear", "Rotation cut"] as const;
const moments = ["Setup", "Decision", "Outcome"] as const;

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

test("product demo clears the 30-point technical gate", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "The named technical gate runs once in deterministic Chromium.");
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
    const bounded = [...element.querySelectorAll(".rm-product-demo-bar,.rm-product-demo-nav,.rm-product-demo-stage,.rm-product-demo-foot")]
      .every(target => {
        const rect = target.getBoundingClientRect();
        return rect.left >= boundary.left - 1 && rect.right <= boundary.right + 1;
      });
    return {
      oneDemo: document.querySelectorAll(".rm-product-demo").length === 1,
      heading: (document.querySelector<HTMLElement>(".rm-engine-intro h2")?.innerText || "").replace(/\s+/g, " ").trim(),
      tabCount: element.querySelectorAll('.rm-product-demo-nav [role="tab"]').length,
      selectedPatternCount: element.querySelectorAll('.rm-product-demo-nav [role="tab"][aria-selected="true"]').length,
      momentCount: element.querySelectorAll('.rm-sample-media [role="tablist"] [role="tab"]').length,
      selectedMomentCount: element.querySelectorAll('.rm-sample-media [role="tablist"] [role="tab"][aria-selected="true"]').length,
      evidenceCount: element.querySelectorAll(".rm-sample-evidence li").length,
      visibleOutput: visible(element.querySelector(".rm-product-demo-output")),
      visibleMedia: visible(element.querySelector(".rm-sample-media")),
      visibleCta: visible(element.querySelector('.rm-product-demo-output a[href="#ten-replay-start"]')),
      visibleDisclosure: visible(element.querySelector(".rm-product-demo-foot span:last-child")),
      hasInputOutput: /Input\s*10 replays\s*→\s*Output\s*one supported focus/i.test(element.querySelector(".rm-product-demo-bar small")?.textContent || ""),
      noAutoplay: !element.querySelector("video[autoplay]"),
      noLegacyPitch: !element.querySelector(".reveal-pitch,.reveal-car,.reveal-ball,.rm-product-mini-pitch"),
      noYouLabel: !/\bYOU\b/.test(element.textContent || ""),
      noNestedInteractive: !element.querySelector("button button,a button,button a,a a"),
      namedControls: interactive.every(target => Boolean(target.getAttribute("aria-label")?.trim() || target.textContent?.trim())),
      bounded,
      outputCopy: element.querySelector(".rm-product-demo-output h3")?.textContent?.trim(),
      nextRule: element.querySelector(".rm-sample-evidence strong")?.textContent?.replace(/\s+/g, " ").trim(),
      disclosure: element.querySelector(".rm-product-demo-foot span:last-child")?.textContent?.trim(),
      invalidText: /undefined|NaN|Invalid Date/i.test(element.textContent || ""),
    };
  });

  add("01 one bounded demo surface", initial.oneDemo);
  add("02 outcome-led demo heading", initial.heading === "Open the moment. See the decision.");
  add("03 input and output are explicit", initial.hasInputOutput);
  add("04 five relatable patterns", initial.tabCount === 5);
  add("05 exactly one selected pattern", initial.selectedPatternCount === 1);
  add("06 three replay moments", initial.momentCount === 3);
  add("07 exactly one selected moment", initial.selectedMomentCount === 1);
  add("08 output is visible immediately", initial.visibleOutput);
  add("09 media and output share the surface", initial.visibleMedia && initial.visibleOutput);
  add("10 ten-replay evidence strip", initial.evidenceCount === 10);
  add("11 one focus is named", Boolean(initial.nextRule?.startsWith("One focus")));
  add("12 CTA follows the result", initial.visibleCta);
  add("13 illustrative disclosure is visible", initial.visibleDisclosure && Boolean(initial.disclosure?.startsWith("Illustrative")));
  add("14 no autoplay dependency", initial.noAutoplay);
  add("15 no legacy cartoon pitch", initial.noLegacyPitch);
  add("16 no YOU badge", initial.noYouLabel);
  add("17 no nested interactive controls", initial.noNestedInteractive);
  add("18 every control has a name", initial.namedControls);
  add("19 major regions stay bounded", initial.bounded);
  add("20 result copy exists", Boolean(initial.outputCopy));
  add("21 no invalid rendered values", !initial.invalidText);

  await page.getByRole("tab", { name: "Boost", exact: true }).press("ArrowRight");
  add("22 keyboard advances patterns", await page.getByRole("tab", { name: "Double commit", exact: true }).getAttribute("aria-selected") === "true");
  await page.getByRole("button", { name: "Next example" }).click();
  add("23 next arrow advances patterns", await page.getByRole("tab", { name: "Last player", exact: true }).getAttribute("aria-selected") === "true");
  await page.getByRole("button", { name: "Previous example" }).click();
  add("24 previous arrow reverses patterns", await page.getByRole("tab", { name: "Double commit", exact: true }).getAttribute("aria-selected") === "true");
  await page.getByRole("tab", { name: /^Setup\b/ }).click();
  add("25 setup is directly selectable", await page.getByRole("tab", { name: /^Setup\b/ }).getAttribute("aria-selected") === "true");
  await page.getByRole("tab", { name: /^Outcome\b/ }).click();
  add("26 outcome is directly selectable", await page.getByRole("tab", { name: /^Outcome\b/ }).getAttribute("aria-selected") === "true");
  await page.getByRole("button", { name: "Rewind to setup" }).click();
  add("27 rewind returns to setup", await page.getByRole("tab", { name: /^Setup\b/ }).getAttribute("aria-selected") === "true");

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
  add("28 mobile page has no horizontal overflow", mobile.noPageOverflow);
  add("29 mobile demo has no horizontal overflow", mobile.noDemoOverflow);
  add("30 mobile controls retain usable targets", mobile.tapTargets);

  expect(checks.filter(([, passed]) => !passed).map(([name]) => name)).toEqual([]);
});

let pass = 0;
for (const viewport of [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
] as const) {
  for (const example of examples) {
    for (const moment of moments) {
      pass += 1;
      const passNumber = String(pass).padStart(2, "0");
      test(`aesthetic pass ${passNumber}/30 · ${viewport.name} · ${example} · ${moment}`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== "desktop-chromium", "The 30-state visual matrix runs once in deterministic Chromium.");
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await openDemo(page);
        await page.getByRole("tab", { name: example, exact: true }).click();
        await page.getByRole("tab", { name: new RegExp(`^${moment}\\b`) }).click();

        const geometry = await page.locator(".rm-product-demo").evaluate(element => {
          const boundary = element.getBoundingClientRect();
          const regions = [".rm-product-demo-bar", ".rm-product-demo-nav", ".rm-sample-media", ".rm-product-demo-output", ".rm-product-demo-foot"]
            .map(selector => element.querySelector<HTMLElement>(selector)?.getBoundingClientRect())
            .filter((rect): rect is DOMRect => Boolean(rect));
          const texts = [...element.querySelectorAll("h3,p,button,small,span,strong")].filter(target => {
            const style = getComputedStyle(target);
            const rect = target.getBoundingClientRect();
            return !target.closest(".rm-sample-evidence li") && style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
          });
          return {
            bounded: regions.every(rect => rect.left >= boundary.left - 2 && rect.right <= boundary.right + 2),
            unclipped: texts.every(target => target.scrollWidth <= target.clientWidth + 2 || getComputedStyle(target).whiteSpace !== "nowrap"),
            pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            regionCount: regions.length,
          };
        });
        expect(geometry.bounded).toBe(true);
        expect(geometry.unclipped).toBe(true);
        expect(geometry.pageOverflow).toBeLessThanOrEqual(1);
        expect(geometry.regionCount).toBe(5);

        await testInfo.attach(`product-demo-${passNumber}-${viewport.name}-${example}-${moment}.png`, {
          body: await page.locator(".rm-product-demo").screenshot({ animations: "disabled" }),
          contentType: "image/png",
        });
      });
    }
  }
}
