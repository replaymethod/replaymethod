import { canonicalContext } from "./context.mjs";
import { detectorDefinition } from "./detector-registry.mjs";

export const FINDING_POLICY_VERSION = "rocket-league-finding-policy.v1";

const clamp = (value, fallback = 0) => Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;

export function findingPriority(finding, history = {}) {
  const components = {
    recurrence: clamp(finding.recurrence),
    impact: clamp(finding.impact),
    confidence: clamp(finding.confidence),
    trainability: clamp(finding.trainability, 0.5),
    contextRelevance: clamp(finding.contextRelevance, 0.5),
    activeFocus: history.activeDetectorId === finding.detectorId ? 1 : 0,
    regression: history.regressingDetectorIds?.includes(finding.detectorId) ? 1 : 0,
    prerequisiteReady: finding.prerequisiteReady === false ? 0 : 1,
    novelty: history.observedDetectorIds?.includes(finding.detectorId) ? 0 : 1,
  };
  const score = (
    components.recurrence * 0.22
    + components.impact * 0.24
    + components.confidence * 0.2
    + components.trainability * 0.12
    + components.contextRelevance * 0.08
    + components.activeFocus * 0.08
    + components.regression * 0.04
    + components.novelty * 0.02
  ) * components.prerequisiteReady;
  return { score, components, policyVersion: FINDING_POLICY_VERSION };
}

export function resolveFindings(findings = [], input = {}) {
  const context = canonicalContext(input.context);
  const enabledDetectorIds = new Set(input.enabledDetectorIds ?? []);
  const accepted = [];
  const suppressed = [];

  for (const finding of findings) {
    const definition = detectorDefinition(finding?.detectorId);
    const reasons = [];
    if (!definition) reasons.push("detector_not_registered");
    if (finding?.qualityGate?.eligible !== true) reasons.push("quality_gate_not_met");
    if (finding?.activation?.valid !== true) reasons.push("activation_not_validated");
    if (definition && !definition.supportedModes.includes(context.mode)) reasons.push("unsupported_mode");
    if (definition && Number.isFinite(finding?.sampleSize) && finding.sampleSize < definition.minimumSamples) reasons.push("insufficient_sample");
    if (definition && !Number.isFinite(finding?.sampleSize)) reasons.push("sample_size_missing");
    if (definition && definition.dependencies.some((id) => !enabledDetectorIds.has(id))) reasons.push("detector_dependency_missing");
    if (finding?.confidenceLabel === "insufficient") reasons.push("insufficient_confidence");
    if (!Array.isArray(finding?.evidence) || !finding.evidence.length) reasons.push("evidence_missing");
    if (reasons.length) {
      suppressed.push({ detectorId: finding?.detectorId ?? "unknown", reasons });
      continue;
    }
    accepted.push({
      ...finding,
      context,
      definition,
      priority: findingPriority(finding, input.history),
    });
  }

  const ranked = accepted.sort((left, right) => (
    right.priority.score - left.priority.score
    || right.confidence - left.confidence
    || left.detectorId.localeCompare(right.detectorId)
  ));
  const selected = [];
  const occupiedGroups = new Map();
  const selectedIds = new Set();
  for (const finding of ranked) {
    const duplicate = occupiedGroups.get(finding.definition.duplicateGroup);
    const conflict = finding.definition.conflicts.find((id) => selectedIds.has(id));
    if (duplicate || conflict) {
      suppressed.push({
        detectorId: finding.detectorId,
        reasons: [duplicate ? "duplicate_finding" : "detector_conflict"],
        keptDetectorId: duplicate?.detectorId ?? conflict,
      });
      continue;
    }
    selected.push(finding);
    selectedIds.add(finding.detectorId);
    occupiedGroups.set(finding.definition.duplicateGroup, finding);
  }

  return { context, selected, suppressed, policyVersion: FINDING_POLICY_VERSION };
}
