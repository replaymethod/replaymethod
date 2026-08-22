const SAFE_PATHS = new Set([
  "/",
  "/analyze",
  "/replay-upload",
  "/rocket-league",
  "/rocket-league-beta",
]);

const ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "ref",
];

/**
 * Builds a desktop continuation URL without copying report access tokens,
 * email addresses, or arbitrary query parameters into a shareable link.
 */
export function desktopHandoffUrl(currentHref) {
  try {
    const current = new URL(currentHref);
    const path = SAFE_PATHS.has(current.pathname) ? current.pathname : "/";
    const target = new URL(path, current.origin);

    for (const key of ATTRIBUTION_KEYS) {
      const value = current.searchParams.get(key)?.trim().slice(0, 120);
      if (value) target.searchParams.set(key, value);
    }

    if (path === "/analyze") {
      target.searchParams.set("game", "rocket-league");
      target.searchParams.set("platform", "pc");
    }
    target.searchParams.set("handoff", "mobile_to_pc");
    return target.toString();
  } catch {
    return "";
  }
}
