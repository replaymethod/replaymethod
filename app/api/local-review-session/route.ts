import { createLocalReviewSession } from "../../../lib/local-review-auth.mjs";
import { isSameOriginRequest } from "../../../lib/request-security.mjs";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "Invalid local review request." }, { status: 403 });
  try {
    const form = await request.formData();
    const { env } = await import("cloudflare:workers");
    const session = await createLocalReviewSession(env, request.headers, {
      displayName: form.get("displayName"),
      email: form.get("email"),
      accessCode: form.get("accessCode"),
    });
    if (!session) return Response.json({ error: "Identity or access code was not accepted." }, { status: 401 });
    const response = Response.json({ authenticated: true, redirectTo: session.role === "owner" ? "/local-review-owner" : "/admin/rl-review" });
    response.headers.set("Set-Cookie", session.cookie);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch {
    return Response.json({ error: "Identity or access code was not accepted." }, { status: 401 });
  }
}
