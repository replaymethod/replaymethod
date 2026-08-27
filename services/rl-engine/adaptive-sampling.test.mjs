import assert from "node:assert/strict";
import test from "node:test";
import { buildAdaptiveWindows, DETAIL_SAMPLE_RATE_HZ } from "./adaptive-sampling.mjs";

test("retains bounded 30 Hz detail only around subject decision events", () => {
  const frames = Array.from({ length: 181 }, (_, index) => ({ index, timeSeconds: index / 30, players: [] }));
  const result = buildAdaptiveWindows({ sampleRateHz: DETAIL_SAMPLE_RATE_HZ, frames }, {
    events: [
      { id: "touch:1", type: "touch", subjectInvolved: true, startTimeSeconds: 2, endTimeSeconds: 2 },
      { id: "opponent:1", type: "touch", subjectInvolved: false, startTimeSeconds: 3 },
      { id: "goal:1", type: "goal_context", subjectInvolved: true, startTimeSeconds: 4 },
    ],
  });
  assert.equal(result.windows.length, 1);
  assert.equal(result.windows[0].eventId, "touch:1");
  assert.equal(result.detailSampleRateHz, 30);
  assert.ok(result.windows[0].frameIndexes.length >= 70);
  assert.ok(result.detailFrames.length < frames.length);
});

test("samples capped event windows across the whole match instead of only the opening", () => {
  const frames = Array.from({ length: 601 }, (_, index) => ({ index, timeSeconds: index / 10, players: [] }));
  const events = Array.from({ length: 20 }, (_, index) => ({
    id: `touch:${index}`, type: "touch", subjectInvolved: true, startTimeSeconds: 2 + (index * 2.5),
  }));
  const result = buildAdaptiveWindows({ sampleRateHz: 10, frames }, { events }, { maximumWindows: 4 });
  assert.deepEqual(result.windows.map((window) => window.eventId), ["touch:0", "touch:6", "touch:13", "touch:19"]);
});
