import { NextRequest } from 'next/server';

import { RATE_LIMIT } from '@/config/rate-limit';

import { ApiError } from './errors';

export const RATE_LIMIT_ERROR_CODE = 'RATE_LIMIT_EXCEEDED';

/**
 * Sliding-window counter of the timestamps at which each client recently made
 * a request. Keyed by client IP. In-memory: exact for a single instance; a
 * multi-instance deployment would need a shared store (see README note).
 */
const buckets = new Map<string, number[]>();

/** Resets all buckets. Intended for tests and local diagnostics. */
export function resetRateLimitStore(): void {
  buckets.clear();
}

/**
 * Best-effort client IP extraction: honors the proxy-forwarded headers us apps
 * sit behind before falling back to a shared "unknown" bucket.
 */
function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }
  const vercel = req.headers.get('x-vercel-forwarded-for');
  if (vercel) {
    const first = vercel.split(',')[0].trim();
    if (first) return first;
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp;
  return 'unknown';
}

/**
 * Enforces the per-IP rate limit for a request. When the limit is exceeded it
 * throws a 429 `ApiError` carrying a `Retry-After` header (integer seconds),
 * so route handlers' existing `toApiError` path keeps the envelope consistent.
 */
export async function enforceRateLimit(req: NextRequest): Promise<void> {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT.windowMs;
  const ip = clientIp(req);

  const recent = (buckets.get(ip) ?? []).filter((t) => t >= windowStart);

  if (recent.length >= RATE_LIMIT.maxRequests) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((recent[0] + RATE_LIMIT.windowMs - now) / 1000)
    );
    throw new ApiError(
      429,
      RATE_LIMIT_ERROR_CODE,
      `Too many requests. Try again in ${retryAfterSec} second${retryAfterSec === 1 ? '' : 's'}.`,
      { 'Retry-After': String(retryAfterSec) }
    );
  }

  recent.push(now);
  buckets.set(ip, recent);
}