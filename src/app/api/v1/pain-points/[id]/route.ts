import { NextRequest } from 'next/server';

import { prisma } from '@/lib/db/prisma';
import { ApiError, toApiError } from '@/lib/api/errors';
import { enforceRateLimit } from '@/lib/api/rate-limit';
import { requireExistingTheme } from '@/lib/api/references';
import { itemResponse } from '@/lib/api/response';
import { readJson } from '@/lib/api/request';
import { painPointUpdateSchema } from '@/lib/validation/resource-schemas';

export const dynamic = 'force-dynamic';

async function requirePainPoint(id: string) {
  const painPoint = await prisma.painPoint.findUnique({ where: { id } });
  if (!painPoint) {
    throw new ApiError(404, 'NOT_FOUND', 'Pain point not found.');
  }
  return painPoint;
}

/**
 * GET /api/v1/pain-points/:id
 * Retrieves a single pain point.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await enforceRateLimit(_req);
    const painPoint = await requirePainPoint(params.id);
    return itemResponse(painPoint);
  } catch (error) {
    return toApiError(error);
  }
}

/**
 * PATCH /api/v1/pain-points/:id
 * Partially updates the pain point (themeId is editable) and stamps editedAt.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await enforceRateLimit(req);
    const existing = await requirePainPoint(params.id);

    const body = await readJson(req);
    const input = painPointUpdateSchema.parse(body);

    if (input.themeId !== undefined && input.themeId !== null) {
      await requireExistingTheme(input.themeId);
    }

    const painPoint = await prisma.painPoint.update({
      where: { id: existing.id },
      data: { ...input, editedAt: new Date() },
    });

    return itemResponse(painPoint);
  } catch (error) {
    return toApiError(error);
  }
}

/**
 * DELETE /api/v1/pain-points/:id
 * Removes the pain point.
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await enforceRateLimit(_req);
    const existing = await requirePainPoint(params.id);

    await prisma.painPoint.delete({ where: { id: existing.id } });

    return itemResponse({ id: existing.id, deleted: true });
  } catch (error) {
    return toApiError(error);
  }
}