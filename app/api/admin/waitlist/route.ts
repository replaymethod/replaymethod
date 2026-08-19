import { desc, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDb } from "../../../../db";
import { waitlist } from "../../../../db/schema";
import { isConfiguredSiteAdmin, requireSiteAdminMutation } from "../../../../lib/admin";

function csvCell(value: string | number) {
  const text = String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user || !await isConfiguredSiteAdmin(user)) return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "no-store" } });

  const db = await getDb();
  const rows = await db.select().from(waitlist).orderBy(desc(waitlist.createdAt), desc(waitlist.id));
  const csv = [["email", "game", "source", "campaign", "consent_at", "privacy_version", "joined_at"], ...rows.map(row => [row.email, row.game, row.source, row.campaign ?? "", row.consentAt, row.privacyVersion, row.createdAt])].map(row => row.map(csvCell).join(",")).join("\n");
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="replaymethod-waitlist.csv"`, "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  const unauthorized = await requireSiteAdminMutation(request);
  if (unauthorized) return unauthorized;

  const payload = await request.json().catch(() => null) as { id?: unknown } | null;
  const id = Number(payload?.id);
  if (!Number.isSafeInteger(id) || id < 1) return Response.json({ error: "Invalid waitlist entry." }, { status: 400 });

  const db = await getDb();
  const removed = await db.delete(waitlist).where(eq(waitlist.id, id)).returning({ id: waitlist.id });
  if (!removed.length) return Response.json({ error: "Entry not found." }, { status: 404 });
  return Response.json({ deleted: true }, { headers: { "Cache-Control": "no-store" } });
}
