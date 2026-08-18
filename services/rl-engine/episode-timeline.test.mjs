import assert from "node:assert/strict";
import test from "node:test";
import { normalizeEpisodeTimeline } from "./episode-timeline.mjs";

test("segments match phases and preserves subject-backed decision events", () => {
  const timeline = normalizeEpisodeTimeline({
    frames: [
      { frame_number: 0, time: 1, seconds_remaining: 300, gameplay_phase: "kickoff_countdown", is_live_play: false },
      { frame_number: 1, time: 2, seconds_remaining: 300, gameplay_phase: "kickoff_countdown", is_live_play: false },
      { frame_number: 2, time: 3, seconds_remaining: 300, gameplay_phase: "active_play", is_live_play: true },
      { frame_number: 3, time: 4, seconds_remaining: 299, gameplay_phase: "active_play", is_live_play: true },
      { frame_number: 4, time: 5, seconds_remaining: 298, gameplay_phase: "post_goal", is_live_play: false },
    ],
    events: { events: [
      {
        meta: {
          id: "touch:3",
          stream: "touch",
          primary_player: { Epic: "subject-id" },
          team_is_team_0: true,
          timing: { type: "point", start_frame: 3, start_time: 4 },
        },
        payload: { kind: "touch", payload: { frame: 3, time: 4, player: { Epic: "subject-id" } } },
      },
      {
        meta: { id: "movement:3", stream: "movement" },
        payload: { kind: "movement", payload: { frame: 3, time: 4 } },
      },
    ] },
  }, "epic:subject-id");

  assert.equal(timeline.schemaVersion, "rocket-league-episode-timeline.v1");
  assert.deepEqual(timeline.phases.map((phase) => phase.phase), [
    "kickoff_countdown", "active_play", "post_goal",
  ]);
  assert.equal(timeline.phases[1].startFrame, 2);
  assert.equal(timeline.phases[1].endFrame, 3);
  assert.equal(timeline.summary.rawEventCount, 2);
  assert.equal(timeline.summary.decisionEventCount, 1);
  assert.equal(timeline.summary.subjectDecisionEventCount, 1);
  assert.equal(timeline.summary.countsByType.movement, 1);
  assert.equal(timeline.events[0].subjectInvolved, true);
  assert.deepEqual(timeline.events[0].participantPlayerIds, ["epic:subject-id"]);
  assert.equal(timeline.events[0].team, 0);
  assert.equal(timeline.events[0].startTimeSeconds, 4);
});

test("keeps opponent events without falsely attributing them to the subject", () => {
  const timeline = normalizeEpisodeTimeline({
    frames: [],
    events: { events: [{
      meta: { stream: "whiff", primary_player: { Steam: "opponent-id" } },
      payload: { kind: "whiff", payload: { frame: 20, time: 10 } },
    }] },
  }, "epic:subject-id");

  assert.equal(timeline.events[0].playerId, "steam:opponent-id");
  assert.equal(timeline.events[0].subjectInvolved, false);
});

test("attributes team events when the subject appears as a nested participant", () => {
  const timeline = normalizeEpisodeTimeline({
    frames: [],
    events: { events: [{
      meta: { stream: "kickoff", primary_player: { Steam: "opponent-id" } },
      payload: { kind: "kickoff", payload: {
        team_zero_taker: { player: { Epic: "subject-id" } },
        team_one_taker: { player: { Steam: "opponent-id" } },
      } },
    }] },
  }, "epic:subject-id");

  assert.equal(timeline.events[0].subjectInvolved, true);
  assert.deepEqual(new Set(timeline.events[0].participantPlayerIds), new Set([
    "epic:subject-id", "steam:opponent-id",
  ]));
});
