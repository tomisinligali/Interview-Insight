import { NextRequest } from 'next/server';

import { prisma } from '@/lib/db/prisma';
import { ApiError, toApiError } from '@/lib/api/errors';
import { enforceRateLimit } from '@/lib/api/rate-limit';
import { requireExistingOrganization } from '@/lib/api/references';
import { itemResponse } from '@/lib/api/response';
import { readJson } from '@/lib/api/request';
import { userUpdateSchema } from '@/lib/validation/resource-schemas';
import { userPublicSelect } from '@/lib/api/projections';

export const dynamic = 'force-dynamic';

async function requireUser(id: string) {
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: userPublicSelect,
  });
  if (!user) {
    throw new ApiError(404, 'NOT_FOUND', 'User not found.');
  }
  return user;
}

/**
 * GET /api/v1/users/:id
 * Retrieves a single user (password hash excluded).
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await enforceRateLimit(_req);
    const user = await requireUser(params.id);
    return itemResponse(user);
  } catch (error) {
    return toApiError(error);
  }
}

/**
 * PATCH /api/v1/users/:id
 * Partially updates user fields. Unique conflicts (email, googleId,
 * stripeCustomerId) map to 409.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await enforceRateLimit(req);
    await requireUser(params.id);

    const body = await readJson(req);
    const input = userUpdateSchema.parse(body);

    if (Object.keys(input).length === 0) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'At least one field is required.');
    }
    if (input.organizationId) await requireExistingOrganization(input.organizationId);

    const user = await prisma.user.update({
      where: { id: params.id },
      data: input,
      select: userPublicSelect,
    });

    return itemResponse(user);
  } catch (error) {
    return toApiError(error);
  }
}

/**
 * DELETE /api/v1/users/:id
 * Soft-deletes the account (sets deletedAt); records remain for compliance.
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await enforceRateLimit(_req);
    const existing = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true },
    });
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'User not found.');
    }

    await prisma.user.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });

    return itemResponse({ id: existing.id, deleted: true });
  } catch (error) {
    return toApiError(error);
  }
}