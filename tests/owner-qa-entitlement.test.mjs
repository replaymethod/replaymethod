import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  activeOwnerQaEntitlement,
  ensureConfiguredOwnerQaEntitlement,
  OWNER_QA_ENTITLEMENT_KEY,
  reserveOwnerQaUsage,
} from "../lib/owner-qa-entitlement.mjs";

class FakeStatement {
  constructor(database, sql) {
    this.database = database;
    this.sql = sql.replace(/\s+/g, " ").trim();
    this.values = [];
  }

  bind(...values) {
    this.values = values;
    return this;
  }

  async first() {
    if (this.sql.includes("SELECT id FROM players")) {
      const [playerId] = this.values;
      return this.database.players.includes(playerId) ? { id: playerId } : null;
    }
    if (this.sql.includes("FROM player_entitlements")) {
      const [playerId, key] = this.values;
      return this.database.entitlements.find(row => row.playerId === playerId
        && row.entitlementKey === key && row.status === "active" && !row.revokedAt) || null;
    }
    if (this.sql.includes("FROM analysis_usage WHERE analysis_public_id")) {
      const [analysisPublicId] = this.values;
      return this.database.usage.find(row => row.analysisPublicId === analysisPublicId
        && ["reserved", "consumed"].includes(row.status)) || null;
    }
    if (this.sql.includes("COALESCE(MAX(slot)")) {
      const [playerId, accessKind] = this.values;
      const slots = this.database.usage.filter(row => row.playerId === playerId && row.accessKind === accessKind)
        .map(row => row.slot);
      return { slot: Math.max(0, ...slots) + 1 };
    }
    throw new Error(`Unhandled first SQL: ${this.sql}`);
  }

  async run() {
    if (this.sql.includes("INSERT OR IGNORE INTO player_entitlements")) {
      const [publicId, playerId, entitlementKey] = this.values;
      if (this.database.entitlements.some(row => row.playerId === playerId && row.entitlementKey === entitlementKey)) {
        return { meta: { changes: 0 } };
      }
      this.database.entitlements.push({ publicId, playerId, entitlementKey, status: "active", revokedAt: null });
      return { meta: { changes: 1 } };
    }
    if (this.sql.includes("action, actor, metadata_json") && this.sql.includes("player_entitlement_audit")) {
      const [eventKey, playerId, entitlementKey, metadataJson] = this.values;
      if (this.database.audit.some(row => row.eventKey === eventKey)) return { meta: { changes: 0 } };
      this.database.audit.push({ eventKey, playerId, entitlementKey, metadataJson, action: "granted" });
      return { meta: { changes: 1 } };
    }
    if (this.sql.includes("INSERT OR IGNORE INTO analysis_usage")) {
      const [publicId, analysisPublicId, playerId, accessKind, windowStart, windowEnd, slot] = this.values;
      if (this.database.usage.some(row => row.analysisPublicId === analysisPublicId
        || (row.playerId === playerId && row.accessKind === accessKind && row.slot === slot
          && ["reserved", "consumed"].includes(row.status)))) return { meta: { changes: 0 } };
      this.database.usage.push({ publicId, analysisPublicId, playerId, accessKind, planKey: null,
        windowStart, windowEnd, slot, status: "reserved" });
      return { meta: { changes: 1 } };
    }
    if (this.sql.includes("INSERT OR IGNORE INTO player_entitlement_audit")) {
      const [eventKey, playerId, entitlementKey, analysisPublicId, metadataJson] = this.values;
      if (this.database.audit.some(row => row.eventKey === eventKey)) return { meta: { changes: 0 } };
      this.database.audit.push({ eventKey, playerId, entitlementKey, analysisPublicId, metadataJson });
      return { meta: { changes: 1 } };
    }
    throw new Error(`Unhandled run SQL: ${this.sql}`);
  }
}

class FakeDatabase {
  players = [42, 43];
  entitlements = [{ id: 1, publicId: "entitlement", playerId: 42,
    entitlementKey: OWNER_QA_ENTITLEMENT_KEY, status: "active", revokedAt: null }];
  usage = [];
  audit = [];

  prepare(sql) {
    return new FakeStatement(this, sql);
  }
}

test("configured bootstrap grants once by internal player id and records the permanent audit", async () => {
  const database = new FakeDatabase();
  database.entitlements = [];
  assert.equal(await ensureConfiguredOwnerQaEntitlement(database, "43"), true);
  assert.equal(await ensureConfiguredOwnerQaEntitlement(database, "43"), false);
  assert.equal(await ensureConfiguredOwnerQaEntitlement(database, "999"), false);
  assert.equal(database.entitlements.length, 1);
  assert.equal(database.entitlements[0].playerId, 43);
  assert.equal(database.audit.length, 1);
  assert.equal(JSON.parse(database.audit[0].metadataJson).permanent, true);
});

test("owner QA authorization is keyed only to an active internal player id", async () => {
  const database = new FakeDatabase();
  assert.equal((await activeOwnerQaEntitlement(database, 42))?.entitlementKey, OWNER_QA_ENTITLEMENT_KEY);
  assert.equal(await activeOwnerQaEntitlement(database, 41), null);

  const source = await readFile(new URL("../lib/owner-qa-entitlement.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /rafaelwestin|@gmail\.com/i);
  assert.match(source, /player_id = \?/);
});

test("owner QA receives distinct unlimited slots idempotently with an audit event per analysis", async () => {
  const database = new FakeDatabase();
  const first = await reserveOwnerQaUsage(database, 42, "analysis-a");
  const second = await reserveOwnerQaUsage(database, 42, "analysis-b");
  const duplicate = await reserveOwnerQaUsage(database, 42, "analysis-a");

  assert.equal(first.accessKind, OWNER_QA_ENTITLEMENT_KEY);
  assert.equal(first.unlimited, true);
  assert.equal(first.limit, null);
  assert.equal(first.slot, 1);
  assert.equal(second.slot, 2);
  assert.equal(duplicate.slot, 1);
  assert.equal(database.usage.length, 2);
  assert.equal(database.audit.length, 2);
  assert.ok(database.audit.every(row => JSON.parse(row.metadataJson).stripeRequired === false));
});

test("owner QA stays outside product measurement and calibration by default", async () => {
  const [route, events, admin, controls] = await Promise.all([
    readFile(new URL("../app/api/analyses/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/events/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/subsystem-controls.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(route, /reportingScope: reservedAccess\.reportingScope === "owner_qa"/);
  assert.match(route, /calibrationOptIn: false/);
  assert.match(events, /activeOwnerQaEntitlement/);
  assert.match(admin, /reportingScope !== "owner_qa"/);
  assert.match(admin, /accessKind !== "owner_qa"/);
  assert.match(controls, /OWNER_QA_ENTITLEMENT_ENABLED/);
});
