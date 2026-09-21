import { NextRequest } from 'next/server';

import { prisma } from '@/lib/db/prisma';
import { ApiError, toApiError } from '@/lib/api/errors';
import { enforceRateLimit } from '@/lib/api/rate-limit';
import { itemResponse } from '@/lib/api/response';
import { readJson } from '@/lib/api/request';
import { summaryUpdateSchema } from '@/lib/validation/resource-schemas';

export const dynamic = 'force-dynamic';

async function requireSummary(id: string) {
  const summary = await prisma.summary.findUnique({ where: { id } });
  if (!summary) {
    throw new ApiError(404, 'NOT_FOUND', 'Summary not found.');
  }
  return summary;
}

/**
 * GET /api/v1/summaries/:id
 * Retrieves a single summary.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await enforceRateLimit(_req);
    const summary = await requireSummary(params.id);
    return itemResponse(summary);
  } catch (error) {
    return toApiError(error);
  }
}

/**
 * PATCH /api/v1/summaries/:id
 * Edits the summary body and stamps editedAt.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await enforceRateLimit(req);
    const existing = await requireSummary(params.id);

    const body = await readJson(req);
    const input = summaryUpdateSchema.parse(body);

    const summary = await prisma.summary.update({
      where: { id: existing.id },
      data: { ...input, editedAt: new Date() },
    });

    return itemResponse(summary);
  } catch (error) {
    return toApiError(error);
  }
}

/**
 * DELETE /api/v1/summaries/:id
 * Removes the summary (transcripts are optional to have one).
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await enforceRateLimit(_req);
    const existing = await requireSummary(params.id);

    await prisma.summary.delete({ where: { id: existing.id } });

    return itemResponse({ id: existing.id, deleted: true });
  } catch (error) {
    return toApiError(error);
  }
}