import { getChatGPTUser, type ChatGPTUser } from "../app/chatgpt-auth";
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
