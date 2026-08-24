import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { bindVerifiedOwnerQaIdentity, createVerifiedOwnerQaSession } from "../lib/owner-qa-session.mjs";

class Statement {
  constructor(db, sql) { this.db = db; this.sql = sql.replace(/\s+/g, " ").trim(); this.values = []; }
  bind(...values) { this.values = values; return this; }
  async first() {
    if (this.sql.includes("FROM player_entitlements")) return this.values[0] === 15 ? { id: 1, playerId: 15 } : null;
    if (this.sql.includes("provider_user_id = ?")) return this.db.identities.find(row => row.userId === this.values[0] && !row.revoked) ? { playerId: 15 } : null;
    if (this.sql.includes("WHERE player_id = ?") && this.sql.includes("owner_qa_identities")) {
      const row = this.db.identities.find(item => item.playerId === this.values[0] && !item.revoked);
      return row ? { providerUserId: row.userId } : null;
    }
    throw new Error(`Unhandled first: ${this.sql}`);
  }
  async run() {
    if (this.sql.startsWith("INSERT INTO owner_qa_identities")) {
      this.db.identities.push({ userId: this.values[0], playerId: this.values[1], revoked: false });
      return { meta: { changes: 1 } };
    }
    if (this.sql.startsWith("UPDATE owner_qa_identities")) return { meta: { changes: 1 } };
    if (this.sql.includes("player_entitlement_audit")) { this.db.audit.push(this.values); return { meta: { changes: 1 } }; }
    if (this.sql.includes("INSERT INTO player_sessions")) { this.db.sessions.push(this.values); return { meta: { changes: 1 } }; }
    throw new Error(`Unhandled run: ${this.sql}`);
  }
}

class Database {
  identities = [];
  audit = [];
  sessions = [];
  prepare(sql) { return new Statement(this, sql); }
}

const user = { id: "stable-owner-id", email: "owner@example.invalid" };
const env = { OWNER_QA_PLAYER_ID: "15", ADMIN_EMAIL: "owner@example.invalid" };

test("verified bootstrap persists the stable provider user id against the internal player id", async () => {
  const db = new Database();
  const first = await bindVerifiedOwnerQaIdentity(db, user, env);
  const second = await bindVerifiedOwnerQaIdentity(db, user, env);
  assert.deepEqual({ ok: first.ok, playerId: first.playerId, newlyBound: first.newlyBound }, { ok: true, playerId: 15, newlyBound: true });
  assert.equal(second.newlyBound, false);
  assert.deepEqual(db.identities, [{ userId: "stable-owner-id", playerId: 15, revoked: false }]);
});

test("a different verified user cannot take over an already-bound owner player", async () => {
  const db = new Database();
  db.identities.push({ userId: "stable-owner-id", playerId: 15, revoked: false });
  const result = await bindVerifiedOwnerQaIdentity(db, { id: "other-id", email: "owner@example.invalid" }, env);
  assert.deepEqual(result, { ok: false, code: "owner_identity_mismatch" });
});

test("activation issues only a hashed, locked-down session credential", async () => {
  const db = new Database();
  const result = await createVerifiedOwnerQaSession(db, user, env);
  assert.equal(result.ok, true);
  assert.match(result.cookie, /^__Host-rm_player_session=/);
  assert.match(result.cookie, /HttpOnly; Secure; SameSite=Lax/);
  assert.match(String(db.sessions[0][0]), /^[a-f0-9]{64}$/);
  assert.doesNotMatch(String(db.sessions[0][0]), /stable-owner-id/);
});

test("owner upload authorization fails distinctly without the bound player session", async () => {
  const source = await readFile(new URL("../lib/analysis-entitlements.ts", import.meta.url), "utf8");
  assert.match(source, /owner_verification_required/);
  assert.match(source, /signedIn\?\.id === playerId/);
  assert.ok(source.indexOf("owner_verification_required") < source.indexOf("free_analysis_used"));
});
