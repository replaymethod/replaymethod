import { detectorDefinition } from "./detector-registry.mjs";
import { DETECTOR_CATEGORIES } from "./detector-catalog.mjs";

export const EARLY_ACCESS_POLICY_VERSION = "rocket-league-early-access-policy@0.1.0";

const policies = Object.freeze({
  "boost.supersonic_waste": Object.freeze({
    title: "Stop paying boost for speed you already have",
    category: "boost-economy",
    minimumCandidates: 3,
    qualifies: (run) => Number(run.measurements?.totalBoostSpent ?? 0) >= 6,
    summary: (run) => `The replay recorded ${run.candidateCount} separate boost inputs while your car was already at supersonic speed. This is an experimental coaching interpretation of verified telemetry, not a formally validated detector result.`,
    evidence: (item) => ({
      id: `supersonic-${item.startFrame}`,
      description: `Boost was spent while the car was already supersonic; ${Number(item.boostSpent ?? 0).toFixed(1)} boost was used in this continuous input.`,
      timestampSeconds: Number.isFinite(item.startTimeSeconds) ? item.startTimeSeconds : undefined,
      metric: "boost_spent_while_supersonic",
      value: Number(item.boostSpent ?? 0),
      unit: "boost",
    }),
    metrics: (run) => [
      { key: "supersonic_boost_inputs", label: "Separate supersonic boost inputs", value: run.candidateCount },
      { key: "boost_spent_while_supersonic", label: "Boost spent while supersonic", value: Number(run.measurements?.totalBoostSpent ?? 0), unit: "boost" },
    ],
    queueRule: "At supersonic speed, release boost unless it changes your line or preserves momentum through contact.",
    practice: [
      "Run five minutes of recovery routes while maintaining speed with throttle, flips and small pads.",
      "In the next three matches, use one cue: release boost once supersonic unless the input changes the play.",
      "Compare boost waste and useful arrival timing in the next representative replay.",
    ],
    limitations: [
      "This experimental signal identifies boost inputs at supersonic speed; it does not yet judge every tactical reason for holding boost.",
      "Expert validation is still in progress and this detector is not formally validated.",
    ],
  }),
  "teamplay.double_commit": Object.freeze({
    title: "Keep one layer behind the challenge",
    category: "teamplay",
    minimumCandidates: 2,
    qualifies: (run) => Number(run.measurements?.totalSeconds ?? 0) >= 0.4,
    summary: (run) => `The replay recorded ${run.candidateCount} separate windows where you and a teammate were both close to and moving toward the ball. The double-commit interpretation is experimental and has not completed expert validation.`,
    evidence: (item) => ({
      id: `double-commit-${item.startFrame}`,
      description: `You and a teammate were both within the detector's 900-unit ball radius and moving toward the ball for ${Number(item.durationSeconds ?? 0).toFixed(1)} seconds.`,
      timestampSeconds: Number.isFinite(item.startTimeSeconds) ? item.startTimeSeconds : undefined,
      metric: "overlapping_ball_commitment",
      value: Number(item.durationSeconds ?? 0),
      unit: "seconds",
    }),
    metrics: (run) => [
      { key: "overlapping_commitments", label: "Separate overlapping commitment windows", value: run.candidateCount },
      { key: "overlapping_commitment_seconds", label: "Time in measured windows", value: Number(run.measurements?.totalSeconds ?? 0), unit: "seconds" },
    ],
    queueRule: "When a teammate can touch first, cover the next outcome instead of joining the same ball.",
    practice: [
      "Review ten contested balls and name first player, support and safety before continuing playback.",
      "Carry one cue into three matches: cover the next outcome when your teammate has first access.",
      "Submit a representative replay and compare overlapping commitment windows before calling it progress.",
    ],
    limitations: [
      "Proximity and movement do not prove that every shared challenge was avoidable; use the timestamps as review prompts.",
      "Expert validation is still in progress and this detector is not formally validated.",
    ],
  }),
});

function evidenceStrength(candidateCount, minimumCandidates) {
  // This deliberately narrow score describes repeated evidence inside this one
  // replay. It is not detector precision or a probability that the advice is correct.
  return Math.min(0.79, 0.65 + Math.max(0, candidateCount - minimumCandidates) * 0.02);
}

export function composeEarlyAccessOutput(shadowRun, normalized) {
  const assessments = [];
  const findings = [];
  for (const run of shadowRun.runs ?? []) {
    const policy = policies[run.detectorId];
    if (!policy) {
      assessments.push({ detectorId: run.detectorId, status: "abstained", reason: "This detector does not yet have a bounded Early Access interpretation." });
      continue;
    }
    const definition = detectorDefinition(run.detectorId);
    const minimumCandidates = Math.max(policy.minimumCandidates, definition?.minimumSamples ?? 1);
    const reasons = [];
    if (run.status !== "observed") reasons.push("No qualifying signal was observed in this replay.");
    if (run.candidateCount < minimumCandidates) reasons.push(`Fewer than ${minimumCandidates} independent evidence windows were observed.`);
    if (!Array.isArray(run.evidence) || run.evidence.length < minimumCandidates) reasons.push("The finding lacks enough timestamped evidence windows.");
    if (!policy.qualifies(run)) reasons.push("The measured signal did not clear the conservative within-match threshold.");
    if (reasons.length) {
      assessments.push({ detectorId: run.detectorId, status: "abstained", reason: reasons[0] });
      continue;
    }

    const confidence = evidenceStrength(run.candidateCount, minimumCandidates);
    findings.push({
      id: run.detectorId,
      category: policy.category,
      title: policy.title,
      summary: policy.summary(run),
      severity: "medium",
      confidence,
      confidenceLabel: "medium",
      frequency: run.candidateCount,
      estimatedImpact: "Experimental within-match coaching signal",
      sampleSize: run.candidateCount,
      lifecycle: "shadow",
      publicationStatus: "experimental_early_access",
      evidence: run.evidence.slice(0, 5).map(policy.evidence),
      metrics: policy.metrics(run),
      recommendation: {
        queueRule: policy.queueRule,
        practiceSteps: policy.practice,
        matchesToObserve: 3,
      },
      limitations: policy.limitations,
      detectorVersion: `${run.detectorVersion}-early-access`,
      schemaVersion: "finding.v1",
    });
    assessments.push({ detectorId: run.detectorId, status: "experimental_insight", reason: `${run.candidateCount} timestamped evidence windows cleared the Early Access policy.` });
  }

  findings.sort((left, right) => right.confidence - left.confidence || right.frequency - left.frequency || left.id.localeCompare(right.id));
  const categoryCoverage = new Map(Object.entries(DETECTOR_CATEGORIES).map(([id, label]) => [id, {
    id,
    label,
    total: 0,
    measuring: 0,
    capabilityAbstained: 0,
    observed: 0,
  }]));
  for (const run of shadowRun.runs ?? []) {
    const definition = detectorDefinition(run.detectorId);
    const category = categoryCoverage.get(definition?.category);
    if (!category) continue;
    category.total += 1;
    if (run.implementationStatus === "measuring") category.measuring += 1;
    if (run.implementationStatus === "capability_abstention") category.capabilityAbstained += 1;
    if (run.status === "observed") category.observed += 1;
  }
  return {
    policyVersion: EARLY_ACCESS_POLICY_VERSION,
    formalValidationStatus: "not_validated",
    findings,
    assessments,
    analysisCoverage: {
      totalDetectors: shadowRun.summary?.detectorCount ?? 0,
      measuringDetectors: shadowRun.summary?.measuring ?? 0,
      capabilityAbstained: shadowRun.summary?.capabilityAbstained ?? 0,
      publicEligible: shadowRun.summary?.publicEligible ?? 0,
      categories: [...categoryCoverage.values()],
    },
    verifiedFacts: {
      subjectDisplayName: normalized.subjectDisplayName ?? null,
      mode: normalized.mode ?? null,
      rank: normalized.rank ?? null,
      gameVersion: normalized.gameVersion ?? null,
      occurredAt: normalized.occurredAt ?? null,
      playerCount: normalized.metadata?.playerCount ?? null,
      sampledFrames: normalized.metadata?.evidenceEngine?.frameState?.frameCount ?? null,
      parserEvents: normalized.metadata?.evidenceEngine?.episodeTimeline?.rawEventCount ?? null,
      decisionEvents: normalized.metadata?.evidenceEngine?.episodeTimeline?.decisionEventCount ?? null,
    },
  };
}
