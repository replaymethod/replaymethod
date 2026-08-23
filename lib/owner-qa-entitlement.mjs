export const OWNER_QA_ENTITLEMENT_KEY = "owner_qa";
export const OWNER_QA_WINDOW_START = "1970-01-01T00:00:00.000Z";
export const OWNER_QA_WINDOW_END = "9999-12-31T23:59:59.999Z";
const MAX_SLOT_RETRIES = 12;

export async function ensureConfiguredOwnerQaEntitlement(database, configuredPlayerId) {
  const playerId = Number(configuredPlayerId);
  if (!Number.isInteger(playerId) || playerId <= 0) return false;
  const player = await database.prepare("SELECT id FROM players WHERE id = ? AND status = 'active' LIMIT 1")
    .bind(playerId).first();
  if (!player) return false;

  const result = await database.prepare(`INSERT OR IGNORE INTO player_entitlements (
      public_id, player_id, entitlement_key, status, granted_by
    ) VALUES (?, ?, ?, 'active', 'environment:OWNER_QA_PLAYER_ID')`)
    .bind(crypto.randomUUID().replaceAll("-", ""), playerId, OWNER_QA_ENTITLEMENT_KEY).run();
  if (!result.meta.changes) return false;

  await database.prepare(`INSERT OR IGNORE INTO player_entitlement_audit (
      event_key, player_id, entitlement_key, action, actor, metadata_json
    ) VALUES (?, ?, ?, 'granted', 'environment:OWNER_QA_PLAYER_ID', ?)`)
    .bind(`${OWNER_QA_ENTITLEMENT_KEY}:granted:player:${playerId}`, playerId,
      OWNER_QA_ENTITLEMENT_KEY, JSON.stringify({ stripeRequired: false, permanent: true })).run();
  return true;
}

export async function activeOwnerQaEntitlement(database, playerId) {
  if (!Number.isInteger(playerId) || playerId <= 0) return null;
  return database.prepare(`SELECT id, public_id AS publicId, player_id AS playerId,
      entitlement_key AS entitlementKey, granted_at AS grantedAt
    FROM player_entitlements
    WHERE player_id = ? AND entitlement_key = ? AND status = 'active' AND revoked_at IS NULL
    LIMIT 1`).bind(playerId, OWNER_QA_ENTITLEMENT_KEY).first();
}

export async function reserveOwnerQaUsage(database, playerId, analysisPublicId) {
  const existing = await database.prepare(`SELECT access_kind AS accessKind, plan_key AS planKey,
      window_start AS windowStart, window_end AS windowEnd, slot
    FROM analysis_usage WHERE analysis_public_id = ? AND status IN ('reserved', 'consumed')`)
    .bind(analysisPublicId).first();
  if (existing) return existing.accessKind === OWNER_QA_ENTITLEMENT_KEY
    ? { ...existing, unlimited: true, reportingScope: OWNER_QA_ENTITLEMENT_KEY }
    : { ...existing, unlimited: false, reportingScope: "product" };

  for (let attempt = 0; attempt < MAX_SLOT_RETRIES; attempt += 1) {
    const next = await database.prepare(`SELECT COALESCE(MAX(slot), 0) + 1 AS slot
      FROM analysis_usage WHERE player_id = ? AND access_kind = ?`)
      .bind(playerId, OWNER_QA_ENTITLEMENT_KEY).first();
    const slot = Number(next?.slot || 1);
    const result = await database.prepare(`INSERT OR IGNORE INTO analysis_usage (
        public_id, analysis_public_id, player_id, access_kind, plan_key,
        window_start, window_end, slot, status
      ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, 'reserved')`)
      .bind(crypto.randomUUID().replaceAll("-", ""), analysisPublicId, playerId,
        OWNER_QA_ENTITLEMENT_KEY, OWNER_QA_WINDOW_START, OWNER_QA_WINDOW_END, slot).run();
    if (!result.meta.changes) continue;

    await database.prepare(`INSERT OR IGNORE INTO player_entitlement_audit (
        event_key, player_id, entitlement_key, action, analysis_public_id, actor, metadata_json
      ) VALUES (?, ?, ?, 'analysis_reserved', ?, 'server:analysis_reservation', ?)`)
      .bind(`${OWNER_QA_ENTITLEMENT_KEY}:analysis_reserved:${analysisPublicId}`, playerId,
        OWNER_QA_ENTITLEMENT_KEY, analysisPublicId,
        JSON.stringify({ accessKind: OWNER_QA_ENTITLEMENT_KEY, slot, stripeRequired: false })).run();

    return {
      accessKind: OWNER_QA_ENTITLEMENT_KEY,
      planKey: null,
      limit: null,
      unlimited: true,
      paymentGrace: false,
      reportingScope: OWNER_QA_ENTITLEMENT_KEY,
      windowStart: OWNER_QA_WINDOW_START,
      windowEnd: OWNER_QA_WINDOW_END,
      slot,
    };
  }
  throw new Error("Could not reserve a concurrent owner QA analysis slot.");
}
