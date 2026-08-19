import { createHash } from "node:crypto";
import { ROCKET_LEAGUE_DETECTOR_CATALOG } from "./detector-catalog.mjs";

export const DETECTOR_REGISTRY_VERSION = "rocket-league-detector-registry.v1";
export const ACTIVATION_RECORD_VERSION = "rocket-league-detector-activation.v1";

const lifecycleTransitions = Object.freeze({
  discovery: new Set(["candidate"]),
  candidate: new Set(["calibrating"]),
  calibrating: new Set(["shadow"]),
  shadow: new Set(["enabled"]),
  enabled: new Set(["demoted"]),
  demoted: new Set(["shadow"]),
});

const registryOverrides = Object.freeze({
  "boost.supersonic_waste": {
    dependencies: ["boost.zero_duration"],
    conflicts: ["boost.zero_duration"],
    duplicateGroup: "boost-reserve",
    minimumSamples: 3,
  },
  "boost.zero_duration": { duplicateGroup: "boost-reserve", minimumSamples: 3 },
  "kickoff.speed": { supportedModes: ["1v1", "2v2", "3v3"], minimumSamples: 5 },
  "possession.first_touch": { duplicateGroup: "possession-control", minimumSamples: 3 },
  "challenge.dive": { duplicateGroup: "commitment-risk", minimumSamples: 3 },
  "rotation.spacing_too_close": { supportedModes: ["2v2", "3v3"], duplicateGroup: "team-coverage", minimumSamples: 3 },
  "teamplay.double_commit": { supportedModes: ["2v2", "3v3"], duplicateGroup: "team-coverage", minimumSamples: 2 },
  "recovery.momentum_loss": { duplicateGroup: "recovery-tempo", minimumSamples: 3 },
});

export const DETECTOR_REGISTRY = Object.freeze(ROCKET_LEAGUE_DETECTOR_CATALOG.map((entry) => Object.freeze({
  registryVersion: DETECTOR_REGISTRY_VERSION,
  id: entry.id,
  version: entry.lifecycle === "shadow" ? "0.1.0" : "unimplemented",
  category: entry.category,
  title: entry.title,
  lifecycle: entry.lifecycle,
  public: false,
  supportedModes: ["1v1", "2v2", "3v3"],
  dependencies: [],
  conflicts: [],
  duplicateGroup: entry.id,
  minimumSamples: 1,
  ...registryOverrides[entry.id],
})));

export function detectorDefinition(id, registry = DETECTOR_REGISTRY) {
  return registry.find((entry) => entry.id === id) ?? null;
}

export function validateRegistry(registry = DETECTOR_REGISTRY) {
  const errors = [];
  const ids = new Set();
  for (const entry of registry) {
    if (!entry.id || ids.has(entry.id)) errors.push(`duplicate_or_missing_id:${entry.id || "unknown"}`);
    ids.add(entry.id);
    if (entry.public) errors.push(`catalog_public_flag_forbidden:${entry.id}`);
    if (!lifecycleTransitions[entry.lifecycle]) errors.push(`invalid_lifecycle:${entry.id}`);
    if (!Array.isArray(entry.supportedModes) || !entry.supportedModes.length) errors.push(`missing_modes:${entry.id}`);
  }
  for (const entry of registry) {
    for (const dependency of entry.dependencies ?? []) if (!ids.has(dependency)) errors.push(`missing_dependency:${entry.id}:${dependency}`);
    for (const conflict of entry.conflicts ?? []) if (!ids.has(conflict)) errors.push(`missing_conflict:${entry.id}:${conflict}`);
  }
  return { valid: errors.length === 0, errors };
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function activationFingerprint(record) {
  const unsigned = { ...record };
  delete unsigned.fingerprint;
  return createHash("sha256").update(stable(unsigned)).digest("hex");
}

export function createActivationRecord(input) {
  const definition = detectorDefinition(input.detectorId, input.registry ?? DETECTOR_REGISTRY);
  if (!definition || definition.version !== input.detectorVersion) throw new Error("Detector version is not registered.");
  if (definition.lifecycle !== "shadow" && definition.lifecycle !== "demoted") throw new Error("Only a shadow or demoted detector can be proposed for activation.");
  if (input.qualityGate?.eligible !== true) throw new Error("Detector did not pass the complete public quality gate.");
  if (!input.approvedBy || !input.approvedAt || !input.parserVersion || !input.normalizerVersion) throw new Error("Activation provenance is incomplete.");
  if (!Array.isArray(input.cohorts) || !input.cohorts.length || !Array.isArray(input.gameVersions) || !input.gameVersions.length) {
    throw new Error("Activation scope must include cohorts and game versions.");
  }
  const record = {
    schemaVersion: ACTIVATION_RECORD_VERSION,
    detectorId: definition.id,
    detectorVersion: definition.version,
    registryVersion: DETECTOR_REGISTRY_VERSION,
    parserVersion: input.parserVersion,
    normalizerVersion: input.normalizerVersion,
    cohorts: [...new Set(input.cohorts)].sort(),
    gameVersions: [...new Set(input.gameVersions)].sort(),
    qualitySnapshot: input.qualityGate,
    approvedBy: input.approvedBy,
    approvedAt: input.approvedAt,
    status: "enabled",
    reason: String(input.reason || "Passed public quality gate").slice(0, 500),
  };
  return Object.freeze({ ...record, fingerprint: activationFingerprint(record) });
}

export function validateActivationRecord(record, options = {}) {
  const definition = detectorDefinition(record?.detectorId, options.registry ?? DETECTOR_REGISTRY);
  const checks = {
    schema: record?.schemaVersion === ACTIVATION_RECORD_VERSION,
    registeredVersion: Boolean(definition && definition.version === record?.detectorVersion),
    registryVersion: record?.registryVersion === DETECTOR_REGISTRY_VERSION,
    exactFingerprint: typeof record?.fingerprint === "string" && activationFingerprint(record) === record.fingerprint,
    gatePassed: record?.qualitySnapshot?.eligible === true,
    provenance: Boolean(record?.approvedBy && record?.approvedAt),
    scope: Boolean(record?.cohorts?.length && record?.gameVersions?.length),
    publicKillSwitch: options.publicOutputEnabled === true,
    notDemoted: record?.status === "enabled",
  };
  return { valid: Object.values(checks).every(Boolean), checks };
}

export function transitionDetector(current, next, evidence = {}) {
  if (!lifecycleTransitions[current]?.has(next)) throw new Error(`Invalid detector lifecycle transition: ${current} -> ${next}`);
  if (next === "enabled" && validateActivationRecord(evidence.activationRecord, {
    registry: evidence.registry,
    publicOutputEnabled: evidence.publicOutputEnabled,
  }).valid !== true) throw new Error("Detector activation record is not valid for public output.");
  if (next === "demoted" && !String(evidence.reason || "").trim()) throw new Error("Detector demotion requires an auditable reason.");
  return { from: current, to: next, at: evidence.at ?? new Date().toISOString(), reason: String(evidence.reason || "gate passed") };
}
