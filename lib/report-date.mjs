/**
 * ReportClient appends `Z` to legacy SQLite timestamps. Normalize timestamps
 * that already carry a zone so both legacy rows and ISO parser metadata remain
 * valid UTC input without changing the frozen report presentation contract.
 */
export function legacyUtcTimestamp(value) {
  if (typeof value !== "string") return value ?? null;
  const raw = value.trim();
  if (!raw || !/(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(raw)) return raw;
  const parsed = new Date(raw);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString().slice(0, -1) : raw.replace(/[zZ]$/, "");
}
