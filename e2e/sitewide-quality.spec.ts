import { expect, test, type Page } from "@playwright/test";

const customerRoutes = [
  "/",
  "/analyze",
  "/replay-upload",
  "/guides",
  "/climb-check",
  "/guides/rocket-league-replay-review-checklist",
  "/league",
  "/valorant",
  "/rocket-league",
  "/privacy",
  "/terms",
  "/beta-terms",
  "/reports",
  "/billing/success",
  "/rocket-league-beta",
  "/access/not-a-valid-token",
  "/definitely-not-a-page",
  "/report/11111111111111111111111111111111",
  "/report/22222222222222222222222222222222",
  "/report/33333333333333333333333333333333",
  "/report/44444444444444444444444444444444",
  "/report/55555555555555555555555555555555",
  "/report/66666666666666666666666666666666",
] as const;

function collectBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", error => errors.push(error.message));
  return errors;
}

test.beforeEach(async ({ page }) => {
  await page.route("https://replaymethod.xyz/manifest.webmanifest", route => route.fulfill({
    status: 200,
    contentType: "application/manifest+json",
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({ name: "Replay Method", start_url: "/" }),
  }));
});

test("the ten-sample report stays bounded and navigable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One deterministic geometry pass is sufficient.");
  await page.goto("/#product", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("tab", { name: "Booming the Ball Away fault example", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('.rm-product-demo-nav [role="tab"]')).toHaveCount(10);
  await expect(page.locator(".rm-product-replay-card")).toHaveCount(0);

  for (const example of ["Booming the Ball Away fault example", "Boost Over Ball fault example", "Ball-Side Rotation fault example", "Defensive Corner Dive fault example", "Low-Percentage Mechanics fault example", "Ignoring Back Post fault example", "Jumping for Everything fault example", "Cutting Your Teammate fault example", "Over-Flipping fault example", "Poor 50/50 Selection fault example"]) {
    await page.getByRole("tab", { name: example, exact: true }).click();
    await expect(page.getByRole("tab", { name: example, exact: true })).toHaveAttribute("aria-selected", "true");
    const geometry = await page.locator(".rm-product-demo").evaluate(demo => {
      const boundary = demo.getBoundingClientRect();
      const targets = [".rm-simple-demo-grid", ".rm-simple-demo-finding", ".rm-simple-demo-finding article", ".rm-simple-demo-action"]
        .map(selector => demo.querySelector<HTMLElement>(selector)?.getBoundingClientRect())
        .filter((rect): rect is DOMRect => Boolean(rect));
      return {
        bounded: targets.every(rect => rect.left >= boundary.left - 8 && rect.right <= boundary.right + 8 && rect.top >= boundary.top - 8 && rect.bottom <= boundary.bottom + 8),
        targetCount: targets.length,
      };
    });
    expect(geometry.bounded, `${example} contains an out-of-bounds report surface`).toBe(true);
    expect(geometry.targetCount).toBe(4);
  }
});

test.describe("intermediate responsive geometry", () => {
  for (const width of [320, 768, 1024]) {
    test(`${width}px keeps every customer route inside one coherent grid`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop-chromium", "Breakpoint sweep runs once in Chromium.");
      test.setTimeout(90_000);
      await page.setViewportSize({ width, height: width === 320 ? 720 : 900 });
      const failures: string[] = [];
      for (const route of customerRoutes) {
        const response = await page.goto(route, { waitUntil: "domcontentloaded" });
        if (!response || response.status() >= 500) failures.push(`${route}: response ${response?.status() ?? "missing"}`);
        await page.locator("main").waitFor({ state: "visible" });
        const routeFailures = await page.evaluate(() => {
          const visible = (element: Element) => {
            const style = getComputedStyle(element);
            const box = element.getBoundingClientRect();
            return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0 && box.width > 0 && box.height > 0;
          };
          const clippedText = [...document.querySelectorAll("main h1,main h2,main h3,main p,main button")]
            .filter(visible)
            .filter(element => {
              const style = getComputedStyle(element);
              const clips = ["hidden", "clip"].includes(style.overflow) || ["hidden", "clip"].includes(style.overflowX) || ["hidden", "clip"].includes(style.overflowY);
              return clips && (element.scrollWidth > element.clientWidth + 2 || element.scrollHeight > element.clientHeight + 2);
            });
          const header = document.querySelector("main > .rm-header");
          const left = header?.querySelector(".rm-wordmark")?.getBoundingClientRect();
          const right = header?.querySelector(".rm-header-action")?.getBoundingClientRect();
          return [
            document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1 ? "" : "horizontal overflow",
            document.querySelectorAll("main h1").length === 1 ? "" : "heading hierarchy",
            header ? "" : "missing header",
            document.querySelector("main > .rm-footer") ? "" : "missing footer",
            left && right && left.right <= right.left - 8 ? "" : "header collision",
            clippedText.length === 0 ? "" : `clipped text (${clippedText.length})`,
          ].filter(Boolean);
        });
        failures.push(...routeFailures.map(failure => `${route}: ${failure}`));
      }
      expect(failures).toEqual([]);
    });
  }
});

test.describe("sitewide 30-point product-quality gate", () => {
  for (const route of customerRoutes) {
    test(`${route} clears every product and layout check`, async ({ page }) => {
      const browserErrors = collectBrowserErrors(page);
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(response?.status()).toBeLessThan(500);
      await expect(page.locator("main")).toBeVisible();
      await page.waitForTimeout(250);

      const audit = await page.evaluate(() => {
        const visible = (element: Element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0;
        };
        const withinViewport = (element: Element, tolerance = 1) => {
          const rect = element.getBoundingClientRect();
          return rect.left >= -tolerance && rect.right <= document.documentElement.clientWidth + tolerance;
        };
        const named = (element: Element) => Boolean(
          element.getAttribute("aria-label")?.trim()
          || element.getAttribute("title")?.trim()
          || element.textContent?.trim()
          || element.closest("label")?.textContent?.trim()
          || (element.getAttribute("id") && document.querySelector(`label[for="${CSS.escape(element.getAttribute("id")!)}"]`)?.textContent?.trim())
          || (element instanceof HTMLInputElement && element.value.trim()),
        );
        const controls = [...document.querySelectorAll("button, input, select, textarea")].filter(visible);
        const unlabeledFields = controls.filter(element => {
          if (element instanceof HTMLButtonElement) return !named(element);
          if (element instanceof HTMLInputElement && ["hidden", "submit", "button", "checkbox", "radio", "file"].includes(element.type)) return false;
          const id = element.getAttribute("id");
          return !element.closest("label") && !element.getAttribute("aria-label") && !(id && document.querySelector(`label[for="${CSS.escape(id)}"]`));
        });
        const text = document.body.innerText;
        const h1 = document.querySelector("main h1");
        const header = document.querySelector("main > .rm-header");
        const footer = document.querySelector("main > .rm-footer");
        const wordmark = header?.querySelector(".rm-wordmark");
        const headerAction = header?.querySelector(".rm-header-action");
        const footerGroups = [...(footer?.querySelectorAll("nav") || [])];
        const footerLabels = footerGroups.map(item => item.querySelector(":scope > span")?.textContent?.trim());
        const footerWidths = footerGroups.map(item => item.getBoundingClientRect().width);
        const equalFooterGroups = footerGroups.length === 3 && Math.max(...footerWidths) - Math.min(...footerWidths) <= 1;
        const visibleLinks = [...document.querySelectorAll("a")].filter(visible);
        const visibleSections = [...document.querySelectorAll("main section, main article, main aside")].filter(visible);
        const smallTapTargets = [...document.querySelectorAll("main button, main a")].filter(visible).filter(element => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          const inlineTextLink = style.display === "inline" && rect.height < 30;
          const navigationLink = Boolean(element.closest(".rm-header, .rm-footer")) || element.classList.contains("rm-wordmark");
          return !inlineTextLink && !navigationLink && (rect.width < 34 || rect.height < 34);
        });
        const intersectingHeaderItems = wordmark && headerAction
          ? (() => {
              const left = wordmark.getBoundingClientRect();
              const right = headerAction.getBoundingClientRect();
              return left.right > right.left - 8;
            })()
          : true;
        const bodyStyle = getComputedStyle(document.body);
        const mainStyle = getComputedStyle(document.querySelector("main")!);
        const paper = mainStyle.backgroundColor === "rgb(248, 247, 244)"
          || mainStyle.backgroundColor === "rgb(253, 252, 252)"
          || mainStyle.backgroundColor === "rgb(255, 255, 255)"
          || mainStyle.backgroundColor === "rgba(0, 0, 0, 0)";
        const checks: Array<[string, boolean]> = [
          ["01 language is declared", document.documentElement.lang === "en"],
          ["02 one main landmark", document.querySelectorAll("main").length === 1],
          ["03 main is visible", visible(document.querySelector("main")!)],
          ["04 one page heading", document.querySelectorAll("main h1").length === 1],
          ["05 page heading has copy", Boolean(h1?.textContent?.trim())],
          ["06 page heading is visible", Boolean(h1 && visible(h1))],
          ["07 page heading stays in viewport", Boolean(h1 && withinViewport(h1))],
          ["08 no horizontal page overflow", document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1],
          ["09 body fills viewport", document.body.getBoundingClientRect().width >= document.documentElement.clientWidth - 1],
          ["10 customer header exists", Boolean(header)],
          ["11 wordmark is visible", Boolean(wordmark && visible(wordmark))],
          ["12 wordmark stays in viewport", Boolean(wordmark && withinViewport(wordmark))],
          ["13 header action is visible", Boolean(headerAction && visible(headerAction))],
          ["14 header action stays in viewport", Boolean(headerAction && withinViewport(headerAction))],
          ["15 header items do not collide", !intersectingHeaderItems],
          ["16 customer footer exists", Boolean(footer)],
          ["17 footer stays in viewport", Boolean(footer && withinViewport(footer))],
          ["18 footer has three equal information groups", equalFooterGroups],
          ["19 footer labels are consistent", ["Product", "How it works", "Company"].every(label => footerLabels.includes(label))],
          ["20 links have destinations", visibleLinks.every(link => Boolean(link.getAttribute("href")))],
          ["21 links have names", visibleLinks.every(named)],
          ["22 controls have names", controls.every(named)],
          ["23 form fields are labeled", unlabeledFields.length === 0],
          ["24 non-inline tap targets are usable", smallTapTargets.length === 0],
          ["25 visible content has positive geometry", visibleSections.every(element => element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0)],
          ["26 no invalid dates", !text.includes("Invalid Date")],
          ["27 no undefined output", !/\bundefined\b/i.test(text)],
          ["28 no NaN output", !/\bNaN\b/.test(text)],
          ["29 shared type system is active", /Helvetica|Arial/.test(mainStyle.fontFamily) || /Helvetica|Arial/.test(bodyStyle.fontFamily)],
          ["30 light product canvas is active", paper],
        ];
        return {
          failures: checks.filter(([, passed]) => !passed).map(([label]) => label),
          unlabeledFields: unlabeledFields.map(element => element.outerHTML.slice(0, 160)),
          smallTapTargets: smallTapTargets.map(element => `${element.tagName.toLowerCase()}:${element.textContent?.trim().slice(0, 40)}:${Math.round(element.getBoundingClientRect().width)}x${Math.round(element.getBoundingClientRect().height)}`).slice(0, 12),
        };
      });

      const expectedNotFoundState = route === "/definitely-not-a-page" || route.startsWith("/report/");
      const relevantBrowserErrors = expectedNotFoundState
        ? browserErrors.filter(error => !error.includes("404 (Not Found)"))
        : browserErrors;
      expect(relevantBrowserErrors, `browser errors on ${route}`).toEqual([]);
      expect(audit, `sitewide audit failed on ${route}`).toEqual({ failures: [], unlabeledFields: [], smallTapTargets: [] });
    });
  }
});
