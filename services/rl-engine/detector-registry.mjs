import { createHash } from "node:crypto";
import { ROCKET_LEAGUE_DETECTOR_CATALOG } from "./detector-catalog.mjs";

export const DETECTOR_REGISTRY_VERSION = "rocket-league-detector-registry.v3";
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
  "boost.low_exposure": { duplicateGroup: "boost-reserve", minimumSamples: 8 },
  "boost.large_pad_detour": { duplicateGroup: "boost-routing", minimumSamples: 8 },
  "boost.small_pad_blindness": { duplicateGroup: "boost-routing", minimumSamples: 8 },
  "boost.teammate_starvation": { supportedModes: ["2v2", "3v3"], duplicateGroup: "boost-routing", minimumSamples: 8 },
  "rotation.caught_ahead": { supportedModes: ["2v2", "3v3"], duplicateGroup: "transition-coverage", minimumSamples: 8 },
  "rotation.cut": { supportedModes: ["2v2", "3v3"], duplicateGroup: "rotation-ownership", minimumSamples: 8 },
  "rotation.same_lane": { supportedModes: ["2v2", "3v3"], duplicateGroup: "team-coverage", minimumSamples: 8 },
  "rotation.spacing_too_far": { supportedModes: ["2v2", "3v3"], duplicateGroup: "team-coverage", minimumSamples: 8 },
  "rotation.back_post_bypass": { supportedModes: ["2v2", "3v3"], duplicateGroup: "defensive-route", minimumSamples: 8 },
  "rotation.goal_side_loss": { supportedModes: ["2v2", "3v3"], duplicateGroup: "defensive-route", minimumSamples: 8 },
  "rotation.backboard_uncovered": { supportedModes: ["2v2", "3v3"], duplicateGroup: "defensive-route", minimumSamples: 8 },
  "challenge.late": { duplicateGroup: "commitment-risk", minimumSamples: 8 },
  "challenge.fake_opportunity": { duplicateGroup: "commitment-risk", minimumSamples: 8 },
  "challenge.low_probability_aerial": { duplicateGroup: "commitment-risk", minimumSamples: 8 },
  "challenge.advantage_state": { duplicateGroup: "commitment-risk", minimumSamples: 8 },
  "recovery.demolition_reentry": { duplicateGroup: "recovery-tempo", minimumSamples: 8 },
  "recovery.play_reentry": { duplicateGroup: "recovery-tempo", minimumSamples: 8 },
  "possession.panic_clear": { duplicateGroup: "possession-control", minimumSamples: 8 },
  "possession.touch_frequency": { duplicateGroup: "possession-control", minimumSamples: 8 },
  "offense.shot_quality": { duplicateGroup: "shot-execution", minimumSamples: 8 },
  "offense.open_net_execution": { duplicateGroup: "shot-execution", minimumSamples: 8 },
  "offense.pass_lane": { supportedModes: ["2v2", "3v3"], duplicateGroup: "attack-creation", minimumSamples: 8 },
  "offense.follow_up": { duplicateGroup: "shot-execution", minimumSamples: 8 },
  "offense.backboard_use": { duplicateGroup: "attack-creation", minimumSamples: 8 },
  "defense.near_post_trap": { duplicateGroup: "defensive-route", minimumSamples: 8 },
  "defense.corner_overcommit": { duplicateGroup: "defensive-route", minimumSamples: 8 },
  "defense.goal_line_congestion": { supportedModes: ["2v2", "3v3"], duplicateGroup: "team-coverage", minimumSamples: 8 },
  "defense.shadow_distance": { duplicateGroup: "shadow-defense", minimumSamples: 8 },
  "defense.post_save_recovery": { duplicateGroup: "defensive-recovery", minimumSamples: 8 },
  "kickoff.cheat_distance": { supportedModes: ["2v2", "3v3"], duplicateGroup: "kickoff-support", minimumSamples: 8 },
  "kickoff.role_compliance": { supportedModes: ["2v2", "3v3"], duplicateGroup: "kickoff-support", minimumSamples: 8 },
  "teamplay.support_angle": { supportedModes: ["2v2", "3v3"], duplicateGroup: "team-coverage", minimumSamples: 8 },
  "teamplay.role_overlap": { supportedModes: ["2v2", "3v3"], duplicateGroup: "team-coverage", minimumSamples: 8 },
  "teamplay.trust_break": { supportedModes: ["2v2", "3v3"], duplicateGroup: "rotation-ownership", minimumSamples: 8 },
  "teamplay.transition_balance": { supportedModes: ["2v2", "3v3"], duplicateGroup: "transition-coverage", minimumSamples: 8 },
  "boost.zero_duration": { version: "0.2.0", duplicateGroup: "boost-reserve", minimumSamples: 3 },
  "boost.overfill": { version: "0.3.0" },
  "kickoff.contact": { version: "0.2.0" },
  "possession.giveaway": { version: "0.2.0" },
  "offense.center_to_opponent": { version: "0.2.0" },
  "defense.clear_direction": { version: "0.2.0" },
  "boost.supersonic_waste": {
    version: "0.4.0",
    dependencies: ["boost.zero_duration"],
    conflicts: ["boost.zero_duration"],
    duplicateGroup: "boost-reserve",
    minimumSamples: 3,
  },
  "boost.defensive_reserve": { duplicateGroup: "boost-reserve", minimumSamples: 5 },
  "kickoff.speed": { version: "0.2.0", supportedModes: ["1v1", "2v2", "3v3"], minimumSamples: 5 },
  "possession.first_touch": { version: "0.2.0", duplicateGroup: "possession-control", minimumSamples: 3 },
  "challenge.dive": { version: "0.2.0", duplicateGroup: "commitment-risk", minimumSamples: 3 },
  "challenge.teammate_coverage": { supportedModes: ["2v2", "3v3"], duplicateGroup: "commitment-risk", minimumSamples: 5 },
  "challenge.last_player": { supportedModes: ["2v2", "3v3"], duplicateGroup: "commitment-risk", minimumSamples: 5 },
  "rotation.third_overextension": { supportedModes: ["2v2", "3v3"], duplicateGroup: "commitment-risk", minimumSamples: 5 },
  "rotation.spacing_too_close": { version: "0.2.0", supportedModes: ["2v2", "3v3"], duplicateGroup: "team-coverage", minimumSamples: 3 },
  "teamplay.double_commit": { version: "0.2.0", supportedModes: ["2v2", "3v3"], duplicateGroup: "team-coverage", minimumSamples: 2 },
  "recovery.momentum_loss": { version: "0.2.0", duplicateGroup: "recovery-tempo", minimumSamples: 3 },
  "possession.first_touch_retention": { version: "0.2.0", duplicateGroup: "possession-control", minimumSamples: 5 },
  "challenge.quality": { version: "0.3.0", duplicateGroup: "commitment-risk", minimumSamples: 5 },
  "recovery.reentry_quality": { version: "0.2.0", duplicateGroup: "recovery-tempo", minimumSamples: 5 },
  "recovery.landing_orientation": { duplicateGroup: "recovery-execution", minimumSamples: 5 },
  "recovery.post_aerial_exit": { duplicateGroup: "recovery-execution", minimumSamples: 5 },
  "recovery.wall_to_ground": { duplicateGroup: "recovery-execution", minimumSamples: 5 },
  "possession.control_space": { duplicateGroup: "possession-control", minimumSamples: 5 },
  "possession.wall_control": { duplicateGroup: "possession-control", minimumSamples: 3 },
});

export const DETECTOR_REGISTRY = Object.freeze(ROCKET_LEAGUE_DETECTOR_CATALOG.map((entry) => Object.freeze({
  registryVersion: DETECTOR_REGISTRY_VERSION,
  id: entry.id,
  version: "0.1.0",
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
