import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { requireChatGPTUser } from "../chatgpt-auth";
import { getDb } from "../../db";
import { productReviewSubmissions } from "../../db/schema";
import { ensureProductReviewerApplicant, getActiveProductReviewer } from "../../lib/admin";
import { PRODUCT_REVIEW_SECTIONS, PRODUCT_REVIEW_VERSION, isProductReviewKind } from "../../lib/product-review";
import ProductReviewForm from "./ProductReviewForm";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  try { return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
}

export default async function ProductReviewPage() {
  const user = await requireChatGPTUser("/product-review");
  await ensureProductReviewerApplicant(user);
  const reviewer = await getActiveProductReviewer(user);

  if (!reviewer || !isProductReviewKind(reviewer.reviewKind)) {
    return <main className="product-review-page"><section className="product-review-access"><span>PRIVATE PRODUCT REVIEW</span><h1>Your secure review request is recorded.</h1><p>The owner must assign either the commercial or UX checklist before product access opens. No Rocket League detector moments or reviewer labels are available here.</p><Link href="/">Return to Replay Method</Link></section></main>;
  }

  const db = await getDb();
  const submission = await db.select().from(productReviewSubmissions).where(and(
    eq(productReviewSubmissions.reviewerId, reviewer.id),
    eq(productReviewSubmissions.reviewKind, reviewer.reviewKind)
  )).get();
  const existingEvidence = parseJson<Array<{ issueIndex: number; originalName: string; size: number; sha256: string }>>(submission?.evidenceKeysJson, []).map(({ issueIndex, originalName, size, sha256 }) => ({ issueIndex, originalName, size, sha256 }));

  return <main className="product-review-page"><section className="product-review-shell">
    <nav className="product-review-nav"><Link href="/">Replay Method</Link><div><span>{reviewer.displayName || reviewer.email}</span><b>{reviewer.reviewKind === "commercial" ? "Commercial review" : "UX / funnel review"}</b></div></nav>
    <header className="product-review-hero"><div><span>PRIVATE · {PRODUCT_REVIEW_VERSION}</span><h1>{reviewer.reviewKind === "commercial" ? "Test the business, not the pitch." : "Follow the player, not the page."}</h1><p>{reviewer.reviewKind === "commercial" ? "Assess purchase intent, free-to-paid logic, retention and defensibility with concrete evidence." : "Test the shortest real funnel for comprehension, speed, friction and high-octane simplicity."}</p></div><aside><span>SEPARATE EVIDENCE LANE</span><b>Product feedback only</b><small>Never counted as an RL detector label</small></aside></header>
    <section className="product-review-brief"><b>How to run this review</b><ol><li>Start from the live homepage as a first-time player.</li><li>Follow the real free path and record where intent or understanding changes.</li><li>For every concrete issue, write the problem, exact reproduction steps and a suggested improvement.</li><li>Attach a screenshot or short screen recording when it makes the issue reproducible.</li></ol></section>
    <ProductReviewForm reviewerPublicId={reviewer.publicId} reviewKind={reviewer.reviewKind} sections={PRODUCT_REVIEW_SECTIONS[reviewer.reviewKind]} initial={{
      state: submission?.state ?? "draft",
      checklist: parseJson(submission?.checklistJson, {}),
      issues: parseJson(submission?.issuesJson, []),
      evidence: existingEvidence,
      overallRecommendation: submission?.overallRecommendation ?? "",
      sessionNotes: submission?.sessionNotes ?? "",
      submittedAt: submission?.submittedAt ?? null
    }} />
  </section></main>;
}
