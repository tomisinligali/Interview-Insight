import { NextRequest } from 'next/server';

import { prisma } from '@/lib/db/prisma';
import { ApiError, toApiError } from '@/lib/api/errors';
import { enforceRateLimit } from '@/lib/api/rate-limit';
import { requireExistingTheme } from '@/lib/api/references';
import { itemResponse } from '@/lib/api/response';
import { readJson } from '@/lib/api/request';
import { actionItemUpdateSchema } from '@/lib/validation/resource-schemas';

export const dynamic = 'force-dynamic';

async function requireActionItem(id: string) {
  const actionItem = await prisma.actionItem.findUnique({ where: { id } });
  if (!actionItem) {
    throw new ApiError(404, 'NOT_FOUND', 'Action item not found.');
  }
  return actionItem;
}

/**
 * GET /api/v1/action-items/:id
 * Retrieves a single action item.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await enforceRateLimit(_req);
    const actionItem = await requireActionItem(params.id);
    return itemResponse(actionItem);
  } catch (error) {
    return toApiError(error);
  }
}

/**
 * PATCH /api/v1/action-items/:id
 * Updates the action item (themeId is editable) and stamps editedAt.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await enforceRateLimit(req);
    const existing = await requireActionItem(params.id);

    const body = await readJson(req);
    const input = actionItemUpdateSchema.parse(body);

    if (input.themeId !== undefined && input.themeId !== null) {
      await requireExistingTheme(input.themeId);
    }

    const actionItem = await prisma.actionItem.update({
      where: { id: existing.id },
      data: { ...input, editedAt: new Date() },
    });

    return itemResponse(actionItem);
  } catch (error) {
    return toApiError(error);
  }
}

/**
 * DELETE /api/v1/action-items/:id
 * Removes the action item.
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await enforceRateLimit(_req);
    const existing = await requireActionItem(params.id);

    await prisma.actionItem.delete({ where: { id: existing.id } });

    return itemResponse({ id: existing.id, deleted: true });
  } catch (error) {
    return toApiError(error);
  }
}