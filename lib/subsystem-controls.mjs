export const SUBSYSTEM_FLAGS = Object.freeze({
  billingCheckout: "BILLING_CHECKOUT_ENABLED",
  transactionalEmail: "TRANSACTIONAL_EMAIL_ENABLED",
  rocketLeagueEngine: "RL_ENGINE_ENABLED",
  rocketLeaguePublicDetectors: "RL_PUBLIC_DETECTORS_ENABLED",
  riotIngestion: "RIOT_INGESTION_ENABLED",
  backgroundProcessing: "BACKGROUND_PROCESSING_ENABLED",
});

export function subsystemEnabled(value) {
  return value === "true";
}

export function subsystemState(env = {}) {
  return Object.fromEntries(Object.entries(SUBSYSTEM_FLAGS).map(([name, key]) => [name, {
    key,
    enabled: subsystemEnabled(env[key]),
  }]));
}
