export const ADAPTIVE_SAMPLING_VERSION = "rocket-league-adaptive-sampling@0.1.0";
export const DETAIL_SAMPLE_RATE_HZ = 30;

const REVIEW_EVENT_TYPES = new Set([
  "controlled_play",
  "dodge",
  "fifty_fifty",
  "half_flip",
  "kickoff",
  "pass",
  "shadow_defense",
  "touch",
  "wall_aerial",
  "wavedash",
  "whiff",
]);

function finite(value) {
  return Number.isFinite(value) ? value : null;
}

/**
 * Retain short 30 Hz slices around parser-backed decision events. The full
 * match remains represented by the stable 10 Hz frame state; this detail lane
 * exists only for contact, landing and re-entry review.
 */
export function buildAdaptiveWindows(detailFrameState, episodeTimeline, options = {}) {
  const beforeSeconds = Number.isFinite(options.beforeSeconds) ? Math.max(0.25, options.beforeSeconds) : 0.75;
  const afterSeconds = Number.isFinite(options.afterSeconds) ? Math.max(0.75, options.afterSeconds) : 1.75;
  const maximumWindows = Number.isInteger(options.maximumWindows) ? Math.max(1, options.maximumWindows) : 96;
  const frames = Array.isArray(detailFrameState?.frames) ? detailFrameState.frames : [];
  const candidates = (episodeTimeline?.events ?? [])
    .filter((event) => event?.subjectInvolved === true
      && REVIEW_EVENT_TYPES.has(event.type)
      && Number.isFinite(event.startTimeSeconds));
  const events = candidates.length <= maximumWindows
    ? candidates
    : Array.from({ length: maximumWindows }, (_, index) => candidates[
      Math.round((index * (candidates.length - 1)) / Math.max(1, maximumWindows - 1))
    ]);

  const retainedFrames = new Map();
  const windows = events.flatMap((event) => {
    const startTimeSeconds = Math.max(0, event.startTimeSeconds - beforeSeconds);
    const endTimeSeconds = (finite(event.endTimeSeconds) ?? event.startTimeSeconds) + afterSeconds;
    const selected = frames.filter((frame) => Number.isFinite(frame.timeSeconds)
      && frame.timeSeconds >= startTimeSeconds
      && frame.timeSeconds <= endTimeSeconds);
    if (!selected.length) return [];
    for (const frame of selected) retainedFrames.set(frame.index, frame);
    return [{
      id: `adaptive:${event.id}`,
      eventId: event.id,
      eventType: event.type,
      eventTimeSeconds: event.startTimeSeconds,
      startTimeSeconds,
      endTimeSeconds,
      sampleRateHz: detailFrameState.sampleRateHz,
      frameIndexes: selected.map((frame) => frame.index),
    }];
  });
  const detailFrames = [...retainedFrames.values()].sort((left, right) => left.timeSeconds - right.timeSeconds);

  return {
    schemaVersion: ADAPTIVE_SAMPLING_VERSION,
    macroSampleRateHz: 10,
    detailSampleRateHz: detailFrameState?.sampleRateHz ?? null,
    beforeSeconds,
    afterSeconds,
    sourceEventCount: events.length,
    detailFrames,
    windows,
    summary: {
      windowCount: windows.length,
      retainedFrameCount: detailFrames.length,
      eventTypes: windows.reduce((counts, window) => {
        counts[window.eventType] = (counts[window.eventType] ?? 0) + 1;
        return counts;
      }, {}),
    },
  };
}

export function adaptiveSamplingSummary(adaptiveSampling) {
  return {
    schemaVersion: adaptiveSampling?.schemaVersion ?? ADAPTIVE_SAMPLING_VERSION,
    macroSampleRateHz: adaptiveSampling?.macroSampleRateHz ?? 10,
    detailSampleRateHz: adaptiveSampling?.detailSampleRateHz ?? null,
    beforeSeconds: adaptiveSampling?.beforeSeconds ?? null,
    afterSeconds: adaptiveSampling?.afterSeconds ?? null,
    sourceEventCount: adaptiveSampling?.sourceEventCount ?? 0,
    ...(adaptiveSampling?.summary ?? { windowCount: 0, retainedFrameCount: 0, eventTypes: {} }),
  };
}
