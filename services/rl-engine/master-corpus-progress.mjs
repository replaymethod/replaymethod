export const MASTER_CORPUS_MANIFEST_VERSION = "replay-method-master-corpus.v2";
export const MASTER_CORPUS_RESUME_PROTOCOL = "page-commit-v2";
export const EXCLUSION_SAMPLE_CAP_PER_CELL_REASON = 3;

function ballchasingPlayerIdentity(player) {
  const platform = String(player?.id?.platform ?? "").trim().toLowerCase();
  const id = String(player?.id?.id ?? "").trim();
  return platform && id ? `${platform}:${id}` : "";
}

export function masterCorpusSubjectParserIdentities(subject, players = []) {
  const platformIdentity = ballchasingPlayerIdentity(subject);
  const name = String(subject?.name ?? "").trim();
  const uniqueNameMatch = name && players.filter((player) =>
    String(player?.name ?? "").trim().localeCompare(name, undefined, { sensitivity: "accent" }) === 0
  ).length === 1;
  return [...new Set([platformIdentity, uniqueNameMatch ? name : ""].filter(Boolean))];
}

function compactExclusions(exclusions, sampleCap) {
  const samples = [];
  const sampleCounts = new Map();
  for (const row of exclusions) {
    const key = `${row.cellKey ?? "unknown"}:${row.reason ?? "unknown"}`;
    const count = sampleCounts.get(key) ?? 0;
    if (count >= sampleCap) continue;
    samples.push(row);
    sampleCounts.set(key, count + 1);
  }
  return samples;
}

export function migrateMasterCorpusProgress(manifest, targets, replayUrlForCell) {
  if (!manifest || !["replay-method-master-corpus.v1", MASTER_CORPUS_MANIFEST_VERSION].includes(manifest.schemaVersion)) {
    throw new Error("Unsupported master corpus manifest schema.");
  }
  const legacyExclusions = Array.isArray(manifest.exclusions) ? manifest.exclusions : [];
  const exclusionCounts = { ...(manifest.exclusionCounts ?? {}) };
  if (!manifest.exclusionCounts) {
    for (const row of legacyExclusions) {
      const reason = row.reason ?? "unknown";
      exclusionCounts[reason] = (exclusionCounts[reason] ?? 0) + 1;
    }
  }
  const excludedReplayIds = [...new Set([
    ...(manifest.excludedReplayIds ?? []),
    ...legacyExclusions.map((row) => row.ballchasingReplayId).filter(Boolean),
  ].map((id) => String(id).toLowerCase()))];
  const migrated = manifest.schemaVersion !== MASTER_CORPUS_MANIFEST_VERSION
    || manifest.resumeProtocolVersion !== MASTER_CORPUS_RESUME_PROTOCOL;
  manifest.schemaVersion = MASTER_CORPUS_MANIFEST_VERSION;
  manifest.resumeProtocolVersion = MASTER_CORPUS_RESUME_PROTOCOL;
  manifest.exclusionCounts = exclusionCounts;
  manifest.excludedReplayIds = excludedReplayIds;
  manifest.exclusions = compactExclusions(legacyExclusions, EXCLUSION_SAMPLE_CAP_PER_CELL_REASON);
  if (migrated) {
    for (const cell of targets) {
      const accepted = (manifest.approved ?? []).filter((row) => row.cellKey === cell.key).length;
      if (accepted >= cell.target) continue;
      manifest.discovery[cell.key] = {
        pages: 0,
        next: replayUrlForCell(cell),
        lastQueriedAt: null,
        recoveryReason: "resume_protocol_upgrade_restarted_incomplete_cell_discovery",
      };
    }
  }
  return manifest;
}

export function recordMasterCorpusExclusion(manifest, row, excludedReplayIds) {
  const replayId = String(row.ballchasingReplayId ?? "").toLowerCase();
  if (!replayId || excludedReplayIds.has(replayId)) return false;
  excludedReplayIds.add(replayId);
  manifest.excludedReplayIds.push(replayId);
  const reason = row.reason ?? "unknown";
  manifest.exclusionCounts[reason] = (manifest.exclusionCounts[reason] ?? 0) + 1;
  const sampleCount = manifest.exclusions.filter((sample) => sample.cellKey === row.cellKey && sample.reason === reason).length;
  if (sampleCount < EXCLUSION_SAMPLE_CAP_PER_CELL_REASON) manifest.exclusions.push(row);
  return true;
}
