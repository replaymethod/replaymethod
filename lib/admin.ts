import { getChatGPTUser } from "../app/chatgpt-auth";

export async function isSiteAdmin() {
  const user = await getChatGPTUser();
  if (!user) return false;
  const { env } = await import("cloudflare:workers");
  const adminEmail = (env as unknown as { ADMIN_EMAIL?: string }).ADMIN_EMAIL?.toLowerCase();
  return Boolean(adminEmail && user.email.toLowerCase() === adminEmail);
}

export async function requireSiteAdminApi() {
  if (!(await isSiteAdmin())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return null;
}
