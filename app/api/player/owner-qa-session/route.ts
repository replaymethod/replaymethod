import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDatabase } from "../../../../db";
import { createVerifiedOwnerQaSession } from "../../../../lib/owner-qa-session.mjs";
import { isSameOriginRequest } from "../../../../lib/request-security.mjs";
import { subsystemEnabled } from "../../../../lib/subsystem-controls.mjs";

export const runtime = "edge";

const headers = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Invalid owner verification request." }, { status: 403, headers });
  }
  const user = await getChatGPTUser();
  if (!user?.id) {
    return Response.json({ error: "Sign in with the verified owner account first.", code: "owner_signin_required" }, { status: 401, headers });
  }
  const { env } = await import("cloudflare:workers");
  const runtime = env as unknown as Record<string, string | undefined>;
  if (!subsystemEnabled(runtime.OWNER_QA_ENTITLEMENT_ENABLED)) {
    return Response.json({ error: "Owner QA access is paused.", code: "owner_qa_disabled" }, { status: 503, headers });
  }
  const result = await createVerifiedOwnerQaSession(await getDatabase(), user, runtime);
  if (!result.ok || !result.cookie) {
    return Response.json({ error: "This verified account is not linked to the owner QA entitlement.", code: result.code }, { status: 403, headers });
  }
  const response = Response.json({ ok: true, ownerQa: true, redirect: "/analyze" }, { headers });
  response.headers.set("Set-Cookie", result.cookie);
  return response;
}
