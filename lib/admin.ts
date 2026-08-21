import { getChatGPTUser, type ChatGPTUser } from "../app/chatgpt-auth";
import { or, eq } from "drizzle-orm";
import { getDb } from "../db";
import { rlReviewers } from "../db/schema";
import { isSameOriginRequest } from "./request-security.mjs";

function configuredValues(...values: Array<string | undefined>) {
  return new Set(values.flatMap(value => (value ?? "").split(/[\n,]/)).map(value => value.trim().toLowerCase()).filter(Boolean));
}

export async function isConfiguredSiteAdmin(user: ChatGPTUser) {
  const { env } = await import("cloudflare:workers");
  const configured = env as unknown as { ADMIN_EMAIL?: string; ADMIN_EMAILS?: string; ADMIN_USER_ID?: string; ADMIN_USER_IDS?: string };
  const allowedUserIds = configuredValues(configured.ADMIN_USER_ID, configured.ADMIN_USER_IDS);
  const allowedEmails = configuredValues(configured.ADMIN_EMAIL, configured.ADMIN_EMAILS);
  return Boolean(
    (user.id && allowedUserIds.has(user.id.toLowerCase()))
    || allowedEmails.has(user.email.toLowerCase())
  );
}

export async function isSiteAdmin() {
  const user = await getChatGPTUser();
  return user ? isConfiguredSiteAdmin(user) : false;
}

export async function requireSiteAdminApi() {
  if (!(await isSiteAdmin())) return Response.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  return null;
}

export async function requireSiteAdminMutation(request: Request) {
  const unauthorized = await requireSiteAdminApi();
  if (unauthorized) return unauthorized;
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Invalid admin request." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  return null;
}

export async function getActiveRlReviewer(user: ChatGPTUser) {
  if (!user.id) return null;
  const db = await getDb();
  const reviewer = await db.select().from(rlReviewers).where(or(
    eq(rlReviewers.userId, user.id),
    eq(rlReviewers.email, user.email.toLowerCase())
  )).get();
  return reviewer?.status === "active" && reviewer.userId === user.id ? reviewer : null;
}

export async function ensureRlReviewerApplicant(user: ChatGPTUser) {
  if (!user.id) return null;
  const db = await getDb();
  const email = user.email.toLowerCase();
  const existing = await db.select().from(rlReviewers).where(or(
    eq(rlReviewers.userId, user.id),
    eq(rlReviewers.email, email)
  )).get();
  if (existing) return existing;
  await db.insert(rlReviewers).values({
    publicId: crypto.randomUUID().replaceAll("-", ""),
    userId: user.id,
    email,
    displayName: user.fullName || user.displayName,
    qualification: "unverified",
    status: "pending"
  }).onConflictDoNothing();
  return db.select().from(rlReviewers).where(eq(rlReviewers.userId, user.id)).get();
}

export async function requireRlReviewerMutation(request: Request) {
  if (!isSameOriginRequest(request)) {
    return { response: Response.json({ error: "Invalid reviewer request." }, { status: 403, headers: { "Cache-Control": "no-store" } }), reviewer: null, user: null };
  }
  const user = await getChatGPTUser();
  if (!user) return { response: Response.json({ error: "Unauthorized" }, { status: 401 }), reviewer: null, user: null };
  const reviewer = await getActiveRlReviewer(user);
  if (!reviewer) return { response: Response.json({ error: "Active reviewer access required." }, { status: 403 }), reviewer: null, user };
  return { response: null, reviewer, user };
}
