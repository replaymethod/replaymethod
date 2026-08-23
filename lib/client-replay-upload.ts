import { FALLBACK_MESSAGE, readApiResponse } from "./client-api-response.mjs";

type ApiPayload = { error?: unknown; message?: unknown; [key: string]: unknown };

export type ReplayUploadRecovery = {
  version: 1;
  uploadId: string;
  uploadToken: string;
  chunkSize: number;
  expectedParts: number;
  expiresAt: string;
  fileName: string;
  fileSize: number;
  fileLastModified: number;
  email: string;
};

type UploadOptions = {
  recovery?: ReplayUploadRecovery | null;
  onRecovery?: (recovery: ReplayUploadRecovery) => void;
  wait?: (milliseconds: number) => Promise<void>;
};

const FINALIZE_RETRY_DELAYS_MS = [750, 1_250, 2_000, 4_000, 8_000, 12_000, 12_000];

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

async function finalizeReplayUpload(session: ReplayUploadRecovery, wait: (milliseconds: number) => Promise<void>) {
  let lastError = new Error("Your replay parts were saved, but final assembly did not finish. Retry to resume the saved upload.");
  for (let attempt = 0; attempt <= FINALIZE_RETRY_DELAYS_MS.length; attempt += 1) {
    let completed: Response | null = null;
    let finish: ApiPayload & { recovery?: unknown; retryable?: unknown } = {};
    try {
      completed = await fetch(`/api/replay-uploads/${session.uploadId}/complete`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.uploadToken}`, "Content-Type": "application/json" },
        body: "{}",
      });
      finish = await readApiResponse(completed) as ApiPayload & { recovery?: unknown; retryable?: unknown };
    } catch (error) {
      lastError = error instanceof Error ? error : lastError;
    }
    if (completed) {
      if (completed.ok) return true;
      const message = typeof finish.error === "string" ? finish.error : lastError.message;
      lastError = new Error(message);
      if (finish.recovery === "parts_missing") return false;
      if (completed.status === 404 || completed.status === 410) throw lastError;
      if (finish.retryable !== true && completed.status !== 409 && completed.status < 500) throw lastError;
    }
    if (attempt < FINALIZE_RETRY_DELAYS_MS.length) await wait(FINALIZE_RETRY_DELAYS_MS[attempt]);
  }
  throw lastError;
}

export async function uploadReplayInChunks(
  file: File,
  email: string,
  dataConsent: boolean,
  onProgress?: (percent: number) => void,
  options: UploadOptions = {},
): Promise<StagedReplay> {
  const wait = options.wait || (milliseconds => new Promise(resolve => window.setTimeout(resolve, milliseconds)));
  let session = options.recovery || null;

  if (session) {
    onProgress?.(90);
    if (await finalizeReplayUpload(session, wait)) {
      onProgress?.(100);
      return { uploadId: session.uploadId, uploadToken: session.uploadToken, fileSaved: true };
    }
  } else {
    const initiated = await fetch("/api/replay-uploads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, fileName: file.name, fileSize: file.size, dataConsent }),
    });
    const start = await readApiResponse(initiated) as ApiPayload & {
      uploadId?: unknown;
      uploadToken?: unknown;
      chunkSize?: unknown;
      expectedParts?: unknown;
      expiresAt?: unknown;
    };
    if (!initiated.ok || typeof start.uploadId !== "string" || typeof start.uploadToken !== "string" || typeof start.chunkSize !== "number" || typeof start.expectedParts !== "number" || typeof start.expiresAt !== "string") {
      throw new Error(typeof start.error === "string" ? start.error : FALLBACK_MESSAGE);
    }
    session = {
      version: 1,
      uploadId: start.uploadId,
      uploadToken: start.uploadToken,
      chunkSize: start.chunkSize,
      expectedParts: start.expectedParts,
      expiresAt: start.expiresAt,
      fileName: file.name,
      fileSize: file.size,
      fileLastModified: file.lastModified,
      email: email.trim().toLowerCase(),
    };
    options.onRecovery?.(session);
  }

  for (let partNumber = 0; partNumber < session.expectedParts; partNumber += 1) {
    const offset = partNumber * session.chunkSize;
    await retryPart(`/api/replay-uploads/${session.uploadId}/parts/${partNumber}`, session.uploadToken, file.slice(offset, offset + session.chunkSize));
    onProgress?.(Math.round(((partNumber + 1) / session.expectedParts) * 90));
  }

  if (!await finalizeReplayUpload(session, wait)) throw new Error("Some replay parts are still missing. Retry to reuse every confirmed part.");
  onProgress?.(100);
  return { uploadId: session.uploadId, uploadToken: session.uploadToken, fileSaved: true };
}
