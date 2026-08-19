import { getDatabase } from "../../../../db";
import { billingSnapshot } from "../../../../lib/analysis-entitlements";
import { authenticatedPlayer } from "../../../../lib/player-session";
import { operationalErrorCode } from "../../../../lib/request-security.mjs";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const db = await getDatabase();
    const player = await authenticatedPlayer(request, db);
    if (!player) return Response.json({ authenticated: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
    return Response.json({ authenticated: true, billing: await billingSnapshot(player.id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("billing status failed", { code: operationalErrorCode(error) });
    return Response.json({ authenticated: false, error: "Billing status is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
