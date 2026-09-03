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
  "/rocket-league-beta",
  "/reports",
  "/billing/success",
];

const themedCustomerRoutes = [
  "/",
  "/analyze",
  "/replay-upload",
  "/reports",
  "/report/33333333333333333333333333333333",
  "/guides/rocket-league-replay-review-checklist",
  "/privacy",
  "/terms",
  "/beta-terms",
  "/billing/success",
  "/rocket-league-beta",
  "/access/not-a-valid-token",
  "/this-page-does-not-exist",
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
  await expect(page.locator(".rm-home-hero-actions").getByRole("link", { name: /Analyze 10 \.replay files for free/ })).toHaveAttribute("href", "#ten-replay-start");
  await expect(page.locator('#ten-replay-start input[type="file"][multiple]')).toHaveCount(1);
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
    await expect(page.locator(".rm-home-hero h1")).toHaveText(/From endless grinding.*next target rank/i);
    await expect(page.locator(".reveal-promises")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /By filtering out unnecessary hours.*change in your game/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Select a common ranked RL mistake.*deep feedback Replay Method can provide/i })).toBeVisible();
    await expect(page.locator(".rm-home-trust")).toHaveCount(0);
    await expect(page.locator(".rm-engine-intro > p")).toContainText("Open the exact matches and timestamps, then compare them with the analysis yourself.");
    await expect(page.locator('main.marcel-home input[type="file"][multiple]')).toHaveCount(1);
    await expect(page.getByRole("button", { name: /League of Legends|VALORANT/i })).toHaveCount(0);
    await expect(page.locator(".rm-home-hero-actions").getByRole("link", { name: /Analyze 10 \.replay files for free/ })).toHaveAttribute("href", "#ten-replay-start");
    await expect(page.locator(".rm-home-hero-actions > a > span")).toHaveCount(2);
    await expect(page.locator(".reveal-faq details")).toHaveCount(0);
  });

  test("the Free and Planned Premium steps stay geometrically aligned", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/", { waitUntil: "load" });
    await expect(page.locator('main.marcel-home[data-hydrated="true"]')).toBeVisible();
    const readGeometry = () => page.evaluate(() => ({
      howWidths: [...document.querySelectorAll<HTMLElement>(".rm-home-how li")].map(item => Math.round(item.getBoundingClientRect().width)),
      howHeights: [...document.querySelectorAll<HTMLElement>(".rm-home-how li")].map(item => Math.round(item.getBoundingClientRect().height)),
      titleOffsets: [...document.querySelectorAll<HTMLElement>(".rm-home-how li")].map(item => {
        const card = item.getBoundingClientRect();
        const title = item.querySelector<HTMLElement>("h3")!.getBoundingClientRect();
        return Math.round(title.top - card.top);
      }),
      bodyOffsets: [...document.querySelectorAll<HTMLElement>(".rm-home-how li")].map(item => {
        const card = item.getBoundingClientRect();
        const body = item.querySelector<HTMLElement>("p")!.getBoundingClientRect();
        return Math.round(body.top - card.top);
      }),
    }));

    const expectMethodAlignment = (geometry: Awaited<ReturnType<typeof readGeometry>>) => {
      expect(new Set(geometry.howWidths).size).toBe(1);
      expect(new Set(geometry.titleOffsets).size).toBe(1);
    };

    const expectFreeMethodComposition = (geometry: Awaited<ReturnType<typeof readGeometry>>) => {
      expect(new Set(geometry.howWidths).size).toBe(1);
      expect(new Set(geometry.titleOffsets).size).toBe(1);
    };

    const desktop = await readGeometry();
    expectFreeMethodComposition(desktop);
    expect(new Set(desktop.howHeights).size).toBe(1);

    await page.getByRole("tab", { name: "Planned Premium" }).click();
    await expect(page.locator(".rm-home-how li h3").first()).toHaveText("Upload up to 35 ranked replays every week.");
    const desktopPremium = await readGeometry();
    expectMethodAlignment(desktopPremium);
    expect(new Set(desktopPremium.howHeights).size).toBe(1);
    expect(desktopPremium.howHeights).toEqual(desktop.howHeights);

    await page.setViewportSize({ width: 390, height: 844 });
    const mobile = await readGeometry();
    expectMethodAlignment(mobile);

    await page.getByRole("tab", { name: "Free method" }).click();
    await expect(page.locator(".rm-home-how li h3").first()).toHaveText("Upload one set of 10 ranked replays.");
    expectFreeMethodComposition(await readGeometry());
    await expect(page.locator(".rm-home-how-label")).toHaveCount(0);
  });

  test("the two-state navigation and product intro stay composed at every target width", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/", { waitUntil: "load" });
    await expect(page.locator('main.marcel-home[data-hydrated="true"]')).toBeVisible();
    const topHeader = page.locator(".rm-header-home");
    const compactHeader = page.locator(".rm-scroll-header");
    const directoryButton = topHeader.locator(".rm-nav-directory > button");
    await expect(page.locator(".rm-main-nav-links")).toHaveCount(0);
    await expect(directoryButton).toHaveText(/Start/);

    await directoryButton.click();
    const startItem = page.locator('.rm-nav-directory-panel a[href="/#start"]');
    await expect(startItem).toHaveAttribute("aria-current", "page");
    await expect(startItem).toHaveCSS("background-color", "rgba(255, 255, 255, 0.9)");
    expect(await startItem.evaluate(element => getComputedStyle(element, "::after").content)).toBe("none");
    await page.locator('.rm-nav-directory-panel a[href="/#product"]').click({ force: true });
    await expect(page).toHaveURL(/#product$/);
    await expect(directoryButton).toHaveText(/Product demo/);
    await expect(compactHeader).toHaveClass(/is-visible/);
    await expect(compactHeader.locator(".rm-nav-directory")).toHaveCount(0);

    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, 0);
    });
    await expect(compactHeader).not.toHaveClass(/is-visible/);
    await expect(directoryButton).toHaveText(/Start/);
    await page.evaluate(() => document.querySelector("#method")?.scrollIntoView());
    await expect(directoryButton).toHaveText(/How it works/);
    await expect(compactHeader).toHaveClass(/is-visible/);

    for (const width of [1440, 1280, 1180, 1024, 768, 685, 390, 375, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/?navigationWidth=${width}#start`, { waitUntil: "load" });

      await expect(directoryButton).toBeVisible({ visible: width > 520 });
      await expect(topHeader.locator(".rm-wordmark > span:last-child")).toBeVisible();
      await expect(compactHeader).not.toHaveClass(/is-visible/);

      const layout = await page.evaluate(() => {
        const heading = document.querySelector<HTMLElement>(".rm-engine-intro h2")!.getBoundingClientRect();
        const paragraph = document.querySelector<HTMLElement>(".rm-engine-intro p")!.getBoundingClientRect();
        return {
          headingBottom: heading.bottom,
          headingLeft: heading.left,
          headingRight: heading.right,
          paragraphTop: paragraph.top,
          paragraphLeft: paragraph.left,
          paragraphWidth: paragraph.width,
        };
      });
      if (width >= 1100) {
        expect(layout.paragraphTop).toBeLessThan(layout.headingBottom);
        expect(layout.paragraphLeft).toBeGreaterThan(layout.headingRight);
        expect(layout.paragraphWidth).toBeLessThanOrEqual(481);
      } else {
        expect(layout.paragraphTop).toBeGreaterThan(layout.headingBottom);
        expect(Math.abs(layout.paragraphLeft - layout.headingLeft)).toBeLessThanOrEqual(1);
        expect(layout.paragraphWidth).toBeLessThanOrEqual(721);
      }
      await expectNoHorizontalOverflow(page);

      await page.evaluate(() => {
        const heroLead = document.querySelector<HTMLElement>(".rm-home-hero > p")!;
        window.scrollTo(0, window.scrollY + heroLead.getBoundingClientRect().bottom - 32);
      });
      await expect(compactHeader).toHaveClass(/is-visible/);
      await expect.poll(async () => Math.round((await compactHeader.boundingBox())?.y ?? -64)).toBe(0);

      const compactLayout = await compactHeader.evaluate(element => {
        const wordmark = element.querySelector<HTMLElement>(".rm-wordmark")!.getBoundingClientRect();
        const actions = element.querySelector<HTMLElement>(".rm-scroll-header-action")!.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          top: Math.round(element.getBoundingClientRect().top),
          height: Math.round(element.getBoundingClientRect().height),
          position: style.position,
          shadow: style.boxShadow,
          collision: wordmark.right > actions.left,
        };
      });
      expect(compactLayout).toEqual({ top: 0, height: 64, position: "fixed", shadow: "none", collision: false });
      await expectNoHorizontalOverflow(page);

      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(compactHeader).not.toHaveClass(/is-visible/);
    }
  });

  for (const route of themedCustomerRoutes) {
    test(`${route} inherits the homepage visual system`, async ({ page }) => {
      await page.goto(route, { waitUntil: "load" });

      const isHomepage = route === "/";
      const main = page.locator("main");
      const header = page.locator(".rm-header");
      const heading = main.locator("h1").first();
      await expect(main).toBeVisible();
      await expect(header).toBeVisible();
      await expect(page.locator(".rm-nav-directory > button")).toBeVisible({ visible: !isHomepage || (await page.viewportSize())!.width > 520 });
      await expect(heading).toBeVisible();
      await expect(main).toHaveCSS("background-color", "rgb(248, 247, 244)");

      const contract = await page.evaluate(() => {
        const root = document.querySelector<HTMLElement>("main")!;
        const title = root.querySelector<HTMLElement>("h1")!.getBoundingClientRect();
        const siteHeader = root.querySelector<HTMLElement>(":scope > .rm-header")!;
        const headerSurface = siteHeader.querySelector<HTMLElement>(".rm-header-inner")!;
        const headerLinks = [...document.querySelectorAll<HTMLElement>(".rm-header a")];
        return {
          fontFamily: getComputedStyle(root).fontFamily,
          titleLeft: title.left,
          titleRight: title.right,
          viewport: document.documentElement.clientWidth,
          pageWidth: document.documentElement.scrollWidth,
          headerPosition: getComputedStyle(siteHeader).position,
          headerShadow: getComputedStyle(headerSurface).boxShadow,
          cleanHeaderSurfaces: headerLinks.every(link => getComputedStyle(link).backgroundImage === "none"),
        };
      });

      expect(contract.fontFamily).toContain("Helvetica Neue");
      expect(contract.titleLeft).toBeGreaterThanOrEqual(0);
      expect(contract.titleRight).toBeLessThanOrEqual(contract.viewport + 1);
      expect(contract.pageWidth).toBeLessThanOrEqual(contract.viewport + 1);
      expect(contract.cleanHeaderSurfaces).toBe(true);
      expect(contract.headerPosition).toBe(isHomepage ? "relative" : contract.viewport <= 700 ? "fixed" : "sticky");
      if (isHomepage) {
        expect(contract.headerShadow).toBe("none");
      } else {
        expect(contract.headerShadow).toContain("12px");
        expect(contract.headerShadow).not.toContain("18px");
        expect(contract.headerShadow).not.toContain("34px");
      }

      await page.evaluate(() => window.scrollTo(0, Math.min(900, document.documentElement.scrollHeight)));
      if (isHomepage) {
        await expect(page.locator(".rm-scroll-header")).toHaveClass(/is-visible/);
        await expect.poll(() => page.locator(".rm-scroll-header").evaluate(element => Math.round(element.getBoundingClientRect().top))).toBe(0);
      } else {
        await expect.poll(() => page.locator(".rm-header").evaluate(element => Math.round(element.getBoundingClientRect().top))).toBe(0);
        await expect(header).toBeVisible();
      }

      await expect(page.locator(".rm-main-nav-links")).toHaveCount(0);
    });
  }

  test("customer journeys use the homepage composition without changing their copy", async ({ page }) => {
    const pages = [
      { route: "/analyze", heading: "Find the decision that keeps repeating.", module: ".batch-intake", desktopColumns: 2 },
      { route: "/replay-upload", heading: "Your replay files are already on your PC.", module: ".replay-find", grid: ".replay-find-grid", desktopColumns: 3 },
      { route: "/reports", heading: "Your reports.", module: ".reports-empty", desktopColumns: 1 },
      { route: "/guides/rocket-league-replay-review-checklist", heading: "Stop watching the goal. Find the decision that caused it.", module: ".guide-scorecard", desktopColumns: 4 },
      { route: "/privacy", heading: "Your data should never be another hidden system.", module: ".legal-grid", desktopColumns: 2 },
      { route: "/terms", heading: "No card. No hidden purchase.", module: ".legal-grid", desktopColumns: 2 },
      { route: "/beta-terms", heading: "One real match. No fake promise.", module: ".legal-grid", desktopColumns: 2 },
      { route: "/rocket-league-beta", heading: "Help teach the engine what a good decision looks like.", module: ".rl-beta-shell", desktopColumns: 2 },
    ];

    for (const current of pages) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(current.route, { waitUntil: "load" });
      await expect(page.locator("main h1").first()).toHaveText(current.heading);
      await expect(page.locator(current.module)).toHaveCSS("background-color", "rgb(7, 25, 43)");

      const desktopGrid = current.grid || current.module;
      const desktopColumns = await page.locator(desktopGrid).evaluate(element => getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length);
      expect(desktopColumns, `${current.route} desktop columns`).toBe(current.desktopColumns);

      await page.setViewportSize({ width: 390, height: 844 });
      const mobileColumns = await page.locator(desktopGrid).evaluate(element => getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length);
      expect(mobileColumns, `${current.route} mobile columns`).toBe(1);
      await expectNoHorizontalOverflow(page);
    }
  });

  test("the method funnel copy stays exact and the footer uses a left-aligned editorial grid", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/#method", { waitUntil: "load" });

    await expect(page.locator(".rm-home-how header > .reveal-kicker")).toHaveText("How does Replay Method work?");
    await expect(page.locator(".rm-home-how header > .reveal-kicker")).toHaveCSS("background-color", "rgb(18, 42, 62)");
    await expect(page.locator(".rm-home-how header > .reveal-kicker")).toHaveCSS("color", "rgb(250, 250, 248)");
    await expect(page.locator(".rm-home-how h2")).toHaveText("By filtering out unnecessary hours of frustrating tilt, Replay Method delivers focused, easy-to-apply practice and a crystal clear breakdown of exactly what you need to change in your game.");
    await expect(page.locator(".rm-home-how-intro p").nth(0)).toHaveText("Start your climb for free by uploading your 10 latest ranked .replay files, pinpointing exactly what to improve with targeted drills to memorize the changes.");
    await expect(page.locator(".rm-home-how-intro p").nth(1)).toHaveText("Planned Premium extends this method by letting you upload up to 35 ranked .replay files each week. You'll receive a complete analysis paired with tailored coaching that is easy to follow and apply in your games throughout the next week.");
    await expect(page.locator(".rm-home-trust")).toHaveCount(0);
    await expect(page.locator(".rm-home-hero-category")).toHaveText("Rocket League replay analysis for PC");
    await expect(page.locator(".rm-home-hero > p")).toHaveText("Replay Method is designed to work across up to 35 ranked RL .replay files each week—uncovering the habits, decisions and game-sense patterns keeping you hardstuck. Instead of hours of frustrating tilt and guesswork, you get a crystal-clear breakdown grounded in your own matches, tailored coaching and targeted drills that show you exactly what to change, help each adjustment stick and make it easier to apply in your next games.");
    await expect(page.locator(".rm-home-hero-assurance")).toHaveText("Free first analysis. No card required. PC .replay files only.");
    await expect(page.locator(".rm-home-hero-assurance strong")).toHaveText("Free first analysis.");
    await expect(page.locator(".reveal-home-intake .rm-section-prompt")).toHaveCount(0);
    await expect(page.locator(".reveal-home-intake-head strong")).toHaveText("Analyze your first 10 ranked replays for free.");
    await expect(page.locator(".reveal-home-drop > b")).toHaveText("Choose your 10 ranked .replay files");
    await expect(page.locator(".reveal-home-upload-guidance")).toHaveText("Before you upload, play one fresh set of 10 ranked games in your preferred game mode. Save every .replay file and upload the complete set. That gives Replay Method the most honest picture of your game—and the most useful analysis. No card required.");
    await expect(page.locator(".rm-engine-intro .rm-section-prompt")).toHaveCount(0);
    await expect(page.locator(".rm-engine-intro > p")).toHaveText("Heads up! This interactive demo is intentionally stripped down. Beyond it, the method can scale to support up to 35 .replay files per week, pairing a complete breakdown with tailored coaching and targeted drills that help you memorize each change and bring it into your games. Open the exact matches and timestamps, then compare them with the analysis yourself.");
    const freeTab = page.getByRole("tab", { name: "Free method" });
    const premiumTab = page.getByRole("tab", { name: "Planned Premium" });
    await expect(freeTab).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(".rm-home-how li h3").nth(0)).toHaveText("Upload one set of 10 ranked replays.");
    await expect(page.locator(".rm-home-how li h3").nth(1)).toHaveText("Find what keeps you hardstuck.");
    await expect(page.locator(".rm-home-how li h3").nth(2)).toHaveText("Start with the change that matters most.");
    await expect(page.locator(".rm-home-how li p").nth(0)).toHaveText("Start your climb by uploading 10 ranked .replay files from the same player and game mode. Don’t cherry-pick the games where you played at your best, mechanically or game-sense-wise. Better yet, play 10 fresh ranked games in your preferred mode before uploading, so the Replay Engine gets a true picture of how you normally play and a stronger foundation for your climb.");
    await expect(page.locator(".rm-home-how li p").nth(1)).toHaveText("Replay Method works through all 10 of your replays to identify the habits, decisions, game-sense patterns and mechanics that repeatedly hold you back. When you’ve spent hours playing a certain way, those patterns can be hard to notice on your own — and even harder to break. Instead of leaving you to spot every mistake yourself, including the small, easy-to-miss patterns that can quietly cost you games, the Replay Engine does the heavy lifting. It turns what it finds into a crystal-clear plan: what needs to change, why it matters, where you should focus first, and which drills or game-sense adjustments will help you apply those changes in your next games.");
    await expect(page.locator(".rm-home-how li p").nth(2)).toHaveText("Your improvement plan turns the patterns found across your 10 replays into a focused set of changes to work on first. Use the recommended drills and simple game-sense cues to practice each change, then take them into your next ranked sessions until they start to become part of how you play. Instead of trying to fix everything at once, you always know what to focus on next as you continue your climb.");
    await expect(page.locator(".rm-home-how-premium-note")).toHaveText("Want to keep the method going? Premium extends the same cycle across a larger set of replays each week, with tailored coaching that develops alongside your game.");

    const darkPalette = await page.evaluate(() => {
      const lightSurfaceSelectors = [
        ".rm-header-cta",
        ".rm-home-hero-actions > a:first-child",
        ".rm-simple-demo-action > a",
      ];
      const darkSurfaceSelectors = [
        ".rm-home-how .rm-section-prompt-inverse",
        ".rm-home-how-switch button[aria-selected='true']",
        ".rm-home-final-action > a",
      ];
      const lightSurfaceStyles = lightSurfaceSelectors.map(selector => getComputedStyle(document.querySelector<HTMLElement>(selector)!));
      const darkSurfaceStyles = darkSurfaceSelectors.map(selector => getComputedStyle(document.querySelector<HTMLElement>(selector)!));
      const styles = [...lightSurfaceStyles, ...darkSurfaceStyles];
      const arrowStyles = [
        ".rm-home-hero-actions > a:first-child > span",
        ".rm-home-final-action > a > span",
        ".rm-simple-demo-action > a > i",
      ].map(selector => getComputedStyle(document.querySelector<HTMLElement>(selector)!));
      return {
        lightSurfaceBackgrounds: lightSurfaceStyles.map(style => style.backgroundColor),
        darkSurfaceBackgrounds: darkSurfaceStyles.map(style => style.backgroundColor),
        colors: styles.map(style => style.color),
        radii: styles.map(style => style.borderRadius),
        arrowBackgrounds: arrowStyles.map(style => style.backgroundColor),
        arrowColors: arrowStyles.map(style => style.color),
      };
    });
    expect(new Set(darkPalette.lightSurfaceBackgrounds).size).toBe(1);
    expect(new Set(darkPalette.darkSurfaceBackgrounds).size).toBe(1);
    expect(darkPalette.lightSurfaceBackgrounds[0]).toBe("rgb(7, 25, 43)");
    expect(darkPalette.darkSurfaceBackgrounds[0]).toBe("rgb(18, 42, 62)");
    expect(new Set(darkPalette.colors).size).toBe(1);
    expect(new Set(darkPalette.radii).size).toBe(1);
    expect(new Set(darkPalette.arrowBackgrounds).size).toBe(1);
    expect(new Set(darkPalette.arrowColors).size).toBe(1);

    await premiumTab.click();
    await expect(premiumTab).toHaveAttribute("aria-selected", "true");
    await expect(premiumTab).toHaveCSS("background-color", darkPalette.darkSurfaceBackgrounds[0]);
    await expect(premiumTab).toHaveCSS("color", darkPalette.colors[0]);
    await expect(page.locator(".rm-home-how li h3").nth(0)).toHaveText("Upload up to 35 ranked replays every week.");
    await expect(page.locator(".rm-home-how li h3").nth(1)).toHaveText("Let Replay Method connect the patterns.");
    await expect(page.locator(".rm-home-how li h3").nth(2)).toHaveText("Get weekly coaching tailored to how your game improves.");
    await expect(page.locator(".rm-home-how li p").nth(0)).toHaveText("Upload up to 35 ranked .replay files from the same player and game mode each week. That can be as simple as five ranked games a day, giving Replay Method a much broader view of how you actually play throughout the week. With more matches to work from, it becomes easier to separate one-off mistakes from the habits, decisions and game-sense patterns that consistently shape your games.");
    await expect(page.locator(".rm-home-how li p").nth(1)).toHaveText("With a larger set to work from, Replay Method can build a more complete picture of what repeatedly holds you back across your mechanics, decisions and game sense. By connecting patterns across your matches, the Replay Engine can prioritize what deserves your attention first and turn the findings into a complete breakdown paired with tailored coaching — including what to change, why it matters, what to practice and how to approach it in your games.");
    await expect(page.locator(".rm-home-how li p").nth(2)).toHaveText("Your coaching gives you a clear focus for the week ahead, with targeted drills, simple game-sense cues and practical changes you can take straight into ranked. Instead of trying to remember a long list of problems or deciding what to work on yourself, you can focus on the changes that matter most and apply them one at a time. Play your games, put the coaching into practice, then bring your next set back to Replay Method and keep the cycle moving as your game develops.");
    await expect(page.locator(".rm-home-how li")).toHaveCount(3);
    await expectNoHorizontalOverflow(page);

    const displayFont = await page.locator(".rm-home-hero h1").evaluate(element => getComputedStyle(element).fontFamily);
    expect(displayFont).toContain("Helvetica Neue");
    expect(displayFont).not.toContain("-apple-system");
    await expect(page.locator(".rm-footer")).not.toContainText("Turn repeated mistakes into focused improvement.");

    const geometry = await page.evaluate(() => {
      const navs = [...document.querySelectorAll<HTMLElement>(".rm-footer nav")];
      const howPanel = document.querySelector<HTMLElement>(".rm-home-how-panel")!.getBoundingClientRect();
      const finalPanel = document.querySelector<HTMLElement>(".rm-home-final")!.getBoundingClientRect();
      const footer = document.querySelector<HTMLElement>(".rm-footer-grid")!.getBoundingClientRect();
      const brand = document.querySelector<HTMLElement>(".rm-footer-brand")!.getBoundingClientRect();
      const disclaimer = document.querySelector<HTMLElement>(".rm-footer-grid > small")!;
      return {
        widths: navs.map(nav => Math.round(nav.getBoundingClientRect().width)),
        leftAlignedNavCopy: navs.every(nav => getComputedStyle(nav).textAlign === "left" && getComputedStyle(nav).alignItems === "flex-start"),
        brandStartsFooter: Math.abs(brand.left - footer.left) <= 1,
        brandPrecedesNavigation: brand.right < navs[0].getBoundingClientRect().left,
        integratedDisclaimer: getComputedStyle(disclaimer).backgroundColor === "rgba(0, 0, 0, 0)"
          && getComputedStyle(disclaimer).textAlign === "left"
          && getComputedStyle(disclaimer).borderTopStyle === "solid"
          && Math.abs(disclaimer.getBoundingClientRect().left - footer.left) <= 1,
        relatedPanels: Math.abs(howPanel.width - finalPanel.width) <= 1
          && getComputedStyle(document.querySelector<HTMLElement>(".rm-home-how-panel")!).borderRadius === getComputedStyle(document.querySelector<HTMLElement>(".rm-home-final")!).borderRadius
          && getComputedStyle(document.querySelector<HTMLElement>(".rm-home-how-panel")!).backgroundColor === getComputedStyle(document.querySelector<HTMLElement>(".rm-home-final")!).backgroundColor,
      };
    });

    expect(new Set(geometry.widths).size).toBe(1);
    expect(geometry.leftAlignedNavCopy).toBe(true);
    expect(geometry.brandStartsFooter).toBe(true);
    expect(geometry.brandPrecedesNavigation).toBe(true);
    expect(geometry.integratedDisclaimer).toBe(true);
    expect(geometry.relatedPanels).toBe(true);
  });

  test("the homepage uses one canvas and groups details without decorative rules", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/#product", { waitUntil: "load" });

    const appearance = await page.evaluate(() => {
      const style = (selector: string) => getComputedStyle(document.querySelector<HTMLElement>(selector)!);
      const transparent = "rgba(0, 0, 0, 0)";
      const sections = [".rm-home-hero", ".rm-engine-section", ".rm-home-how", ".rm-footer"];
      const borderless = [
        ".rm-simple-demo-tease",
        ".rm-product-demo-foot",
        ".rm-footer-brand",
        ".rm-footer nav",
      ];
      return {
        canvas: style("main.reveal-home").backgroundColor,
        transparentSections: sections.every(selector => style(selector).backgroundColor === transparent),
        borderlessGroups: borderless.every(selector => {
          const current = style(selector);
          return current.borderTopWidth === "0px" && current.borderBottomWidth === "0px";
        }),
        footerDivider: style(".rm-footer-grid > small").borderTopStyle === "solid",
        demoNotesAreContained: style(".rm-simple-demo-tease").backgroundColor !== transparent
          && style(".rm-product-demo-foot > span").backgroundColor !== transparent,
      };
    });

    expect(appearance).toEqual({
      canvas: "rgb(248, 247, 244)",
      transparentSections: true,
      borderlessGroups: true,
      footerDivider: true,
      demoNotesAreContained: true,
    });
  });

  test("the home hero leads directly to the inline ten-replay intake", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    await expect(page.locator('main.marcel-home[data-hydrated="true"]')).toBeVisible();
    await page.locator(".rm-home-hero-actions").getByRole("link", { name: /Analyze 10 \.replay files for free/ }).click();
    await expect(page).toHaveURL(/\/#ten-replay-start$/);
    await expect(page.getByText("Choose your 10 ranked .replay files", { exact: true })).toBeVisible();
    await expect(page.locator("#ten-replay-start .reveal-home-intake-steps")).toHaveCount(0);
    await expect(page.locator("#ten-replay-start .reveal-home-intake-head p")).toHaveCount(0);
    await expect(page.locator('#ten-replay-start input[type="file"][multiple]')).toHaveCount(1);
    await expect(page.getByText("We check every file before the analysis starts.", { exact: true })).toHaveCount(0);
    await expect.poll(() => page.locator(".rm-home-activation").evaluate(element => {
      const rect = element.getBoundingClientRect();
      return Math.abs(Math.round(rect.top + rect.height / 2 - window.innerHeight / 2));
    })).toBeLessThanOrEqual(1);
    const helpLinks = page.locator(".rm-home-activation .reveal-home-help a");
    await expect(helpLinks).toHaveCount(2);
    await expect(page.locator(".rm-home-activation .reveal-home-help")).toHaveCSS("border-top-style", "none");
    await expect(helpLinks.first()).toHaveCSS("border-top-style", "solid");
    await expect(helpLinks.first()).toHaveCSS("text-decoration-line", "none");
    const restingBackground = await helpLinks.first().evaluate(element => getComputedStyle(element).backgroundColor);
    await helpLinks.first().hover();
    await expect(helpLinks.first()).toHaveCSS("transform", "none");
    await expect.poll(() => helpLinks.first().evaluate(element => getComputedStyle(element).backgroundColor)).not.toBe(restingBackground);
    await helpLinks.last().focus();
    await expect(helpLinks.last()).toBeFocused();
  });

  test("the homepage intake reveals only the next useful step after file selection", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    await expect(page.locator('main.marcel-home[data-hydrated="true"]')).toBeVisible();
    const input = page.locator('#ten-replay-start input[type="file"]');

    await input.setInputFiles({ name: "screenshot.png", mimeType: "image/png", buffer: Buffer.from("not-a-replay") });
    await expect(page.locator("#ten-replay-start")).toHaveAttribute("data-state", "needs-file");
    await expect(page.getByText("Choose an original .replay file to continue.", { exact: true })).toBeVisible();
    await expect(page.locator("#ten-replay-start .reveal-home-fields")).toHaveCount(0);
    await expect(page.locator("#ten-replay-start .reveal-home-files article.excluded")).toHaveCount(1);

    await input.setInputFiles({ name: "ranked-01.replay", mimeType: "application/octet-stream", buffer: Buffer.from("synthetic-replay") });
    await expect(page.locator("#ten-replay-start")).toHaveAttribute("data-state", "active");
    await expect(page.getByText("Complete your 10-match set.", { exact: true })).toBeVisible();
    const contextHeading = page.getByRole("heading", { name: "Where should we send what the Replay Engine finds?" });
    await expect(contextHeading).toBeVisible();
    await expect(contextHeading).toHaveCSS("font-family", /Helvetica Neue/);
    await expect(page.locator("#ten-replay-start .reveal-home-context-intro")).toHaveCSS("animation-name", "rm-intake-section-enter");
    await expect(page.locator("#ten-replay-start .reveal-home-fields")).toBeVisible();
    await expect(page.getByLabel("Current playlist rank").locator("option", { hasText: "Supersonic Legend" })).toHaveCount(0);

    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await expectNoHorizontalOverflow(page);
      await expect(page.locator("#ten-replay-start .reveal-home-submit")).toBeVisible();
    }
  });

  test("the final Curious CTA centers the same upload surface", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    await expect(page.locator('main.marcel-home[data-hydrated="true"]')).toBeVisible();
    await page.locator(".rm-home-final-action").getByRole("link", { name: /Analyze 10 \.replay files for free/ }).click();
    await expect(page).toHaveURL(/\/#ten-replay-start$/);
    await expect.poll(() => page.locator(".rm-home-activation").evaluate(element => {
      const rect = element.getBoundingClientRect();
      return Math.abs(Math.round(rect.top + rect.height / 2 - window.innerHeight / 2));
    })).toBeLessThanOrEqual(1);
  });

  test.skip("legacy six-stage product loop geometry", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    await expectLandingFunnel(page);
    await expect(page.locator(".reveal-review-controls")).toHaveCount(0);
    await expect(page.locator(".reveal-legend")).toHaveCount(0);
    await expect(page.locator(".reveal-goal")).toHaveCount(2);
    await expect(page.locator(".reveal-goal-arc")).toHaveCount(2);
    await expect(page.locator(".reveal-pitch")).toHaveCount(1);
    await expect(page.locator(".reveal-pitch-boundary")).toHaveCount(1);
    await expect(page.locator(".reveal-car")).toHaveCount(4);
    await expect(page.locator(".car-you span")).toHaveText("YOU");
    expect(await page.locator(".car-you").evaluate(element => getComputedStyle(element, "::after").content)).toBe("none");
    expect(await page.locator(".car-you").evaluate(element => getComputedStyle(element, "::before").content)).not.toBe("none");
    const goldOutline = await page.locator(".car-you").evaluate(element => getComputedStyle(element).boxShadow);
    expect(goldOutline).toContain("236, 239, 235");
    expect(goldOutline).toContain("201, 155, 49");
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
    await expect(page.locator("#loop-stage-panel")).toContainText("You follow.");
    await page.waitForTimeout(800);
    const mistakeOpponent = await page.locator(".car-opp").boundingBox();
    const mistakeOpponentTwo = await page.locator(".car-opp-two").boundingBox();
    const mistakeBall = await page.locator(".reveal-ball").boundingBox();
    const mistakeBallTop = await page.locator(".reveal-ball").evaluate(element => (element as HTMLElement).offsetTop);
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
    expect(mistakeMate!.x + mistakeMate!.width / 2).toBeLessThan(mistakeBall!.x + mistakeBall!.width / 2);
    expect(mistakeUser!.x).toBeLessThan(mistakeMate!.x - mistakeField!.width * 0.08);
    expect(centerDistance(mistakeUser!, mistakeMate!)).toBeGreaterThan(mistakeField!.width * 0.08);
    expect(mistakeOpponent!.x).toBeGreaterThan(mistakeBall!.x);
    const mistakeContact = await lowerRightNoseCornerContact(".car-opp");
    // Rendering engines can land the intended tangent contact a few hundredths
    // of a CSS pixel inside the ball after transforms are rasterized.
    expect(mistakeContact.surfaceGap).toBeGreaterThanOrEqual(-0.5);
    expect(mistakeContact.surfaceGap).toBeLessThanOrEqual(2);
    expect(mistakeContact.horizontalOffset).toBeGreaterThan(0);
    expect(await rotationDegrees(".car-you")).toBeCloseTo(33, 0);
    expect(await rotationDegrees(".car-mate")).toBeCloseTo(34, 0);
    expect(centerDistance(mistakeOpponent!, mistakeBall!)).toBeLessThan(mistakeField!.width * 0.09);
    await page.getByRole("tab", { name: /^02 / }).press("ArrowRight");
    await expect(page.getByRole("tab", { name: /^03 / })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#loop-stage-panel")).toContainText("The net opens.");
    await expect(page.locator("#loop-stage-panel")).toContainText("Nobody is left to cover the next touch.");
    // WebKit on compact viewports can start the 900 ms scene transition a few
    // frames after the tab state changes. Measure the settled composition.
    await page.waitForTimeout(1600);
    const consequenceField = await page.locator(".reveal-field").boundingBox();
    const consequenceOpponent = await page.locator(".car-opp").boundingBox();
    const consequenceOpponentTwo = await page.locator(".car-opp-two").boundingBox();
    const consequenceBall = await page.locator(".reveal-ball").boundingBox();
    const consequenceBallTop = await page.locator(".reveal-ball").evaluate(element => (element as HTMLElement).offsetTop);
    const consequenceUser = await page.locator(".car-you").boundingBox();
    const consequenceMate = await page.locator(".car-mate").boundingBox();
    expect(mistakeOpponent && consequenceField && consequenceOpponent && consequenceOpponentTwo && consequenceBall && consequenceUser && consequenceMate).toBeTruthy();
    // Compare vertical motion inside the field. Mobile WebKit may preserve the
    // focused stage by adjusting the page scroll position when the copy panel
    // changes height, which makes viewport-relative y values incomparable.
    expect(consequenceOpponent!.y - consequenceField!.y).toBeGreaterThan(
      mistakeOpponent!.y - mistakeField!.y + consequenceField!.height * 0.08,
    );
    expect(consequenceOpponentTwo!.x).toBeLessThan(mistakeOpponentTwo!.x - consequenceField!.width * 0.02);
    expect(consequenceOpponentTwo!.y - consequenceField!.y).toBeLessThan(
      mistakeOpponentTwo!.y - mistakeField!.y - consequenceField!.height * 0.03,
    );
    expect(consequenceBall!.x).toBeLessThan(consequenceOpponent!.x);
    expect(consequenceBall!.x).toBeLessThan(consequenceField!.x + consequenceField!.width * 0.1);
    expect(consequenceBallTop).toBeGreaterThan(mistakeBallTop + consequenceField!.height * 0.08);
    expect(consequenceMate!.x).toBeGreaterThan(mistakeMate!.x + consequenceField!.width * 0.03);
    expect(consequenceMate!.y - consequenceField!.y).toBeGreaterThan(
      mistakeMate!.y - mistakeField!.y + consequenceField!.height * 0.06,
    );
    const shotStart = { x: consequenceBall!.x + consequenceBall!.width / 2, y: consequenceBall!.y + consequenceBall!.height / 2 };
    const shotEnd = { x: mistakeBall!.x + mistakeBall!.width / 2, y: mistakeBall!.y + mistakeBall!.height / 2 };
    const userCenterX = consequenceUser!.x + consequenceUser!.width / 2;
    const userShotProgress = (userCenterX - shotStart.x) / (shotEnd.x - shotStart.x);
    const shotYAtUser = shotStart.y + (shotEnd.y - shotStart.y) * userShotProgress;
    expect(consequenceUser!.y + consequenceUser!.height).toBeLessThan(shotYAtUser - 1.5);
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
    await expect(page.locator("#loop-stage-panel")).toContainText("Run it back.");
    await expect(page.locator(".reveal-field")).toHaveClass(/show-replay-cue/);
    await expect(page.locator(".reveal-restart")).toHaveCSS("animation-name", "reveal-restart-circle");
    await expect(page.locator(".reveal-scene")).toHaveCSS("animation-name", "rm-scene-dim");
    await expect(page.locator(".reveal-restart-spinner")).toHaveCSS("animation-name", "rm-rewind-soft");
    await expect(page.locator(".reveal-restart-mark")).toHaveCount(1);
    await expect(page.locator(".reveal-restart-mark svg")).toHaveCount(1);
    await expect(page.locator(".reveal-restart-mark")).toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(page.locator(".reveal-restart-arcs")).toHaveCount(0);
    await expect(page.locator(".reveal-restart-head")).toHaveCount(0);
    await expect(page.locator(".reveal-restart")).toHaveCSS("background-color", "rgba(7, 25, 43, 0.84)");
    await expect(page.locator(".reveal-goal-arc-left")).toHaveCSS("border-top-color", "rgba(7, 25, 43, 0.16)");
    await expect(page.locator(".reveal-goal-arc-right")).toHaveCSS("border-top-color", "rgba(7, 25, 43, 0.16)");
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
    expect(replayMotion.offsets).toHaveLength(4);
    expect(replayMotion.offsets[0]).toBe(0);
    expect(replayMotion.offsets.at(-1)).toBe(1);
    await page.waitForTimeout(1100);
    const rewindUser = await page.locator(".car-you").boundingBox();
    const rewindMate = await page.locator(".car-mate").boundingBox();
    const rewindMateTop = await page.locator(".car-mate").evaluate(element => (element as HTMLElement).offsetTop);
    const rewindOpponentTwo = await page.locator(".car-opp-two").boundingBox();
    await page.getByRole("tab", { name: /^05 / }).click();
    await page.waitForTimeout(1100);
    const decisionOpponent = await page.locator(".car-opp").boundingBox();
    const decisionOpponentTwo = await page.locator(".car-opp-two").boundingBox();
    const decisionBall = await page.locator(".reveal-ball").boundingBox();
    const decisionUser = await page.locator(".car-you").boundingBox();
    const decisionMate = await page.locator(".car-mate").boundingBox();
    const decisionMateTop = await page.locator(".car-mate").evaluate(element => (element as HTMLElement).offsetTop);
    expect(rewindUser && rewindMate && rewindOpponentTwo && decisionOpponent && decisionOpponentTwo && decisionBall && decisionUser && decisionMate && consequenceField).toBeTruthy();
    expect(decisionUser!.x).toBeLessThan(rewindUser!.x - consequenceField!.width * 0.05);
    expect(decisionMate!.x).toBeGreaterThan(rewindMate!.x + consequenceField!.width * 0.05);
    expect(rewindMateTop).toBeLessThan(decisionMateTop - consequenceField!.height * 0.08);
    expect(decisionOpponentTwo!.x + decisionOpponentTwo!.width / 2).toBeGreaterThan(rewindOpponentTwo!.x + rewindOpponentTwo!.width / 2);
    expect(decisionOpponentTwo!.y).toBeLessThan(rewindOpponentTwo!.y - consequenceField!.height * 0.15);
    expect(decisionOpponent!.x).toBeGreaterThan(decisionBall!.x);
    expect(decisionOpponent!.y).toBeLessThan(decisionBall!.y);
    const decisionContact = await lowerRightNoseCornerContact(".car-opp");
    expect(decisionContact.surfaceGap).toBeGreaterThanOrEqual(-0.5);
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
    expect(resultBall!.x - (resultUser!.x + resultUser!.width)).toBeGreaterThanOrEqual(0);
    expect(resultBall!.x - (resultUser!.x + resultUser!.width)).toBeLessThanOrEqual(6);
    expect(Math.abs((resultBall!.y + resultBall!.height / 2) - (resultUser!.y + resultUser!.height / 2))).toBeLessThanOrEqual(2);
    await expect(page.getByText("This demo", { exact: true })).toBeVisible();
    await expect(page.getByText("Your analysis", { exact: true })).toBeVisible();
    await page.locator(".rm-header-cta").click();
    await expect(page).toHaveURL(/\/analyze$/);
  });

  test.skip("legacy six-stage car geometry", async ({ page }) => {
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

  test.skip("legacy local demo variants", async ({ page }) => {
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

  test("the sample report connects ten replay faults to an illustrative recurring pattern and one focus", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    await page.locator("#product").scrollIntoViewIfNeeded();
    await expect(page.getByText("Interactive product demo", { exact: true })).toBeVisible();
    const demoLabelBar = page.locator(".rm-simple-demo .rm-product-demo-bar");
    const demoLabelMeta = demoLabelBar.locator("small");
    await expect(demoLabelBar).toHaveCSS("border-bottom-style", "solid");
    await expect(demoLabelBar).toHaveCSS("border-radius", "0px");
    await expect(demoLabelBar).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(demoLabelMeta).toHaveCSS("border-radius", "0px");
    await expect(demoLabelMeta).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(page.getByRole("tab", { name: "Booming the Ball Away fault example", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(".rm-report-demo-flow")).toHaveCount(0);
    await expect(page.locator('.rm-product-demo-nav [role="tab"]')).toHaveCount(10);
    await expect(page.locator("#product-example-panel")).toContainText("Keep the next useful touch.");
    await expect(page.locator("#product-example-panel")).toContainText("You have time and space, but hit the ball straight to the opponent.");
    await expect(page.locator("#product-example-panel")).toContainText("If nobody is forcing you, take one controlled touch");
    await expect(page.locator("#product-example-panel")).toContainText("Illustrative example");
    await expect(page.locator("#product-example-panel")).toContainText("Champion II");
    await expect(page.locator("#product-example-panel")).toContainText("Ranked 2v2");
    await expect(page.locator(".rm-demo-metrics")).toContainText("4/10");
    await expect(page.locator(".rm-demo-metrics")).toContainText("9");
    await expect(page.locator(".rm-demo-breakdown")).not.toHaveAttribute("open", "");
    await page.locator(".rm-demo-breakdown summary").click();
    await expect(page.locator(".rm-demo-breakdown")).toHaveAttribute("open", "");
    await expect(page.locator(".rm-demo-breakdown-row")).toHaveCount(4);
    await expect(page.locator(".rm-demo-breakdown")).toContainText("01:14.20");
    await expect(page.locator(".rm-product-demo select")).toHaveCount(0);
    await expect(page.getByText("YOU", { exact: true })).toHaveCount(0);
    await expect(page.locator(".reveal-car, .reveal-ball, .reveal-restart, .rm-engine-object, .rm-engine-ball, .rm-product-replay-card, .rm-sample-media-adapter")).toHaveCount(0);
    await expect(page.locator(".rm-report-replay-list, .rm-report-moment, .rm-report-followup")).toHaveCount(0);

    await page.getByRole("tab", { name: "Boost Over Ball fault example", exact: true }).click();
    await expect(page.locator("#product-example-panel")).toContainText("Stay connected to the play.");
    await page.getByRole("tab", { name: "Boost Over Ball fault example", exact: true }).press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Ball-Side Rotation fault example", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#product-example-panel")).toContainText("Recover through the far side.");

    const demo = page.locator(".rm-product-demo");
    await demo.evaluate((element) => {
      const swipe = (type: string, clientX: number) => {
        const event = new Event(type, { bubbles: true });
        Object.defineProperty(event, "changedTouches", { value: [{ clientX }] });
        element.dispatchEvent(event);
      };
      swipe("touchstart", 120);
      swipe("touchend", 320);
    });
    await expect(page.getByRole("tab", { name: "Boost Over Ball fault example", exact: true })).toHaveAttribute("aria-selected", "true");
  });

  test("the sample report is understandable immediately without autoplay", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    await page.locator("#product").scrollIntoViewIfNeeded();
    await expect(page.getByRole("heading", { name: "Booming the Ball Away", exact: true })).toBeVisible();
    await expect(page.locator(".rm-simple-demo-action")).toContainText("Keep the next useful touch.");
    await expect(page.locator(".rm-simple-demo-finding article")).toContainText("You have time and space, but hit the ball straight to the opponent.");
    await expect(page.locator(".rm-simple-demo-action")).not.toContainText("Your report stays private. No card needed.");
    await expect(page.locator(".rm-product-demo-foot")).toContainText("Your report stays private. No card needed.");
    await expect(page.getByRole("button", { name: /Pause demo|Play demo|Replay animation/ })).toHaveCount(0);
    await expect(page.locator(".rm-simple-demo-grid")).toHaveCSS("animation-name", "none");

    const staticMethodCard = page.locator(".rm-home-how li").first();
    await staticMethodCard.hover();
    await expect(staticMethodCard).toHaveCSS("transform", "none");
  });

  test("reduced motion keeps the product loop legible without animated state", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/", { waitUntil: "load" });
    await expectLandingFunnel(page);
    await expect(page.locator(".rm-simple-demo-grid")).toHaveCSS("animation-name", "none");
    await expect(page.locator(".rm-home-hero-actions a").first()).toHaveCSS("transition-duration", "0s");
    await expect(page.locator(".rm-simple-demo-action h4")).toHaveText("Keep the next useful touch.");
    await page.locator(".rm-home-hero-actions").getByRole("link", { name: /Analyze 10 \.replay files for free/ }).click();
    await expect(page).toHaveURL(/\/#ten-replay-start$/);
  });

  test("the intake requires exactly ten originals and one shared context", async ({ page }) => {
    await page.goto("/analyze", { waitUntil: "load" });
    await expect(page.locator('main.batch-intake-page[data-hydrated="true"]')).toBeVisible();
    await expect(page.locator(".intake-card")).toBeVisible();
    await expect(page.getByText("Choose ten ranked matches.", { exact: true })).toBeVisible();
    await expect(page.getByLabel("0 of 10 verified replays")).toHaveCount(0);
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

  test("a completed batch never replaces the homepage upload funnel", async ({ page }) => {
    const saved = {
      batchId: "ready-batch",
      batchToken: "ready-token",
      reportUrl: "/report/ready-batch?token=ready-token",
      validCount: 10,
      targetCount: 10,
      status: "ready",
    };
    await page.addInitScript((value) => localStorage.setItem("replaymethod-ten-replay-batch", JSON.stringify(value)), saved);
    await page.goto("/", { waitUntil: "load" });
    await expect(page.getByText("Analyze your first 10 ranked replays for free.", { exact: true })).toBeVisible();
    await expect(page.getByText("Your private report is ready", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Your ten-match report is ready.", { exact: true })).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => localStorage.getItem("replaymethod-ten-replay-batch"))).toBeNull();
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

  test("landing explains the player problem, program and self-verification without an FAQ detour", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    await expectLandingFunnel(page);
    await expect(page.locator(".rm-home-trust")).toHaveCount(0);
    await expect(page.locator(".rm-engine-intro").getByText(/Open the exact matches and timestamps/i)).toBeVisible();
    await expect(page.locator(".rm-demo-breakdown time")).not.toHaveCount(0);
  });

  test("the public start link reaches the same 10-replay intake on mobile and desktop", async ({ page }) => {
    await page.goto("/?utm_source=community&token=private", { waitUntil: "load" });
    await expectLandingFunnel(page);
    await page.locator(".rm-home-hero-actions").getByRole("link", { name: /Analyze 10 \.replay files for free/ }).click();
    await expect(page).toHaveURL(/#ten-replay-start$/);
    await page.getByRole("link", { name: /Use the full upload page/ }).click();
    await expect(page).toHaveURL(/\/analyze$/);
    await expect(page.getByRole("heading", { name: /Find the decision that keeps repeating/i })).toBeVisible();
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
    await expect(page.getByText(/Premium · planned/i)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Curious?" })).toBeVisible();
    await expect(page.locator('[data-plan="monthly"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: /buy|subscribe|checkout/i })).toHaveCount(0);
  });

  test("invalid analysis API input rejects before storing a replay", async ({ request, baseURL }) => {
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
      headers: { Origin: new URL(baseURL!).origin },
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
      for (const route of [
        "/",
        "/analyze",
        "/replay-upload",
        "/reports",
        "/guides/rocket-league-replay-review-checklist",
        "/privacy",
        "/terms",
        "/beta-terms",
        "/rocket-league-beta",
        "/billing/success",
        "/this-page-does-not-exist",
      ]) {
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
