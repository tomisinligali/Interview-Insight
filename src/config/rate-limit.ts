/**
 * Rate-limiting configuration for the public, unauthenticated /api/v1 API.
 * Tuned for a single-instance deployment. Values live here, never in handlers.
 */
export const RATE_LIMIT = {
  /** Number of requests an IP may issue per window before being throttled. */
  maxRequests: 100,
  /** Length of the sliding window in milliseconds (1 minute). */
  windowMs: 60_000,
} as const;