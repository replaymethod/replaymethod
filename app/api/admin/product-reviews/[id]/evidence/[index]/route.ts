import { eq } from "drizzle-orm";
import { getDb } from "../../../../../../../db";
import { productReviewSubmissions } from "../../../../../../../db/schema";
import { requireSiteAdminApi } from "../../../../../../../lib/admin";

type EvidenceRecord = { issueIndex: number; objectKey: string; originalName: string; contentType: string };

export async function GET(_: Request, { params }: { params: Promise<{ id: string; index: string }> }) {
  const unauthorized = await requireSiteAdminApi();
  if (unauthorized) return unauthorized;
  const values = await params;
  const id = Number(values.id);
  const issueIndex = Number(values.index);
  if (!Number.isSafeInteger(id) || id < 1 || !Number.isInteger(issueIndex) || issueIndex < 0 || issueIndex > 4) return new Response("Not found", { status: 404 });
  const db = await getDb();
  const row = await db.select({ evidenceKeysJson: productReviewSubmissions.evidenceKeysJson }).from(productReviewSubmissions).where(eq(productReviewSubmissions.id, id)).get();
  if (!row) return new Response("Not found", { status: 404 });
  let evidence: EvidenceRecord[] = [];
  try { const parsed = JSON.parse(row.evidenceKeysJson) as unknown; if (Array.isArray(parsed)) evidence = parsed as EvidenceRecord[]; } catch { /* empty manifest */ }
  const item = evidence.find(value => value.issueIndex === issueIndex);
  if (!item?.objectKey?.startsWith("product-review-private/")) return new Response("Not found", { status: 404 });
  const { env } = await import("cloudflare:workers");
  const object = await (env as unknown as { BUCKET?: R2Bucket }).BUCKET?.get(item.objectKey);
  if (!object) return new Response("Evidence not found", { status: 404 });
  const safeName = item.originalName.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-100) || "review-evidence";
  return new Response(object.body, { headers: {
    "Content-Type": item.contentType || "application/octet-stream",
    "Content-Disposition": `attachment; filename="${safeName}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff"
  } });
}
