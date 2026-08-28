import assert from "node:assert/strict";
import test from "node:test";
import {
  assignMasterCorpusSplits,
  buildMasterCorpusCells,
  masterCorpusPlanSummary,
  masterCorpusSplitQuotas,
} from "./master-corpus-plan.mjs";

test("master corpus plan is exactly 1000 across all 45 season-mode-rank cells", () => {
  const cells = buildMasterCorpusCells();
  const summary = masterCorpusPlanSummary(cells);
  assert.equal(cells.length, 45);
  assert.equal(summary.total, 1_000);
  assert.deepEqual(summary.seasons, { 21: 333, 22: 333, 23: 334 });
  assert.deepEqual(summary.splits, { calibration_dev: 700, challenge: 150, frozen_blind_holdout: 150 });
  assert.ok(summary.minimumPerCell >= 18);
});

test("split assignment is deterministic and exact inside every cell", () => {
  const cells = buildMasterCorpusCells();
  const rows = cells.flatMap((cell) => Array.from({ length: cell.target }, (_, index) => ({
    cellKey: cell.key,
    ballchasingReplayId: `${cell.key}:${index}`,
    split: "pending",
  })));
  assignMasterCorpusSplits(rows, cells);
  const quotas = masterCorpusSplitQuotas(cells);
  for (const cell of cells) for (const split of ["calibration_dev", "challenge", "frozen_blind_holdout"]) {
    assert.equal(rows.filter((row) => row.cellKey === cell.key && row.split === split).length, quotas[cell.key][split]);
  }
});
