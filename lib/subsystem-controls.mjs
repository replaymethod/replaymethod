export const SUBSYSTEM_FLAGS = Object.freeze({
  billingCheckout: "BILLING_CHECKOUT_ENABLED",
  transactionalEmail: "TRANSACTIONAL_EMAIL_ENABLED",
  rocketLeagueEngine: "RL_ENGINE_ENABLED",
  rocketLeaguePublicDetectors: "RL_PUBLIC_DETECTORS_ENABLED",
  rocketLeagueCalibrationIntake: "RL_CALIBRATION_INTAKE_ENABLED",
  riotIngestion: "RIOT_INGESTION_ENABLED",
  backgroundProcessing: "BACKGROUND_PROCESSING_ENABLED",
});

export function subsystemEnabled(value) {
  return value === "true";
}

const PAID_CHECKOUT_DEPENDENCIES = Object.freeze([
  SUBSYSTEM_FLAGS.billingCheckout,
  SUBSYSTEM_FLAGS.rocketLeagueEngine,
  SUBSYSTEM_FLAGS.rocketLeaguePublicDetectors,
  SUBSYSTEM_FLAGS.backgroundProcessing,
]);

export function paidCheckoutReadiness(env = {}) {
  const blockedBy = PAID_CHECKOUT_DEPENDENCIES.filter((key) => !subsystemEnabled(env[key]));
  return { ready: blockedBy.length === 0, blockedBy };
}

export function subsystemState(env = {}) {
  return Object.fromEntries(Object.entries(SUBSYSTEM_FLAGS).map(([name, key]) => [name, {
    key,
    enabled: subsystemEnabled(env[key]),
  }]));
}
