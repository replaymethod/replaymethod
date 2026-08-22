export function blockedRetryDisposition({ retryable, attempts, maxAttempts, now = Date.now(), delayMs = 60_000 }) {
  if (!retryable) {
    return { jobStatus: "blocked", jobStage: "blocked", requestStatus: "blocked", nextRetryAt: null, releaseUsage: true };
  }
  if (attempts < maxAttempts) {
    return {
      jobStatus: "retry",
      jobStage: "blocked",
      requestStatus: "analyzing",
      nextRetryAt: new Date(now + delayMs).toISOString(),
      releaseUsage: true,
    };
  }
  return { jobStatus: "failed", jobStage: "failed", requestStatus: "failed", nextRetryAt: null, releaseUsage: true };
}
