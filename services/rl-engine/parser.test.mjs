import assert from "node:assert/strict";
import test from "node:test";
import { normalizeReplayMetadata } from "./parser.mjs";

test("normalizes current subtr-actor replay metadata", () => {
  const normalized = normalizeReplayMetadata({
    replay_meta: {
      team_zero: [{ name: "Player One", remote_id: { Epic: "account-1" } }],
      team_one: [{ name: "Player Two", remote_id: { Steam: "7656119" } }],
      game_type: { game_type: "Ranked", playlist_id: 11 },
      all_headers: [
        ["BuildVersion", "260316.80791.512269"],
        ["Date", "2026-04-28 18-07-32"],
      ],
    },
  });

  assert.deepEqual(normalized.players.map(({ name, id }) => ({ name, id })), [
    { name: "Player One", id: "epic:account-1" },
    { name: "Player Two", id: "steam:7656119" },
  ]);
  assert.equal(normalized.mode, "Ranked Doubles");
  assert.equal(normalized.gameVersion, "260316.80791.512269");
  assert.equal(normalized.occurredAt, "2026-04-28 18-07-32");
});

test("keeps compatibility with the legacy unwrapped metadata shape", () => {
  const normalized = normalizeReplayMetadata({
    team_zero: [{ name: "Legacy Player", remote_id: "legacy-id" }],
    team_one: [],
    game_type: "Online",
  }, {
    build_version: "legacy-build",
    date: "2020-01-01",
  });

  assert.equal(normalized.players[0].id, "legacy-id");
  assert.equal(normalized.mode, "Online");
  assert.equal(normalized.gameVersion, "legacy-build");
  assert.equal(normalized.occurredAt, "2020-01-01");
});
