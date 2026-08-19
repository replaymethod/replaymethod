import { getDb } from "../../../db";
import { funnelEvents } from "../../../db/schema";
import { normalizeProductEvent } from "../../../lib/analytics-policy.mjs";
import { isSameOriginRequest } from "../../../lib/request-security.mjs";

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    const event = normalizeProductEvent(await request.json() as Record<string, unknown>);
    if (!event) return new Response(null, { status: 400 });

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
