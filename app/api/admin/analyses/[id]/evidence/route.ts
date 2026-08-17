import { eq } from "drizzle-orm";
import { getDb } from "../../../../../../db";
import { analysisRequests } from "../../../../../../db/schema";
import { requireSiteAdminApi } from "../../../../../../lib/admin";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireSiteAdminApi();
  if (unauthorized) return unauthorized;
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return new Response("Not found", { status: 404 });
  const db = await getDb();
  const row = await db.select({ fileKey: analysisRequests.fileKey, fileName: analysisRequests.originalFileName }).from(analysisRequests).where(eq(analysisRequests.id, id)).get();
  if (!row?.fileKey) return new Response("No uploaded replay", { status: 404 });
  const { env } = await import("cloudflare:workers");
  const object = await (env as unknown as { BUCKET?: R2Bucket }).BUCKET?.get(row.fileKey);
  if (!object) return new Response("File not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Content-Disposition", `attachment; filename="${(row.fileName || "match.replay").replaceAll('"', "")}"`);
  headers.set("Cache-Control", "private, no-store");
  return new Response(object.body, { headers });
}
