import { buildPatternMemoryContract, summarizePatternMemory } from "../services/rl-engine/pattern-memory.mjs";

export const REPLAY_BATCH_TARGET = 10;
export const REPLAY_BATCH_AGGREGATION_VERSION = "replay-batch-aggregation@1.3.0";

export function canonicalPlaylist(value) {
  const text = String(value ?? "").trim().toLowerCase();
  if (/\b(duel|1v1|ones?)\b/.test(text)) return "1v1";
  if (/\b(doubles?|2v2|twos?)\b/.test(text)) return "2v2";
  if (/\b(standard|3v3|threes?)\b/.test(text)) return "3v3";
  return "";
}

export function validateBatchCandidate(batch, normalized, duplicates = {}) {
  const playlist = canonicalPlaylist(normalized?.mode);
  if (!normalized?.externalMatchId) return { ok: false, code: "match_guid_missing", message: "The replay did not expose a verifiable match identifier. Choose another original replay." };
  if (!normalized?.subjectPlayerId || !normalized?.subjectDisplayName) return { ok: false, code: "subject_identity_missing", message: "The selected player could not be verified in this replay." };
  if (!playlist) return { ok: false, code: "playlist_unsupported", message: "Use ranked 1v1, 2v2 or 3v3 replays for this batch." };
  if (duplicates.fileHash) return { ok: false, code: "duplicate_file", message: "That exact replay file is already in this batch. Choose a different match." };
  if (duplicates.matchGuid) return { ok: false, code: "duplicate_match", message: "That match is already in this batch. Choose a different replay." };
  if (batch.subjectPlayerId && batch.subjectPlayerId !== normalized.subjectPlayerId) {
    return { ok: false, code: "wrong_player", message: `This replay belongs to a different player than ${batch.subjectDisplayName || "the player locked for this batch"}.` };
  }
  if (batch.playlist && batch.playlist !== playlist) {
    return { ok: false, code: "wrong_playlist", message: `This batch is locked to ${batch.playlist}. Replace this ${playlist} replay with another ${batch.playlist} match.` };
  }
  return { ok: true, playlist };
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function number(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function confidenceLabel(recurrence, confidence) {
  if (recurrence >= 6 && confidence >= 0.75) return "high";
  if (recurrence >= 3 && confidence >= 0.6) return "medium";
  return "low";
}

function aggregateMetrics(results) {
  const groups = new Map();
  for (const result of results) {
    const performance = object(object(result.normalized?.metadata).performanceSnapshot);
    for (const raw of Array.isArray(performance.metrics) ? performance.metrics : []) {
      const metric = object(raw);
      const id = String(metric.id || metric.key || "");
      const value = number(metric.value);
      if (!id || value == null || !metric.category || !metric.label || !metric.unit) continue;
      const current = groups.get(id) || { ...metric, values: [], statuses: [] };
      current.values.push(value);
      current.statuses.push(String(metric.status || "neutral"));
      groups.set(id, current);
    }
  }
  return [...groups.entries()].map(([id, metric]) => {
    const value = metric.values.reduce((sum, item) => sum + item, 0) / metric.values.length;
    const decimals = Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2;
    const suffix = metric.unit === "%" ? "%" : metric.unit === "seconds" ? "s" : metric.unit === "per_minute" ? "/min" : ` ${metric.unit}`;
    const status = metric.statuses.filter(item => item === "review").length >= Math.ceil(metric.statuses.length / 2)
      ? "review" : metric.statuses.filter(item => item === "strong").length >= Math.ceil(metric.statuses.length / 2) ? "strong" : "neutral";
    return {
      id: `batch-${id}`,
      category: String(metric.category),
      label: String(metric.label),
      displayValue: `${value.toFixed(decimals)}${suffix}`,
      value,
      unit: String(metric.unit),
      status,
      kind: "derived_metric",
      whatHappened: `Average across ${metric.values.length} verified matches in this batch.`,
      whyItMatters: String(metric.whyItMatters || "Cross-match averages reduce the chance that one unusual game controls the result."),
      limitation: `This is a ${metric.values.length}-match average, not a rank benchmark or permanent player trait.`,
      source: "10 byte-verified original replays",
      version: REPLAY_BATCH_AGGREGATION_VERSION,
      sampleCount: metric.values.length,
    };
  }).filter(metric => metric.sampleCount >= 2).slice(0, 12);
}

function aggregateStrength(results) {
  const strengths = new Map();
  for (const result of results) {
    const strength = object(object(object(result.normalized?.metadata).performanceSnapshot).strength);
    const title = typeof strength.title === "string" ? strength.title.trim() : "";
    if (!title || typeof strength.detail !== "string") continue;
    const key = title.toLowerCase();
    const current = strengths.get(key) || { title, details: [], count: 0 };
    current.count += 1;
    current.details.push(strength.detail);
    strengths.set(key, current);
  }
  const top = [...strengths.values()].sort((left, right) => right.count - left.count || left.title.localeCompare(right.title))[0];
  if (!top || top.count < 2) return null;
  return {
    title: top.title,
    detail: `${top.details[0]} A comparable positive signal appeared in ${top.count} of 10 verified matches.`,
    kind: "verified_telemetry",
    limitation: "This is a recurring batch strength, not a rank benchmark or a claim that it appeared in every match.",
  };
}

function aggregateOpportunityPatterns(results) {
  const detectors = new Map();
  results.forEach((result, matchIndex) => {
    const engine = object(object(result.normalized?.metadata).decisionEngine);
    for (const raw of Array.isArray(engine.detectors) ? engine.detectors : []) {
      const detector = object(raw);
      if (!detector.detectorId || !detector.detectorVersion || !Array.isArray(detector.evaluations)) continue;
      const opportunityContractVersion = String(detector.schemaVersion || "unknown");
      const contextVersion = String(detector.contextVersion || "unknown");
      const key = `${detector.detectorId}@${detector.detectorVersion}:${opportunityContractVersion}:${contextVersion}`;
      const group = detectors.get(key) || {
        detectorId: String(detector.detectorId), detectorVersion: String(detector.detectorVersion),
        opportunityContractVersion, contextVersion,
        opportunityType: String(detector.opportunityType || "unknown"), matchesEvaluated: new Set(), matchesFiring: new Set(), contexts: new Map(),
        eligibleOpportunities: 0, firingOpportunities: 0, nonFiringOpportunities: 0, abstainedOpportunities: 0,
      };
      let evaluatedThisMatch = false;
      let firedThisMatch = false;
      for (const rawEvaluation of detector.evaluations) {
        const evaluation = object(rawEvaluation);
        const status = String(evaluation.status || "abstained");
        if (!["firing", "non_firing", "abstained"].includes(status)) continue;
        if (status === "abstained") group.abstainedOpportunities += 1;
        else {
          evaluatedThisMatch = true;
          group.eligibleOpportunities += 1;
          if (status === "firing") {
            firedThisMatch = true;
            group.firingOpportunities += 1;
          } else group.nonFiringOpportunities += 1;
        }
        const contextKey = String(evaluation.contextKey || "unknown");
        const context = group.contexts.get(contextKey) || { contextKey, matches: new Set(), eligible: 0, firing: 0, nonFiring: 0, abstained: 0, evaluations: [] };
        context.evaluations.push({ matchIndex, status });
        if (status !== "abstained") context.matches.add(matchIndex);
        if (status === "firing") context.firing += 1;
        if (status === "non_firing") context.nonFiring += 1;
        if (status === "abstained") context.abstained += 1;
        if (status !== "abstained") context.eligible += 1;
        group.contexts.set(contextKey, context);
      }
      if (evaluatedThisMatch) group.matchesEvaluated.add(matchIndex);
      if (firedThisMatch) group.matchesFiring.add(matchIndex);
      detectors.set(key, group);
    }
  });

  return [...detectors.values()].map((group) => {
    const contexts = [...group.contexts.values()];
    const comparableContexts = contexts
      .filter((context) => context.eligible >= 3 && context.matches.size >= 2)
      .map((context) => ({
        contextKey: context.contextKey,
        matches: context.matches.size,
        eligibleOpportunities: context.eligible,
        firingOpportunities: context.firing,
        nonFiringOpportunities: context.nonFiring,
        abstainedOpportunities: context.abstained,
        firingRate: context.eligible ? context.firing / context.eligible : null,
      }))
      .sort((left, right) => right.eligibleOpportunities - left.eligibleOpportunities || right.firingOpportunities - left.firingOpportunities || left.contextKey.localeCompare(right.contextKey));
    const patternContracts = contexts
      .map((context) => buildPatternMemoryContract({
        detectorId: group.detectorId,
        detectorVersion: group.detectorVersion,
        opportunityContractVersion: group.opportunityContractVersion,
        contextVersion: group.contextVersion,
        opportunityType: group.opportunityType,
        contextKey: context.contextKey,
        totalMatches: results.length,
        evaluations: context.evaluations,
      }))
      .sort((left, right) => (
        Number(right.state === "pattern_lock_candidate") - Number(left.state === "pattern_lock_candidate")
        || right.evidence.eligibleOpportunities - left.evidence.eligibleOpportunities
        || right.evidence.firingMatches - left.evidence.firingMatches
        || left.contextKey.localeCompare(right.contextKey)
      ));
    return {
      detectorId: group.detectorId,
      detectorVersion: group.detectorVersion,
      opportunityContractVersion: group.opportunityContractVersion,
      contextVersion: group.contextVersion,
      opportunityType: group.opportunityType,
      matchesEvaluated: group.matchesEvaluated.size,
      matchesFiring: group.matchesFiring.size,
      eligibleOpportunities: group.eligibleOpportunities,
      firingOpportunities: group.firingOpportunities,
      nonFiringOpportunities: group.nonFiringOpportunities,
      abstainedOpportunities: group.abstainedOpportunities,
      firingRate: group.eligibleOpportunities ? group.firingOpportunities / group.eligibleOpportunities : null,
      comparableContexts: comparableContexts.slice(0, 8),
      comparable: comparableContexts.length > 0,
      publicationStatus: "private_shadow",
      patternMemory: patternContracts[0] ?? null,
    };
  }).sort((left, right) => right.eligibleOpportunities - left.eligibleOpportunities || right.firingOpportunities - left.firingOpportunities || left.detectorId.localeCompare(right.detectorId));
}

export function aggregateReplayBatch(results, excludedCount = 0) {
  if (!Array.isArray(results) || results.length !== REPLAY_BATCH_TARGET) throw new Error("Exactly ten valid replay results are required.");
  const findingGroups = new Map();
  results.forEach((result, matchIndex) => {
    for (const finding of Array.isArray(result.findings) ? result.findings : []) {
      if (!finding?.id || finding.confidenceLabel === "insufficient") continue;
      const group = findingGroups.get(finding.id) || { id: finding.id, entries: [] };
      group.entries.push({ finding, matchIndex });
      findingGroups.set(finding.id, group);
    }
  });
  const ranked = [...findingGroups.values()].map(group => ({
    ...group,
    recurrence: group.entries.length,
    confidence: group.entries.reduce((sum, entry) => sum + Number(entry.finding.confidence || 0), 0) / group.entries.length,
  })).sort((left, right) => right.recurrence - left.recurrence || right.confidence - left.confidence || left.id.localeCompare(right.id));
  const recurrent = ranked.filter(group => group.recurrence >= 3);
  const oneOffCount = ranked.filter(group => group.recurrence === 1).length;
  const primary = recurrent[0] || null;
  const metrics = aggregateMetrics(results);
  const record = results.reduce((summary, result) => {
    const value = String(object(object(result.normalized?.metadata).performanceSnapshot).match?.result || "unknown");
    if (value === "win") summary.wins += 1;
    else if (value === "loss") summary.losses += 1;
    else if (value === "draw") summary.draws += 1;
    else summary.unknown += 1;
    return summary;
  }, { wins: 0, losses: 0, draws: 0, unknown: 0 });
  const performanceMoments = results.flatMap((result, matchIndex) => {
    const performance = object(object(result.normalized?.metadata).performanceSnapshot);
    return (Array.isArray(performance.moments) ? performance.moments : []).slice(0, 1).map((raw, momentIndex) => {
      const moment = object(raw);
      return {
        ...moment,
        id: `batch-${matchIndex + 1}-${moment.id || momentIndex + 1}`,
        title: `Match ${matchIndex + 1} · ${String(moment.title || "Verified moment")}`,
        context: `Cross-match sample · ${String(moment.context || "verified replay telemetry")}`,
        limitation: `This moment supports match ${matchIndex + 1}; recurrence is calculated separately across all ten matches.`,
      };
    });
  }).slice(0, 5);
  const evidence = primary ? primary.entries.slice(0, 5).map(({ finding, matchIndex }) => {
    const first = Array.isArray(finding.evidence) ? finding.evidence[0] : null;
    const clock = number(first?.timestampSeconds);
    const timing = clock == null ? "" : ` at ${Math.floor(clock / 60)}:${String(Math.floor(clock % 60)).padStart(2, "0")}`;
    return { label: `Match ${matchIndex + 1}`, description: `Match ${matchIndex + 1}${timing}: ${first?.description || finding.summary}`, timestamp: clock };
  }) : [];
  const firstFinding = primary?.entries[0]?.finding || null;
  const confidence = primary ? confidenceLabel(primary.recurrence, primary.confidence) : "insufficient";
  const recurrenceSummary = primary
    ? `${primary.recurrence} of 10 matches supported this pattern; ${10 - primary.recurrence} did not. ${oneOffCount} other signal${oneOffCount === 1 ? " appeared" : "s appeared"} only once and were not promoted to the plan.`
    : `No supported pattern recurred in at least 3 of 10 matches. ${oneOffCount} one-off signal${oneOffCount === 1 ? " was" : "s were"} kept out of the coaching plan.`;
  const versions = results.map(result => result.versions || {});
  const opportunityPatterns = aggregateOpportunityPatterns(results);
  const patternMemory = summarizePatternMemory(opportunityPatterns.map((pattern) => pattern.patternMemory).filter(Boolean));
  const metadata = {
    batch: {
      version: REPLAY_BATCH_AGGREGATION_VERSION,
      validMatches: 10,
      excludedFiles: excludedCount,
      playlist: canonicalPlaylist(results[0]?.normalized?.mode),
      subjectDisplayName: results[0]?.normalized?.subjectDisplayName || null,
      recurrence: recurrent.slice(0, 5).map(group => ({ detectorId: group.id, matches: group.recurrence, averageConfidence: group.confidence })),
      oneOffDetectorCount: oneOffCount,
      confidence,
      record,
      opportunityPatterns,
      opportunityPatternCount: opportunityPatterns.length,
      patternMemory,
    },
    performanceSnapshot: {
      version: REPLAY_BATCH_AGGREGATION_VERSION,
      match: { teamScore: null, opponentScore: null, result: "unknown", overtime: false, durationSeconds: null },
      sample: { liveFrameCount: 0, liveSeconds: 0, frameCoverage: { ball: null, players: null } },
      strength: aggregateStrength(results),
      metrics,
      moments: performanceMoments,
    },
    subject: { name: results[0]?.normalized?.subjectDisplayName || null },
    playerCount: null,
  };
  return {
    primary,
    confidence,
    recurrenceSummary,
    metadata,
    report: primary ? {
      highestImpactMistake: String(firstFinding.title),
      whyItCosts: `${String(firstFinding.summary)} ${recurrenceSummary}`,
      evidence,
      nextQueueRule: String(firstFinding.recommendation?.queueRule || "Use one cue in the same playlist for the next three matches."),
      practicePlan: (Array.isArray(firstFinding.recommendation?.practiceSteps) ? firstFinding.recommendation.practiceSteps : []).slice(0, 4),
      coachNote: `Confidence: ${confidence}. Based on recurrence across exactly ten verified ${canonicalPlaylist(results[0]?.normalized?.mode)} matches. ${excludedCount} excluded upload${excludedCount === 1 ? " was" : "s were"} not counted.`,
      finding: {
        ...firstFinding,
        confidence: primary.confidence,
        confidenceLabel: confidence,
        frequency: primary.recurrence,
        summary: `${String(firstFinding.summary)} ${recurrenceSummary}`,
        evidence,
        limitations: [`Ten-match review in one playlist; not a rank benchmark.`, `${10 - primary.recurrence} matches did not support the primary pattern.`, ...(firstFinding.limitations || [])].slice(0, 8),
      },
    } : null,
    versions: {
      parser: versions[0]?.parser || null,
      analyzer: versions[0]?.analyzer || null,
      detector: versions[0]?.detector || null,
      coaching: REPLAY_BATCH_AGGREGATION_VERSION,
      schema: "coaching.v1",
    },
  };
}
