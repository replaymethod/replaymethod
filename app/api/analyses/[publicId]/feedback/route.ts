import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { analysisRequests } from "../../../../../db/schema";
import { cleanText, publicIdPattern } from "../../../../../lib/analysis";

export async function POST(request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  if (!publicIdPattern.test(publicId)) return Response.json({ error: "Not found" }, { status: 404 });
  try {
    const payload = await request.json() as { score?: number; text?: string; caseStudyConsent?: boolean };
    const score = Number(payload.score);
    if (!Number.isInteger(score) || score < 1 || score > 5) return Response.json({ error: "Choose a score from 1 to 5." }, { status: 400 });

    const db = await getDb();
    const existing = await db.select({ status: analysisRequests.status }).from(analysisRequests).where(eq(analysisRequests.publicId, publicId)).get();
    if (!existing) return Response.json({ error: "Not found" }, { status: 404 });
    if (existing.status !== "ready") return Response.json({ error: "The report is not ready for feedback." }, { status: 409 });

    await db.update(analysisRequests).set({
      feedbackScore: score,
      feedbackText: cleanText(payload.text, 1000) || null,
      caseStudyConsent: payload.caseStudyConsent ? 1 : 0,
      updatedAt: new Date().toISOString()
    }).where(eq(analysisRequests.publicId, publicId));
    return Response.json({ saved: true });
  } catch {
    return Response.json({ error: "Could not save feedback." }, { status: 500 });
  }
}
