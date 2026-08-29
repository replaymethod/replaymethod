import { createHash } from "node:crypto";

export const LABEL_MANUAL_SEPARATOR = "\n\n---\n\n";

export function combineLabelManuals(parts) {
  if (!Array.isArray(parts) || !parts.length) {
    throw new Error("At least one label-manual part is required.");
  }
  const normalized = parts.map((part) => String(part ?? "").trim());
  if (normalized.some((part) => !part)) {
    throw new Error("Label-manual parts must be non-empty.");
  }
  const handbook = normalized.join(LABEL_MANUAL_SEPARATOR);
  return {
    handbook,
    fingerprint: createHash("sha256").update(handbook).digest("hex"),
    partFingerprints: normalized.map((part) => createHash("sha256").update(part).digest("hex")),
  };
}
