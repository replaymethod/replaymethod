import { eq } from "drizzle-orm";
import { getDb } from "../../../../../../db";
import { rlBetaSubmissions } from "../../../../../../db/schema";
import { requireSiteAdminApi } from "../../../../../../lib/admin";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireSiteAdminApi();
  if (unauthorized) return unauthorized;
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) return new Response("Not found", { status: 404 });

  const db = await getDb();
  const row = await db.select({ publicId: rlBetaSubmissions.publicId, fileKey: rlBetaSubmissions.fileKey, fileName: rlBetaSubmissions.originalFileName })
    .from(rlBetaSubmissions).where(eq(rlBetaSubmissions.id, id)).get();
  if (!row) return new Response("Not found", { status: 404 });

  const { env } = await import("cloudflare:workers");
  const object = await (env as unknown as { BUCKET?: R2Bucket }).BUCKET?.get(row.fileKey);
  if (!object) return new Response("Replay not found", { status: 404 });
  const safeName = row.fileName.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-100) || "calibration.replay";
  const fileName = `${row.publicId.slice(0, 10)}-${safeName}`;
  return new Response(object.body, { headers: {
    "Content-Type": "application/octet-stream",
    "Content-Disposition": `attachment; filename="${fileName}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff"
  } });
}
