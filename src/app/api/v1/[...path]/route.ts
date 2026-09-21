import { NextRequest } from 'next/server';

import { errorResponse } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

/**
 * Catch-all for unrecognized /api/v1/* paths so they return the standard
 * JSON error envelope instead of Next.js's HTML 404 page.
 */
export async function GET(_req: NextRequest) {
  return errorResponse(404, 'NOT_FOUND', 'Resource not found.');
}

export async function POST(_req: NextRequest) {
  return errorResponse(404, 'NOT_FOUND', 'Resource not found.');
}

export async function PATCH(_req: NextRequest) {
  return errorResponse(404, 'NOT_FOUND', 'Resource not found.');
}

export async function DELETE(_req: NextRequest) {
  return errorResponse(404, 'NOT_FOUND', 'Resource not found.');
}