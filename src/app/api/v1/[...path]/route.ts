import { NextRequest } from 'next/server';

import { errorResponse, toApiError } from '@/lib/api/errors';
import { enforceRateLimit } from '@/lib/api/rate-limit';

export const dynamic = 'force-dynamic';

async function notFound(req: NextRequest) {
  try {
    await enforceRateLimit(req);
  } catch (error) {
    return toApiError(error);
  }
  return errorResponse(404, 'NOT_FOUND', 'Resource not found.');
}

/**
 * Catch-all for unrecognized /api/v1/* paths so they return the standard
 * JSON error envelope instead of Next.js's HTML 404 page.
 */
export async function GET(req: NextRequest) {
  return notFound(req);
}

export async function POST(req: NextRequest) {
  return notFound(req);
}

export async function PATCH(req: NextRequest) {
  return notFound(req);
}

export async function DELETE(req: NextRequest) {
  return notFound(req);
}