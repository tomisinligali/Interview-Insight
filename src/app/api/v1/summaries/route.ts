import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';
import { ApiError, toApiError } from '@/lib/api/errors';
import { enforceRateLimit } from '@/lib/api/rate-limit';
import { requireExistingTranscript } from '@/lib/api/references';
import { itemResponse, listResponse, listResult } from '@/lib/api/response';
import { parseBooleanParam, parseOrder, parsePageParams, parseSortField, readJson } from '@/lib/api/request';
import { summaryCreateSchema } from '@/lib/validation/resource-schemas';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/summaries
 * Lists summaries with pagination, filtering (transcriptId, edited)
 * and sorting (id, transcriptId, editedAt).
 */
export async function GET(req: NextRequest) {
  try {
    await enforceRateLimit(req);
    const sp = req.nextUrl.searchParams;
    const { limit, offset } = parsePageParams(sp);
    const sort = parseSortField(sp, ['id', 'transcriptId', 'editedAt'], 'transcriptId');
    const order = parseOrder(sp);

    const where: Prisma.SummaryWhereInput = {};
    const transcriptId = sp.get('transcriptId');
    if (transcriptId) where.transcriptId = transcriptId;
    const edited = parseBooleanParam(sp, 'edited');
    if (edited !== undefined) where.editedAt = edited ? { not: null } : null;

    const { data, meta } = await listResult({
      findMany: () =>
        prisma.summary.findMany({
          where,
          orderBy: { [sort]: order } as Prisma.SummaryOrderByWithRelationInput,
          take: limit,
          skip: offset,
        }),
      count: () => prisma.summary.count({ where }),
      limit,
      offset,
    });

    return listResponse(data, meta);
  } catch (error) {
    return toApiError(error);
  }
}

/**
 * POST /api/v1/summaries
 * Creates a summary for a transcript without one (1:1 constraint). A second
 * summary for the same transcript conflicts (409).
 */
export async function POST(req: NextRequest) {
  try {
    await enforceRateLimit(req);
    const body = await readJson(req);
    const input = summaryCreateSchema.parse(body);

    await requireExistingTranscript(input.transcriptId);

    const existing = await prisma.summary.findUnique({
      where: { transcriptId: input.transcriptId },
      select: { id: true },
    });
    if (existing) {
      throw new ApiError(409, 'CONFLICT', 'A summary already exists for this transcript.');
    }

    const summary = await prisma.summary.create({ data: input });

    return itemResponse(summary, 201);
  } catch (error) {
    return toApiError(error);
  }
}