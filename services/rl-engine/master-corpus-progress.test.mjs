import assert from "node:assert/strict";
import test from "node:test";
import {
  MASTER_CORPUS_MANIFEST_VERSION,
  MASTER_CORPUS_RESUME_PROTOCOL,
  masterCorpusSubjectParserIdentities,
  migrateMasterCorpusProgress,
  recordMasterCorpusExclusion,
} from "./master-corpus-progress.mjs";

test("parser identity candidates retain platform ID and add only a unique API roster name", () => {
  const subject = { name: "Console Player", id: { platform: "PS4", id: "Account-1" } };
  assert.deepEqual(masterCorpusSubjectParserIdentities(subject, [subject, { name: "Other" }]), [
    "ps4:Account-1", "Console Player",
  ]);
  assert.deepEqual(masterCorpusSubjectParserIdentities(subject, [subject, { name: "console player" }]), [
    "ps4:Account-1",
  ]);
  assert.deepEqual(masterCorpusSubjectParserIdentities({ id: subject.id }, [subject]), ["ps4:Account-1"]);
});

test("legacy corpus progress becomes compact and restarts only incomplete cell discovery", () => {
  const exclusions = Array.from({ length: 10 }, (_, index) => ({
    ballchasingReplayId: `REPLAY-${index}`, cellKey: "S21:1v1:Gold", reason: "player_cap",
  }));
  const manifest = {
    schemaVersion: "replay-method-master-corpus.v1",
    approved: [{ cellKey: "complete" }],
    exclusions,
    discovery: { incomplete: { next: "unsafe-next" } },
  };
  migrateMasterCorpusProgress(manifest, [
    { key: "complete", target: 1 }, { key: "incomplete", target: 2 },
  ], (cell) => `initial:${cell.key}`);
  assert.equal(manifest.schemaVersion, MASTER_CORPUS_MANIFEST_VERSION);
  assert.equal(manifest.resumeProtocolVersion, MASTER_CORPUS_RESUME_PROTOCOL);
  assert.equal(manifest.exclusionCounts.player_cap, 10);
  assert.equal(manifest.excludedReplayIds.length, 10);
  assert.equal(manifest.exclusions.length, 3);
  assert.equal(manifest.discovery.incomplete.next, "initial:incomplete");
  assert.equal(manifest.discovery.complete, undefined);
});

test("exclusion recording is deduplicated and sample-bounded", () => {
  const manifest = { excludedReplayIds: [], exclusionCounts: {}, exclusions: [] };
  const ids = new Set();
  for (let index = 0; index < 8; index += 1) recordMasterCorpusExclusion(manifest, {
    ballchasingReplayId: `id-${index}`, cellKey: "cell", reason: "rank",
  }, ids);
  assert.equal(manifest.exclusionCounts.rank, 8);
  assert.equal(manifest.exclusions.length, 3);
  assert.equal(recordMasterCorpusExclusion(manifest, {
    ballchasingReplayId: "id-0", cellKey: "cell", reason: "rank",
  }, ids), false);
  assert.equal(manifest.exclusionCounts.rank, 8);
});
