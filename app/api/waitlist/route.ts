import { getDb } from "../../../db";
import { waitlist } from "../../../db/schema";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const games = new Set(["general", "league", "valorant", "rocket-league"]);
const clean = (value: unknown, length: number) => typeof value === "string" ? value.trim().slice(0, length) : "";

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { email?: string; game?: string; source?: string; campaign?: string; website?: string; consent?: boolean };

    // Quietly accept obvious bot submissions without polluting the list.
    if (clean(payload.website, 200)) return Response.json({ message: "Your spot is reserved." }, { status: 201 });

    const email = clean(payload.email, 254).toLowerCase();
    const game = games.has(payload.game || "") ? payload.game! : "general";
    const source = clean(payload.source, 80).toLowerCase() || "direct";
    const campaign = clean(payload.campaign, 120) || null;
    if (!emailPattern.test(email)) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    if (payload.consent !== true) return Response.json({ error: "Please confirm that we may email you about the beta." }, { status: 400 });

    const db = await getDb();
    const inserted = await db.insert(waitlist).values({ email, game, source, campaign, privacyVersion: "2026-08-15" }).onConflictDoNothing().returning({ id: waitlist.id });
    return Response.json({ created: inserted.length > 0, message: inserted.length ? "Your founding spot is reserved." : "You’re already on this game’s waitlist." }, { status: 201 });
  } catch {
    return Response.json({ error: "We couldn’t add you right now. Try again." }, { status: 500 });
  }
}
