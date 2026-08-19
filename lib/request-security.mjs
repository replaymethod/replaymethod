export function isSameOriginRequest(request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function declaredBodyTooLarge(request, maximumBytes) {
  const raw = request.headers.get("content-length");
  if (raw == null) return false;
  const size = Number(raw);
  return !Number.isSafeInteger(size) || size < 0 || size > maximumBytes;
}

export function operationalErrorCode(error) {
  const coded = error && typeof error === "object" && "code" in error
    ? String(error.code || "")
    : "";
  const candidate = coded || (error instanceof Error ? error.name : "unknown_error");
  return candidate.replace(/[^a-zA-Z0-9._:-]/g, "_").slice(0, 80) || "unknown_error";
}
