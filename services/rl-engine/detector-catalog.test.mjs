import assert from "node:assert/strict";
import test from "node:test";
import {
  DETECTOR_CATEGORIES,
  DETECTOR_LIFECYCLE,
  ROCKET_LEAGUE_DETECTOR_CATALOG,
  detectorCatalogSummary,
} from "./detector-catalog.mjs";

test("detector catalog covers every coaching category without duplicate ids", () => {
  const ids = ROCKET_LEAGUE_DETECTOR_CATALOG.map((detector) => detector.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.length >= 50);

  const summary = detectorCatalogSummary();
  for (const category of Object.keys(DETECTOR_CATEGORIES)) {
    assert.ok(summary.byCategory[category] > 0, `${category} has no detector candidates`);
  }
});

test("unvalidated detector candidates are private and lifecycle-safe", () => {
  for (const detector of ROCKET_LEAGUE_DETECTOR_CATALOG) {
    assert.ok(DETECTOR_LIFECYCLE.includes(detector.lifecycle));
    assert.equal(detector.public, false);
    assert.ok(["discovery", "shadow"].includes(detector.lifecycle));
    assert.ok(detector.requirements.includes("expert-labels"));
    assert.ok(detector.requirements.includes("rank-mode-baseline"));
  }

  const summary = detectorCatalogSummary();
  assert.equal(summary.public, 0);
  assert.equal(summary.byLifecycle.shadow, 8);
  assert.equal(summary.byLifecycle.discovery, summary.total - 8);
});
