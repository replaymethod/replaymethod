import assert from "node:assert/strict";
import test from "node:test";
import { boostDeltaRawToPercent, boostRawToPercent } from "./boost-units.mjs";

test("normalizes raw replay boost units without hiding invalid telemetry", () => {
  assert.equal(boostRawToPercent(0), 0);
  assert.equal(boostRawToPercent(255), 100);
  assert.equal(boostRawToPercent(127.5), 50);
  assert.equal(boostRawToPercent(300), 100);
  assert.equal(boostRawToPercent(Number.NaN), null);
  assert.equal(boostDeltaRawToPercent(25.5), 10);
});
