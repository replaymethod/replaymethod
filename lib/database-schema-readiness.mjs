// A single read-only compile check keeps warm production requests off the
// expensive compatibility bootstrap. Missing tables or columns make D1 reject
// this statement, at which point db/index.ts runs the full guarded bootstrap.
export const CURRENT_PRODUCT_SCHEMA_CHECK = `SELECT
  (SELECT platform FROM analysis_requests LIMIT 1) AS analysis_platform,
  (SELECT reporting_scope FROM analysis_requests LIMIT 1) AS analysis_reporting_scope,
  (SELECT calibration_opt_in FROM analysis_requests LIMIT 1) AS analysis_calibration_opt_in,
  (SELECT detector_id FROM analysis_findings LIMIT 1) AS finding_detector_id,
  (SELECT detector_id FROM player_focuses LIMIT 1) AS focus_detector_id,
  (SELECT baseline_analysis_request_id FROM player_focuses LIMIT 1) AS focus_baseline_id,
  (SELECT latest_analysis_request_id FROM player_focuses LIMIT 1) AS focus_latest_id,
  (SELECT metric_key FROM player_focuses LIMIT 1) AS focus_metric_key,
  (SELECT completion_reason FROM player_focuses LIMIT 1) AS focus_completion_reason,
  (SELECT moment_object_key FROM rl_review_candidates LIMIT 1) AS review_moment_key,
  (SELECT review_set_id FROM rl_review_candidates LIMIT 1) AS review_set_id,
  (SELECT active FROM rl_review_candidates LIMIT 1) AS review_active,
  (SELECT detector_set_version FROM rl_beta_submissions LIMIT 1) AS beta_detector_set,
  (SELECT rights_confirmed_at FROM rl_beta_submissions LIMIT 1) AS beta_rights_confirmed,
  (SELECT reviewer_qualification FROM rl_review_labels LIMIT 1) AS label_reviewer_qualification,
  (SELECT coaching_relevance FROM rl_review_labels LIMIT 1) AS label_coaching_relevance,
  (SELECT playlist_qualifications_json FROM rl_reviewers LIMIT 1) AS reviewer_playlists,
  (SELECT qualification_notes FROM rl_reviewers LIMIT 1) AS reviewer_notes,
  (SELECT public_id FROM player_focus_evaluations LIMIT 1) AS focus_evaluation_public_id,
  (SELECT mode FROM rl_capabilities LIMIT 1) AS capability_mode`;

export async function hasCurrentProductSchema(database) {
  try {
    await database.prepare(CURRENT_PRODUCT_SCHEMA_CHECK).all();
    return true;
  } catch {
    return false;
  }
}
