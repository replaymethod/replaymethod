import { clearLocalReviewSessionCookie, isLoopbackReviewRequest } from "../../../../lib/local-review-auth.mjs";
import { isSameOriginRequest } from "../../../../lib/request-security.mjs";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request) || !isLoopbackReviewRequest(request.headers)) {
    return Response.json({ error: "Invalid local review request." }, { status: 403 });
  }
  const response = Response.json({ ended: true });
  response.headers.set("Set-Cookie", clearLocalReviewSessionCookie());
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
