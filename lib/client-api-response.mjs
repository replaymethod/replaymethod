const FALLBACK_MESSAGE = "We couldn’t save your replay. The file is still on your device—try again.";

export async function readApiResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const raw = await response.text();
  if (contentType.includes("application/json") || raw.trim().startsWith("{")) {
    try { return JSON.parse(raw); } catch { /* use the safe transport message below */ }
  }
  if (!response.ok) {
    const gateway = response.status === 413
      ? "This upload path rejected the request before Replay Method could save it. The file is still on your device—try again."
      : response.status >= 500
        ? "Replay Method’s upload service did not respond correctly. The file is still on your device—try again."
        : FALLBACK_MESSAGE;
    return { error: gateway, technicalCode: `http_${response.status}` };
  }
  return {};
}

export { FALLBACK_MESSAGE };
