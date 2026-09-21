import { NextRequest } from 'next/server';
import { Prisma, Severity } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';
import { toApiError } from '@/lib/api/errors';
import { requireExistingTheme, requireExistingTranscript } from '@/lib/api/references';
import { itemResponse, listResponse, listResult } from '@/lib/api/response';
import { parseEnumParam, parseOrder, parsePageParams, parseSortField, readJson } from '@/lib/api/request';
import { painPointCreateSchema } from '@/lib/validation/resource-schemas';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/pain-points
 * Lists pain points with pagination, filtering (transcriptId, themeId, severity)
 * and sorting (title, severity, createdAt, editedAt).
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const { limit, offset } = parsePageParams(sp);
    const sort = parseSortField(sp, ['title', 'severity', 'createdAt', 'editedAt'], 'createdAt');
    const order = parseOrder(sp);

    const severity = parseEnumParam(sp, 'severity', Object.values(Severity));

    const where: Prisma.PainPointWhereInput = {};
    const transcriptId = sp.get('transcriptId');
    if (transcriptId) where.transcriptId = transcriptId;
    const themeId = sp.get('themeId');
    if (themeId) where.themeId = themeId;
    if (severity) where.severity = severity as Severity;

    const { data, meta } = await listResult({
      findMany: () =>
        prisma.painPoint.findMany({
          where,
          orderBy: { [sort]: order } as Prisma.PainPointOrderByWithRelationInput,
          take: limit,
          skip: offset,
        }),
      count: () => prisma.painPoint.count({ where }),
      limit,
      offset,
    });

    return listResponse(data, meta);
  } catch (error) {
    return toApiError(error);
  }
}

/**
 * POST /api/v1/pain-points
 * Creates a pain point linked to a transcript (themeId optional).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await readJson(req);
    const input = painPointCreateSchema.parse(body);

    await requireExistingTranscript(input.transcriptId);
    if (input.themeId) await requireExistingTheme(input.themeId);

    const painPoint = await prisma.painPoint.create({ data: input });

    return itemResponse(painPoint, 201);
  } catch (error) {
    return toApiError(error);
  }
}