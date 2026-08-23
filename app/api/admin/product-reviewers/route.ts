import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { productReviewers, productReviewSubmissions } from "../../../../db/schema";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { requireSiteAdminApi, requireSiteAdminMutation } from "../../../../lib/admin";
import { isProductReviewKind } from "../../../../lib/product-review";

export async function GET() {
  const unauthorized = await requireSiteAdminApi();
  if (unauthorized) return unauthorized;
  const db = await getDb();
  const reviewers = await db.select().from(productReviewers);
  return Response.json({ reviewers }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const unauthorized = await requireSiteAdminMutation(request);
  if (unauthorized) return unauthorized;
  const actor = await getChatGPTUser();
  if (!actor) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const payload = await request.json() as Record<string, unknown>;
    const id = Number(payload.id);
    const status = payload.status === "active" || payload.status === "revoked" ? payload.status : null;
    const reviewKind = payload.reviewKind;
    if (!Number.isInteger(id) || id < 1 || !status) {
      return Response.json({ error: "Choose a valid product reviewer and status." }, { status: 400 });
    }
    if (status === "active" && !isProductReviewKind(reviewKind)) {
      return Response.json({ error: "Assign either the commercial or UX review." }, { status: 400 });
    }

    const db = await getDb();
    const reviewer = await db.select().from(productReviewers).where(eq(productReviewers.id, id)).get();
    if (!reviewer) return Response.json({ error: "Product reviewer not found." }, { status: 404 });
    const now = new Date().toISOString();
    await db.update(productReviewers).set({
      status,
      reviewKind: status === "active" ? reviewKind as string : reviewer.reviewKind,
      approvedBy: status === "active" ? actor.email.toLowerCase() : reviewer.approvedBy,
      approvedAt: status === "active" ? now : reviewer.approvedAt,
      revokedAt: status === "revoked" ? now : null,
      updatedAt: now
    }).where(eq(productReviewers.id, id));
    return Response.json({ saved: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Could not update product reviewer access." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const unauthorized = await requireSiteAdminMutation(request);
  if (unauthorized) return unauthorized;
  try {
    const payload = await request.json() as Record<string, unknown>;
    const id = Number(payload.id);
    if (!Number.isInteger(id) || id < 1 || payload.confirmation !== "DELETE") {
      return Response.json({ error: "Explicit deletion confirmation is required." }, { status: 400 });
    }
    const db = await getDb();
    const reviewer = await db.select().from(productReviewers).where(eq(productReviewers.id, id)).get();
    if (!reviewer) return Response.json({ error: "Product reviewer not found." }, { status: 404 });
    const submissions = await db.select().from(productReviewSubmissions).where(eq(productReviewSubmissions.reviewerId, id));
    const keys = submissions.flatMap(row => {
      try {
        const parsed = JSON.parse(row.evidenceKeysJson) as unknown;
        return Array.isArray(parsed) ? parsed.flatMap(item => item && typeof item === "object" && "objectKey" in item && typeof item.objectKey === "string" && item.objectKey.startsWith("product-review-private/") ? [item.objectKey] : []) : [];
      } catch { return []; }
    });
    if (keys.length) {
      const { env } = await import("cloudflare:workers");
      const bucket = (env as unknown as { BUCKET?: R2Bucket }).BUCKET;
      if (!bucket) return Response.json({ error: "Private evidence storage is unavailable; no records were deleted." }, { status: 503 });
      await Promise.all(keys.map(key => bucket.delete(key)));
    }
    await db.delete(productReviewSubmissions).where(eq(productReviewSubmissions.reviewerId, id));
    await db.delete(productReviewers).where(eq(productReviewers.id, id));
    return Response.json({ deleted: true, evidenceObjectsDeleted: keys.length }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Could not delete the product review data; no success was recorded." }, { status: 500 });
  }
}
