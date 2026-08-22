export async function reserveExistingAnalysisUsage(database, analysisRequestId) {
  const current = await database.prepare("SELECT status FROM analysis_usage WHERE analysis_request_id = ?")
    .bind(analysisRequestId).first();
  if (current?.status === "reserved") return true;
  if (current?.status !== "released") return false;
  try {
    const result = await database.prepare(`UPDATE analysis_usage SET status = 'reserved', released_at = NULL,
      updated_at = CURRENT_TIMESTAMP WHERE analysis_request_id = ? AND status = 'released'`)
      .bind(analysisRequestId).run();
    return Boolean(result.meta.changes);
  } catch {
    // The partial unique slot index is the concurrency authority. Another
    // analysis may have legitimately occupied the released allowance.
    return false;
  }
}

export async function releaseExistingAnalysisUsage(database, analysisRequestId) {
  await database.prepare(`UPDATE analysis_usage SET status = 'released', released_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP WHERE analysis_request_id = ? AND status = 'reserved'`)
    .bind(analysisRequestId).run();
}
