import { createHash } from "node:crypto";

export const MASTER_CORPUS_PLAN_VERSION = "rocket-league-master-corpus-plan@1.0.0";

export const MASTER_CORPUS_SEASONS = Object.freeze([
  Object.freeze({ season: 21, filter: "f21", startsAt: "2025-12-10T17:00:00Z" }),
  Object.freeze({ season: 22, filter: "f22", startsAt: "2026-03-11T16:00:00Z" }),
  Object.freeze({ season: 23, filter: "f23", startsAt: "2026-06-10T16:00:00Z" }),
]);

export const MASTER_CORPUS_MODES = Object.freeze([
  Object.freeze({ mode: "1v1", playlist: "ranked-duels", players: 2 }),
  Object.freeze({ mode: "2v2", playlist: "ranked-doubles", players: 4 }),
  Object.freeze({ mode: "3v3", playlist: "ranked-standard", players: 6 }),
]);

export const MASTER_CORPUS_RANKS = Object.freeze([
  Object.freeze({ group: "Gold", minFilter: "gold-1", maxFilter: "gold-3" }),
  Object.freeze({ group: "Platinum", minFilter: "platinum-1", maxFilter: "platinum-3" }),
  Object.freeze({ group: "Diamond", minFilter: "diamond-1", maxFilter: "diamond-3" }),
  Object.freeze({ group: "Champion", minFilter: "champion-1", maxFilter: "champion-3" }),
  Object.freeze({ group: "Grand Champion", minFilter: "grand-champion", maxFilter: "grand-champion" }),
]);

const BASE_TARGETS = Object.freeze({
  "1v1": Object.freeze({ Gold: 18, Platinum: 20, Diamond: 22, Champion: 22, "Grand Champion": 18 }),
  "2v2": Object.freeze({ Gold: 22, Platinum: 25, Diamond: 27, Champion: 25, "Grand Champion": 18 }),
  "3v3": Object.freeze({ Gold: 22, Platinum: 24, Diamond: 26, Champion: 24, "Grand Champion": 20 }),
});

function hash(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

export function buildMasterCorpusCells() {
  return MASTER_CORPUS_SEASONS.flatMap((season) => MASTER_CORPUS_MODES.flatMap((mode) =>
    MASTER_CORPUS_RANKS.map((rank) => {
      const season23Remainder = season.season === 23 && mode.mode === "2v2" && rank.group === "Diamond" ? 1 : 0;
      return Object.freeze({
        key: `S${season.season}:${mode.mode}:${rank.group}`,
        season: season.season,
        seasonFilter: season.filter,
        seasonStartsAt: season.startsAt,
        mode: mode.mode,
        playlist: mode.playlist,
        playerCount: mode.players,
        rankGroup: rank.group,
        rankMinFilter: rank.minFilter,
        rankMaxFilter: rank.maxFilter,
        target: BASE_TARGETS[mode.mode][rank.group] + season23Remainder,
      });
    })));
}

function quotaForSplit(cells, total, fraction, split) {
  const quotas = new Map(cells.map((cell) => [cell.key, Math.floor(cell.target * fraction)]));
  let remaining = total - [...quotas.values()].reduce((sum, value) => sum + value, 0);
  const ordered = [...cells].sort((left, right) =>
    ((right.target * fraction) % 1) - ((left.target * fraction) % 1)
      || hash(`${split}:${left.key}`).localeCompare(hash(`${split}:${right.key}`)));
  for (const cell of ordered) {
    if (!remaining) break;
    quotas.set(cell.key, quotas.get(cell.key) + 1);
    remaining -= 1;
  }
  if (remaining !== 0) throw new Error(`Unable to allocate exact ${split} quota.`);
  return quotas;
}

export function masterCorpusSplitQuotas(cells = buildMasterCorpusCells()) {
  const challenge = quotaForSplit(cells, 150, 0.15, "challenge");
  const holdout = quotaForSplit(cells, 150, 0.15, "frozen_blind_holdout");
  return Object.fromEntries(cells.map((cell) => [cell.key, Object.freeze({
    calibration_dev: cell.target - challenge.get(cell.key) - holdout.get(cell.key),
    challenge: challenge.get(cell.key),
    frozen_blind_holdout: holdout.get(cell.key),
  })]));
}

export function assignMasterCorpusSplits(rows, cells = buildMasterCorpusCells()) {
  const quotas = masterCorpusSplitQuotas(cells);
  for (const cell of cells) {
    const cohort = rows.filter((row) => row.cellKey === cell.key)
      .sort((left, right) => hash(`master-split-v1:${left.ballchasingReplayId}`)
        .localeCompare(hash(`master-split-v1:${right.ballchasingReplayId}`)));
    if (cohort.length !== cell.target) {
      throw new Error(`${cell.key} has ${cohort.length}/${cell.target} approved rows.`);
    }
    let offset = 0;
    for (const split of ["calibration_dev", "challenge", "frozen_blind_holdout"]) {
      cohort.slice(offset, offset + quotas[cell.key][split]).forEach((row) => { row.split = split; });
      offset += quotas[cell.key][split];
    }
  }
  return rows;
}

export function masterCorpusPlanSummary(cells = buildMasterCorpusCells()) {
  const quotas = masterCorpusSplitQuotas(cells);
  return {
    schemaVersion: MASTER_CORPUS_PLAN_VERSION,
    total: cells.reduce((sum, cell) => sum + cell.target, 0),
    cellCount: cells.length,
    seasons: Object.fromEntries(MASTER_CORPUS_SEASONS.map(({ season }) => [season,
      cells.filter((cell) => cell.season === season).reduce((sum, cell) => sum + cell.target, 0)])),
    modes: Object.fromEntries(MASTER_CORPUS_MODES.map(({ mode }) => [mode,
      cells.filter((cell) => cell.mode === mode).reduce((sum, cell) => sum + cell.target, 0)])),
    ranks: Object.fromEntries(MASTER_CORPUS_RANKS.map(({ group }) => [group,
      cells.filter((cell) => cell.rankGroup === group).reduce((sum, cell) => sum + cell.target, 0)])),
    splits: Object.fromEntries(["calibration_dev", "challenge", "frozen_blind_holdout"].map((split) => [split,
      Object.values(quotas).reduce((sum, cell) => sum + cell[split], 0)])),
    minimumPerCell: Math.min(...cells.map((cell) => cell.target)),
    maximumPerCell: Math.max(...cells.map((cell) => cell.target)),
  };
}
