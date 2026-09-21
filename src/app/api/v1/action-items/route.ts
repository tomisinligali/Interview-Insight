import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';
import { toApiError } from '@/lib/api/errors';
import { enforceRateLimit } from '@/lib/api/rate-limit';
import { requireExistingTheme, requireExistingTranscript } from '@/lib/api/references';
import { itemResponse, listResponse, listResult } from '@/lib/api/response';
import { parseOrder, parsePageParams, parseSortField, readJson } from '@/lib/api/request';
import { actionItemCreateSchema } from '@/lib/validation/resource-schemas';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/action-items
 * Lists action items with pagination, filtering (transcriptId, themeId)
 * and sorting (description, createdAt, editedAt).
 */
export async function GET(req: NextRequest) {
  try {
    await enforceRateLimit(req);
    const sp = req.nextUrl.searchParams;
    const { limit, offset } = parsePageParams(sp);
    const sort = parseSortField(sp, ['description', 'createdAt', 'editedAt'], 'createdAt');
    const order = parseOrder(sp);

    const where: Prisma.ActionItemWhereInput = {};
    const transcriptId = sp.get('transcriptId');
    if (transcriptId) where.transcriptId = transcriptId;
    const themeId = sp.get('themeId');
    if (themeId) where.themeId = themeId;

    const { data, meta } = await listResult({
      findMany: () =>
        prisma.actionItem.findMany({
          where,
          orderBy: { [sort]: order } as Prisma.ActionItemOrderByWithRelationInput,
          take: limit,
          skip: offset,
        }),
      count: () => prisma.actionItem.count({ where }),
      limit,
      offset,
    });

    return listResponse(data, meta);
  } catch (error) {
    return toApiError(error);
  }
}

/**
 * POST /api/v1/action-items
 * Creates an action item linked to a transcript (themeId optional).
 */
export async function POST(req: NextRequest) {
  try {
    await enforceRateLimit(req);
    const body = await readJson(req);
    const input = actionItemCreateSchema.parse(body);

    await requireExistingTranscript(input.transcriptId);
    if (input.themeId) await requireExistingTheme(input.themeId);

    const actionItem = await prisma.actionItem.create({ data: input });

    return itemResponse(actionItem, 201);
  } catch (error) {
    return toApiError(error);
  }
}