import { NextRequest } from 'next/server';
import { Prisma, Sentiment } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';
import { toApiError } from '@/lib/api/errors';
import { requireExistingTranscript } from '@/lib/api/references';
import { itemResponse, listResponse, listResult } from '@/lib/api/response';
import { parseEnumParam, parseOrder, parsePageParams, parseSortField, readJson } from '@/lib/api/request';
import { themeCreateSchema } from '@/lib/validation/resource-schemas';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/themes
 * Lists themes with pagination, filtering (transcriptId, sentiment)
 * and sorting (title, sentiment, createdAt, editedAt).
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const { limit, offset } = parsePageParams(sp);
    const sort = parseSortField(sp, ['title', 'sentiment', 'createdAt', 'editedAt'], 'createdAt');
    const order = parseOrder(sp);

    const sentiment = parseEnumParam(sp, 'sentiment', Object.values(Sentiment));

    const where: Prisma.ThemeWhereInput = {};
    const transcriptId = sp.get('transcriptId');
    if (transcriptId) where.transcriptId = transcriptId;
    if (sentiment) where.sentiment = sentiment as Sentiment;

    const { data, meta } = await listResult({
      findMany: () =>
        prisma.theme.findMany({
          where,
          orderBy: { [sort]: order } as Prisma.ThemeOrderByWithRelationInput,
          take: limit,
          skip: offset,
        }),
      count: () => prisma.theme.count({ where }),
      limit,
      offset,
    });

    return listResponse(data, meta);
  } catch (error) {
    return toApiError(error);
  }
}

/**
 * POST /api/v1/themes
 * Creates a theme for a transcript.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await readJson(req);
    const input = themeCreateSchema.parse(body);

    await requireExistingTranscript(input.transcriptId);

    const theme = await prisma.theme.create({ data: input });

    return itemResponse(theme, 201);
  } catch (error) {
    return toApiError(error);
  }
}