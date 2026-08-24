import {
  createPlayerToken,
  expiresAt,
  hashPlayerToken,
  playerSessionCookie,
  PLAYER_SESSION_SECONDS,
} from "./player-identity.mjs";
import { activeOwnerQaEntitlement, OWNER_QA_ENTITLEMENT_KEY } from "./owner-qa-entitlement.mjs";

function configuredValues(...values) {
  return new Set(values.flatMap(value => (value || "").split(/[\n,]/))
    .map(value => value.trim().toLowerCase()).filter(Boolean));
}

export async function bindVerifiedOwnerQaIdentity(database, user, env) {
  const playerId = Number(env.OWNER_QA_PLAYER_ID);
  if (!user?.id || !Number.isInteger(playerId) || playerId <= 0) {
    return { ok: false, code: "owner_verification_unavailable" };
  }
  if (!await activeOwnerQaEntitlement(database, playerId)) {
    return { ok: false, code: "owner_entitlement_inactive" };
  }

  const existingByUser = await database.prepare(`SELECT player_id AS playerId FROM owner_qa_identities
    WHERE provider = 'chatgpt' AND provider_user_id = ? AND revoked_at IS NULL LIMIT 1`)
    .bind(user.id).first();
  if (existingByUser) {
    if (Number(existingByUser.playerId) !== playerId) return { ok: false, code: "owner_identity_mismatch" };
    await database.prepare(`UPDATE owner_qa_identities SET last_verified_at = CURRENT_TIMESTAMP
      WHERE provider = 'chatgpt' AND provider_user_id = ? AND revoked_at IS NULL`).bind(user.id).run();
    return { ok: true, playerId, newlyBound: false };
  }

  const existingByPlayer = await database.prepare(`SELECT provider_user_id AS providerUserId FROM owner_qa_identities
    WHERE player_id = ? AND revoked_at IS NULL LIMIT 1`).bind(playerId).first();
  if (existingByPlayer) return { ok: false, code: "owner_identity_mismatch" };

  const allowedIds = configuredValues(env.ADMIN_USER_ID, env.ADMIN_USER_IDS);
  const allowedEmails = configuredValues(env.ADMIN_EMAIL, env.ADMIN_EMAILS);
  const bootstrapAuthorized = allowedIds.has(user.id.toLowerCase())
    || (!allowedIds.size && allowedEmails.has(user.email.toLowerCase()));
  if (!bootstrapAuthorized) return { ok: false, code: "owner_identity_not_configured" };

  await database.prepare(`INSERT INTO owner_qa_identities (
      provider, provider_user_id, player_id
    ) VALUES ('chatgpt', ?, ?)`).bind(user.id, playerId).run();
  await database.prepare(`INSERT OR IGNORE INTO player_entitlement_audit (
      event_key, player_id, entitlement_key, action, actor, metadata_json
    ) VALUES (?, ?, ?, 'identity_bound', 'server:chatgpt_verified_session', ?)`)
    .bind(`${OWNER_QA_ENTITLEMENT_KEY}:identity_bound:player:${playerId}`, playerId,
      OWNER_QA_ENTITLEMENT_KEY, JSON.stringify({ provider: "chatgpt", stableUserIdRequired: true })).run();
  return { ok: true, playerId, newlyBound: true };
}

export async function createVerifiedOwnerQaSession(database, user, env) {
  const binding = await bindVerifiedOwnerQaIdentity(database, user, env);
  if (!binding.ok) return binding;
  const token = createPlayerToken();
  const now = new Date().toISOString();
  await database.prepare(`INSERT INTO player_sessions (token_hash, player_id, expires_at, last_seen_at)
    VALUES (?, ?, ?, ?)`).bind(await hashPlayerToken(token), binding.playerId,
      expiresAt(PLAYER_SESSION_SECONDS), now).run();
  await database.prepare(`INSERT OR IGNORE INTO player_entitlement_audit (
      event_key, player_id, entitlement_key, action, actor, metadata_json
    ) VALUES (?, ?, ?, 'session_verified', 'server:chatgpt_verified_session', ?)`)
    .bind(`${OWNER_QA_ENTITLEMENT_KEY}:session_verified:${await hashPlayerToken(token)}`, binding.playerId,
      OWNER_QA_ENTITLEMENT_KEY, JSON.stringify({ provider: "chatgpt", expiresAt: expiresAt(PLAYER_SESSION_SECONDS) })).run();
  return { ...binding, cookie: playerSessionCookie(token) };
}
