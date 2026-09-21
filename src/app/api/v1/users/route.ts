import { NextRequest } from 'next/server';
import { Prisma, SubscriptionTier } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';
import { toApiError } from '@/lib/api/errors';
import { requireExistingOrganization } from '@/lib/api/references';
import { userPublicSelect } from '@/lib/api/projections';
import { itemResponse, listResponse, listResult } from '@/lib/api/response';
import { parseEnumParam, parseOrder, parsePageParams, parseSortField, readJson } from '@/lib/api/request';
import { userCreateSchema } from '@/lib/validation/resource-schemas';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/users
 * Lists users with pagination, filtering (email, subscriptionTier, organizationId)
 * and sorting (email, createdAt, subscriptionTier). Soft-deleted accounts are
 * excluded and password hashes are never returned.
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const { limit, offset } = parsePageParams(sp);
    const sort = parseSortField(sp, ['email', 'createdAt', 'subscriptionTier'], 'createdAt');
    const order = parseOrder(sp);

    const subscriptionTier = parseEnumParam(sp, 'subscriptionTier', Object.values(SubscriptionTier));

    const where: Prisma.UserWhereInput = { deletedAt: null };
    const email = sp.get('email');
    if (email) where.email = { contains: email, mode: 'insensitive' };
    const organizationId = sp.get('organizationId');
    if (organizationId) where.organizationId = organizationId;
    if (subscriptionTier) where.subscriptionTier = subscriptionTier as SubscriptionTier;

    const { data, meta } = await listResult({
      findMany: () =>
        prisma.user.findMany({
          where,
          select: userPublicSelect,
          orderBy: { [sort]: order } as Prisma.UserOrderByWithRelationInput,
          take: limit,
          skip: offset,
        }),
      count: () => prisma.user.count({ where }),
      limit,
      offset,
    });

    return listResponse(data, meta);
  } catch (error) {
    return toApiError(error);
  }
}

/**
 * POST /api/v1/users
 * Creates a user account (passwordHash is stored, never echoed back).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await readJson(req);
    const input = userCreateSchema.parse(body);

    if (input.organizationId) await requireExistingOrganization(input.organizationId);

    const user = await prisma.user.create({
      data: input,
      select: userPublicSelect,
    });

    return itemResponse(user, 201);
  } catch (error) {
    return toApiError(error);
  }
}