import { NextRequest } from 'next/server';

import { prisma } from '@/lib/db/prisma';
import { ApiError, toApiError } from '@/lib/api/errors';
import { enforceRateLimit } from '@/lib/api/rate-limit';
import { itemResponse } from '@/lib/api/response';
import { readJson } from '@/lib/api/request';
import { themeUpdateSchema } from '@/lib/validation/resource-schemas';

export const dynamic = 'force-dynamic';

async function requireTheme(id: string) {
  const theme = await prisma.theme.findUnique({ where: { id } });
  if (!theme) {
    throw new ApiError(404, 'NOT_FOUND', 'Theme not found.');
  }
  return theme;
}

/**
 * GET /api/v1/themes/:id
 * Retrieves a single theme.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await enforceRateLimit(_req);
    const theme = await requireTheme(params.id);
    return itemResponse(theme);
  } catch (error) {
    return toApiError(error);
  }
}

/**
 * PATCH /api/v1/themes/:id
 * Partially updates the theme and stamps editedAt.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await enforceRateLimit(req);
    const existing = await requireTheme(params.id);

    const body = await readJson(req);
    const input = themeUpdateSchema.parse(body);

    const theme = await prisma.theme.update({
      where: { id: existing.id },
      data: { ...input, editedAt: new Date() },
    });

    return itemResponse(theme);
  } catch (error) {
    return toApiError(error);
  }
}

/**
 * DELETE /api/v1/themes/:id
 * Removes the theme; linked insights keep existing via onDelete: SetNull.
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await enforceRateLimit(_req);
    const existing = await requireTheme(params.id);

    await prisma.theme.delete({ where: { id: existing.id } });

    return itemResponse({ id: existing.id, deleted: true });
  } catch (error) {
    return toApiError(error);
  }
}