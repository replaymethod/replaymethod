import { getDatabase } from "../../../../db";
import { activeOwnerQaEntitlement } from "../../../../lib/owner-qa-entitlement.mjs";
import { authenticatedPlayer } from "../../../../lib/player-session";
import { subsystemEnabled } from "../../../../lib/subsystem-controls.mjs";

export const runtime = "edge";

export async function GET(request: Request) {
  const database = await getDatabase();
  const player = await authenticatedPlayer(request, database);
  if (!player) return Response.json({ authenticated: false, ownerQa: false }, { headers: { "Cache-Control": "private, no-store" } });
  const { env } = await import("cloudflare:workers");
  const enabled = subsystemEnabled((env as unknown as { OWNER_QA_ENTITLEMENT_ENABLED?: string }).OWNER_QA_ENTITLEMENT_ENABLED);
  const ownerQa = enabled && Boolean(await activeOwnerQaEntitlement(database, player.id));
  return Response.json({ authenticated: true, ownerQa }, { headers: { "Cache-Control": "private, no-store" } });
}
