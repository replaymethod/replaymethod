export const REPLAY_UPLOAD_RECOVERY_KEY = "replaymethod-replay-upload-recovery-v1";

function validRecovery(value) {
  return Boolean(value
    && value.version === 1
    && typeof value.uploadId === "string"
    && /^[a-f0-9]{32}$/.test(value.uploadId)
    && typeof value.uploadToken === "string"
    && value.uploadToken.length >= 32
    && Number.isSafeInteger(value.chunkSize)
    && value.chunkSize > 0
    && Number.isSafeInteger(value.expectedParts)
    && value.expectedParts > 0
    && typeof value.expiresAt === "string"
    && Number.isFinite(new Date(value.expiresAt).getTime())
    && typeof value.fileName === "string"
    && Number.isSafeInteger(value.fileSize)
    && value.fileSize > 0
    && Number.isSafeInteger(value.fileLastModified)
    && typeof value.email === "string");
}

export function replayRecoveryStorageAvailable(storage) {
  try {
    const probe = `${REPLAY_UPLOAD_RECOVERY_KEY}-probe`;
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export function saveReplayUploadRecovery(storage, recovery) {
  if (!validRecovery(recovery)) return false;
  try {
    storage.setItem(REPLAY_UPLOAD_RECOVERY_KEY, JSON.stringify(recovery));
    return true;
  } catch {
    return false;
  }
}

export function loadReplayUploadRecovery(storage, file, email, now = Date.now()) {
  try {
    const raw = storage.getItem(REPLAY_UPLOAD_RECOVERY_KEY);
    if (!raw) return null;
    const recovery = JSON.parse(raw);
    if (!validRecovery(recovery) || new Date(recovery.expiresAt).getTime() <= now) {
      storage.removeItem(REPLAY_UPLOAD_RECOVERY_KEY);
      return null;
    }
    const matches = recovery.fileName === file.name
      && recovery.fileSize === file.size
      && recovery.fileLastModified === file.lastModified
      && recovery.email === email.trim().toLowerCase();
    return matches ? recovery : null;
  } catch {
    try { storage.removeItem(REPLAY_UPLOAD_RECOVERY_KEY); } catch { /* storage remains unavailable */ }
    return null;
  }
}

export function clearReplayUploadRecovery(storage, uploadId) {
  try {
    const raw = storage.getItem(REPLAY_UPLOAD_RECOVERY_KEY);
    if (!raw) return;
    const recovery = JSON.parse(raw);
    if (!uploadId || recovery?.uploadId === uploadId) storage.removeItem(REPLAY_UPLOAD_RECOVERY_KEY);
  } catch {
    try { storage.removeItem(REPLAY_UPLOAD_RECOVERY_KEY); } catch { /* storage remains unavailable */ }
  }
}
