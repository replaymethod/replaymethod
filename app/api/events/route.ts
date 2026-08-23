import { getDatabase, getDb } from "../../../db";
import { funnelEvents } from "../../../db/schema";
import { normalizeProductEvent } from "../../../lib/analytics-policy.mjs";
import { activeOwnerQaEntitlement } from "../../../lib/owner-qa-entitlement.mjs";
import { authenticatedPlayer } from "../../../lib/player-session";
import { isSameOriginRequest } from "../../../lib/request-security.mjs";

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    const event = normalizeProductEvent(await request.json() as Record<string, unknown>);
    if (!event) return new Response(null, { status: 400 });

    const database = await getDatabase();
    const player = await authenticatedPlayer(request, database);
    if (player && await activeOwnerQaEntitlement(database, player.id)) {
      return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    }

    const db = await getDb();
    await db.insert(funnelEvents).values({
      ...event,
    });
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch {
    // Analytics is deliberately fail-soft and never affects the product flow.
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  }
}
