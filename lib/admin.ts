import { getChatGPTUser, type ChatGPTUser } from "../app/chatgpt-auth";
import { isSameOriginRequest } from "./request-security.mjs";

export async function isConfiguredSiteAdmin(user: ChatGPTUser) {
  const { env } = await import("cloudflare:workers");
  const configured = env as unknown as { ADMIN_EMAIL?: string; ADMIN_USER_ID?: string };
  const adminUserId = configured.ADMIN_USER_ID?.trim();
  if (adminUserId) return Boolean(user.id && user.id === adminUserId);
  const adminEmail = configured.ADMIN_EMAIL?.trim().toLowerCase();
  return Boolean(adminEmail && user.email.toLowerCase() === adminEmail);
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
