import test from "node:test";
import assert from "node:assert/strict";
import { subsystemEnabled, subsystemState, SUBSYSTEM_FLAGS } from "../lib/subsystem-controls.mjs";

test("subsystems fail closed unless their value is exactly true", () => {
  for (const value of [undefined, null, "", "false", "TRUE", "1", true]) {
    assert.equal(subsystemEnabled(value), false);
  }
  assert.equal(subsystemEnabled("true"), true);
});

test("reports switch names and boolean state without exposing secret values", () => {
  const state = subsystemState({ BILLING_CHECKOUT_ENABLED: "true", RL_ENGINE_TOKEN: "never-return-this" });
  assert.deepEqual(state.billingCheckout, { key: SUBSYSTEM_FLAGS.billingCheckout, enabled: true });
  assert.equal(state.transactionalEmail.enabled, false);
  assert.equal(JSON.stringify(state).includes("never-return-this"), false);
});
