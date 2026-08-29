import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const calibrationScript = await readFile(new URL("../../scripts/calibrate-rl-engine.mjs", import.meta.url), "utf8");
const momentScript = await readFile(new URL("../../scripts/build-rl-review-moments.mjs", import.meta.url), "utf8");

test("calibration CLI refuses protected evaluation splits and requires manifest-selected inputs", () => {
  assert.match(calibrationScript, /\["calibration", "calibration_dev"\]/);
  assert.match(calibrationScript, /manifestFiles \?\? resolvedTargets/);
  assert.match(calibrationScript, /Manifest SHA-256 mismatch/);
  assert.match(calibrationScript, /does not open challenge or blind holdout data/);
});

test("review-moment generation resolves only queued calibration_dev manifest files", () => {
  assert.match(momentScript, /queue\.sourceCorpusAssignment !== split/);
  assert.match(momentScript, /queue\.holdoutIncluded !== false/);
  assert.match(momentScript, /selectedManifestFiles\.length !== candidatesByReplay\.size/);
  assert.match(momentScript, /Manifest SHA-256 mismatch/);
  assert.match(momentScript, /rocket-league-review-moments\.v3/);
  assert.match(momentScript, /compactVector\(player\.rotation\)/);
  assert.match(momentScript, /adaptiveSampling\?\.detailFrames/);
});
