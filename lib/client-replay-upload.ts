import { FALLBACK_MESSAGE, readApiResponse } from "./client-api-response.mjs";

type ApiPayload = { error?: unknown; message?: unknown; [key: string]: unknown };

export { readApiResponse };

async function apiError(response: Response, fallback: string) {
  const payload = await readApiResponse(response);
  const message = typeof payload.error === "string" ? payload.error : typeof payload.message === "string" ? payload.message : fallback;
  return new Error(message);
}

async function retryPart(url: string, token: string, part: Blob) {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/octet-stream" },
        body: part,
      });
      if (response.ok) return;
      lastError = await apiError(response, FALLBACK_MESSAGE);
      if (response.status < 500 && response.status !== 409) throw lastError;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(FALLBACK_MESSAGE);
    }
  }
  throw lastError || new Error(FALLBACK_MESSAGE);
}

export type StagedReplay = { uploadId: string; uploadToken: string; fileSaved: true };

export async function uploadReplayInChunks(file: File, email: string, dataConsent: boolean, onProgress?: (percent: number) => void): Promise<StagedReplay> {
  const initiated = await fetch("/api/replay-uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, fileName: file.name, fileSize: file.size, dataConsent }),
  });
  const start = await readApiResponse(initiated) as ApiPayload & { uploadId?: unknown; uploadToken?: unknown; chunkSize?: unknown; expectedParts?: unknown };
  if (!initiated.ok || typeof start.uploadId !== "string" || typeof start.uploadToken !== "string" || typeof start.chunkSize !== "number" || typeof start.expectedParts !== "number") {
    throw new Error(typeof start.error === "string" ? start.error : FALLBACK_MESSAGE);
  }

  for (let partNumber = 0; partNumber < start.expectedParts; partNumber += 1) {
    const offset = partNumber * start.chunkSize;
    await retryPart(`/api/replay-uploads/${start.uploadId}/parts/${partNumber}`, start.uploadToken, file.slice(offset, offset + start.chunkSize));
    onProgress?.(Math.round(((partNumber + 1) / start.expectedParts) * 90));
  }

  const completed = await fetch(`/api/replay-uploads/${start.uploadId}/complete`, {
    method: "POST",
    headers: { Authorization: `Bearer ${start.uploadToken}`, "Content-Type": "application/json" },
    body: "{}",
  });
  const finish = await readApiResponse(completed);
  if (!completed.ok) throw new Error(typeof finish.error === "string" ? finish.error : "Your replay parts were saved, but final assembly did not finish. Try again; the saved parts will be reused.");
  onProgress?.(100);
  return { uploadId: start.uploadId, uploadToken: start.uploadToken, fileSaved: true };
}
