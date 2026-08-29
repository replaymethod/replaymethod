import { expect, test } from "@playwright/test";

const routes = [
  ["home", "/"],
  ["analyze", "/analyze"],
  ["replay-upload", "/replay-upload"],
  ["guides", "/guides"],
  ["climb-check", "/climb-check"],
  ["review-guide", "/guides/rocket-league-replay-review-checklist"],
  ["league", "/league"],
  ["valorant", "/valorant"],
  ["rocket-league", "/rocket-league"],
  ["privacy", "/privacy"],
  ["terms", "/terms"],
  ["beta-terms", "/beta-terms"],
  ["reports", "/reports"],
  ["billing-success", "/billing/success"],
  ["rocket-league-beta", "/rocket-league-beta"],
  ["invalid-access", "/access/not-a-valid-token"],
  ["not-found", "/definitely-not-a-page"],
  ["report-queued", "/report/11111111111111111111111111111111"],
  ["report-processing", "/report/22222222222222222222222222222222"],
  ["report-ready", "/report/33333333333333333333333333333333"],
  ["report-failed", "/report/44444444444444444444444444444444"],
  ["report-unsupported", "/report/55555555555555555555555555555555"],
  ["report-abstained", "/report/66666666666666666666666666666666"],
] as const;

test("46-state sitewide visual matrix", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "The visual matrix runs once in deterministic Chromium.");
  test.setTimeout(180_000);

  await page.route("https://replaymethod.xyz/manifest.webmanifest", route => route.fulfill({
    status: 200,
    contentType: "application/manifest+json",
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({ name: "Replay Method", start_url: "/" }),
  }));

  for (const viewport of [
    { name: "desktop", width: 1440, height: 1000 },
    { name: "mobile", width: 390, height: 844 },
  ] as const) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const [name, route] of routes) {
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(response?.status(), `${route} returned a server error`).toBeLessThan(500);
      await expect(page.locator("main")).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect.poll(() => page.evaluate(() => document.fonts.status)).toBe("loaded");

      const geometry = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        headings: document.querySelectorAll("main h1").length,
        header: Boolean(document.querySelector("main > .rm-header")),
        footer: Boolean(document.querySelector("main > .rm-footer")),
      }));
      expect(geometry, `${viewport.name} ${route}`).toEqual({ overflow: 0, headings: 1, header: true, footer: true });

      const screenshotPath = testInfo.outputPath(`${viewport.name}-${name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true, animations: "disabled" });
      await testInfo.attach(`${viewport.name}-${name}.png`, { path: screenshotPath, contentType: "image/png" });
    }
  }
});
