import { eq } from "drizzle-orm";
import { getDb } from "../../../../../../db";
import { productReviewSubmissions } from "../../../../../../db/schema";
import { requireSiteAdminApi } from "../../../../../../lib/admin";

type EvidenceRecord = { issueIndex: number; objectKey: string; originalName: string; contentType: string; size: number; sha256: string };

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireSiteAdminApi();
  if (unauthorized) return unauthorized;
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) return new Response("Not found", { status: 404 });
  const db = await getDb();
  const row = await db.select().from(productReviewSubmissions).where(eq(productReviewSubmissions.id, id)).get();
  if (!row) return new Response("Not found", { status: 404 });
  let evidence: EvidenceRecord[] = [];
  try { const parsed = JSON.parse(row.evidenceKeysJson) as unknown; if (Array.isArray(parsed)) evidence = parsed as EvidenceRecord[]; } catch { /* empty manifest */ }
  return Response.json({
    review: { publicId: row.publicId, reviewKind: row.reviewKind, state: row.state, submittedAt: row.submittedAt },
    evidence: evidence.map(item => ({ issueIndex: item.issueIndex, originalName: item.originalName, contentType: item.contentType, size: item.size, sha256: item.sha256, download: `/api/admin/product-reviews/${id}/evidence/${item.issueIndex}` }))
  }, { headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
