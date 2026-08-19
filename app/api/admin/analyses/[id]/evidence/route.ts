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
  const fileName = (row.fileName || "match.replay").replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120) || "match.replay";
  headers.set("Content-Type", "application/octet-stream");
  headers.set("Content-Disposition", `attachment; filename="${fileName}"`);
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(object.body, { headers });
}
