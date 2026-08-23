import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { productReviewSubmissions } from "../../../db/schema";
import { requireProductReviewerMutation } from "../../../lib/admin";
import { PRODUCT_REVIEW_SECTIONS, isProductReviewKind } from "../../../lib/product-review";
import { cleanText } from "../../../lib/analysis";
import { declaredBodyTooLarge, operationalErrorCode } from "../../../lib/request-security.mjs";

export const runtime = "edge";

const MAX_EVIDENCE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 12 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_TOTAL_BYTES + 512 * 1024;
const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp", "video/mp4", "video/webm", "video/quicktime"]);
const allowedExtensions = /\.(png|jpe?g|webp|mp4|webm|mov)$/i;

type EvidenceRecord = { issueIndex: number; objectKey: string; originalName: string; contentType: string; size: number; sha256: string };

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-100) || "evidence";
}

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, "0")).join("");
}

function jsonObject(value: FormDataEntryValue | null) {
  if (typeof value !== "string") throw new Error("missing_payload");
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid_payload");
  return parsed as Record<string, unknown>;
}

function existingEvidence(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter(item => item && typeof item === "object") as EvidenceRecord[] : [];
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  const access = await requireProductReviewerMutation(request);
  if (access.response || !access.reviewer) return access.response;
  if (declaredBodyTooLarge(request, MAX_REQUEST_BYTES)) {
    return Response.json({ error: "Evidence files must total no more than 12 MB." }, { status: 413 });
  }
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "multipart/form-data") {
    return Response.json({ error: "Submit product review data as form data." }, { status: 415 });
  }

  const newObjectKeys: string[] = [];
  try {
    const reviewKind = access.reviewer.reviewKind;
    if (!isProductReviewKind(reviewKind)) return Response.json({ error: "A review type has not been assigned." }, { status: 403 });
    const form = await request.formData();
    const payload = jsonObject(form.get("payload"));
    const requestedState = payload.state === "submitted" ? "submitted" : "draft";
    const rawChecklist = payload.checklist && typeof payload.checklist === "object" && !Array.isArray(payload.checklist)
      ? payload.checklist as Record<string, unknown>
      : {};
    const checklist = Object.fromEntries(PRODUCT_REVIEW_SECTIONS[reviewKind].map(section => {
      const raw = rawChecklist[section.key] && typeof rawChecklist[section.key] === "object"
        ? rawChecklist[section.key] as Record<string, unknown>
        : {};
      const score = Number(raw.score);
      return [section.key, {
        score: Number.isInteger(score) && score >= 1 && score <= 5 ? score : null,
        finding: cleanText(raw.finding, 2000)
      }];
    }));
    const rawIssues = Array.isArray(payload.issues) ? payload.issues.slice(0, 5) : [];
    const issues = rawIssues.map(rawValue => {
      const raw = rawValue && typeof rawValue === "object" ? rawValue as Record<string, unknown> : {};
      const severity = ["low", "medium", "high", "critical"].includes(String(raw.severity)) ? String(raw.severity) : "medium";
      return {
        severity,
        problem: cleanText(raw.problem, 2000),
        steps: cleanText(raw.steps, 3000),
        suggestion: cleanText(raw.suggestion, 2000)
      };
    }).filter(issue => issue.problem || issue.steps || issue.suggestion);
    const overallRecommendation = cleanText(payload.overallRecommendation, 3000);
    const sessionNotes = cleanText(payload.sessionNotes, 5000);

    if (requestedState === "submitted") {
      const incompleteSection = Object.values(checklist).some(section => !section.score || !section.finding);
      if (incompleteSection || !overallRecommendation || !sessionNotes) {
        return Response.json({ error: "Complete every checklist score and finding, the recommendation and the session notes before submitting." }, { status: 400 });
      }
      if (issues.some(issue => !issue.problem || !issue.steps || !issue.suggestion)) {
        return Response.json({ error: "Each recorded issue needs a problem, reproduction steps and a suggested improvement." }, { status: 400 });
      }
    }

    const db = await getDb();
    const existing = await db.select().from(productReviewSubmissions).where(and(
      eq(productReviewSubmissions.reviewerId, access.reviewer.id),
      eq(productReviewSubmissions.reviewKind, reviewKind)
    )).get();
    if (existing?.state === "submitted") return Response.json({ error: "This product review is already submitted and locked." }, { status: 409 });

    const publicId = existing?.publicId ?? crypto.randomUUID().replaceAll("-", "");
    const priorEvidence = existingEvidence(existing?.evidenceKeysJson ?? "[]");
    const replacements = new Map<number, EvidenceRecord>();
    let totalBytes = 0;
    const pendingFiles: Array<{ issueIndex: number; file: File; bytes: ArrayBuffer }> = [];
    for (let issueIndex = 0; issueIndex < 5; issueIndex += 1) {
      const value = form.get(`issueEvidence-${issueIndex}`);
      if (!(value instanceof File) || value.size === 0) continue;
      totalBytes += value.size;
      if (value.size > MAX_EVIDENCE_BYTES || totalBytes > MAX_TOTAL_BYTES || (!allowedTypes.has(value.type) && !allowedExtensions.test(value.name))) {
        return Response.json({ error: "Use PNG, JPG, WebP, MP4, WebM or MOV evidence; each file must be at most 8 MB and the total at most 12 MB." }, { status: 400 });
      }
      pendingFiles.push({ issueIndex, file: value, bytes: await value.arrayBuffer() });
    }

    const { env } = await import("cloudflare:workers");
    const bucket = (env as unknown as { BUCKET?: R2Bucket }).BUCKET;
    if (pendingFiles.length && !bucket) return Response.json({ error: "Private review evidence storage is unavailable." }, { status: 503 });
    for (const pending of pendingFiles) {
      const objectKey = `product-review-private/${access.reviewer.publicId}/${publicId}/issue-${pending.issueIndex}-${crypto.randomUUID()}-${safeFileName(pending.file.name)}`;
      const sha256 = hex(await crypto.subtle.digest("SHA-256", pending.bytes));
      await bucket!.put(objectKey, pending.bytes, {
        httpMetadata: { contentType: pending.file.type || "application/octet-stream" },
        customMetadata: { purpose: "private-product-review", reviewKind, reviewerId: access.reviewer.publicId, sha256 }
      });
      newObjectKeys.push(objectKey);
      replacements.set(pending.issueIndex, { issueIndex: pending.issueIndex, objectKey, originalName: safeFileName(pending.file.name), contentType: pending.file.type || "application/octet-stream", size: pending.file.size, sha256 });
    }
    const nextEvidence = priorEvidence.filter(item => !replacements.has(item.issueIndex));
    for (const item of replacements.values()) nextEvidence.push(item);
    const now = new Date().toISOString();
    const values = {
      state: requestedState,
      checklistJson: JSON.stringify(checklist),
      issuesJson: JSON.stringify(issues),
      evidenceKeysJson: JSON.stringify(nextEvidence.sort((a, b) => a.issueIndex - b.issueIndex)),
      overallRecommendation: overallRecommendation || null,
      sessionNotes: sessionNotes || null,
      submittedAt: requestedState === "submitted" ? now : null,
      updatedAt: now
    };
    if (existing) {
      await db.update(productReviewSubmissions).set(values).where(eq(productReviewSubmissions.id, existing.id));
    } else {
      await db.insert(productReviewSubmissions).values({
        publicId,
        reviewerId: access.reviewer.id,
        reviewKind,
        ...values
      });
    }
    for (const previous of priorEvidence.filter(item => replacements.has(item.issueIndex))) {
      try { await bucket?.delete(previous.objectKey); } catch { /* superseded private evidence expires through later cleanup */ }
    }
    newObjectKeys.length = 0;
    return Response.json({ saved: true, state: requestedState, submittedAt: requestedState === "submitted" ? now : null, evidence: nextEvidence.map(({ issueIndex, originalName, size, sha256 }) => ({ issueIndex, originalName, size, sha256 })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (newObjectKeys.length) {
      try {
        const { env } = await import("cloudflare:workers");
        const bucket = (env as unknown as { BUCKET?: R2Bucket }).BUCKET;
        await Promise.all(newObjectKeys.map(key => bucket?.delete(key)));
      } catch { /* best-effort rollback */ }
    }
    console.error("product review submission failed", { code: operationalErrorCode(error) });
    return Response.json({ error: "Could not save the private product review." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
