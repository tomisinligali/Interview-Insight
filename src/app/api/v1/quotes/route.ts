import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';
import { ApiError, toApiError } from '@/lib/api/errors';
import { enforceRateLimit } from '@/lib/api/rate-limit';
import { requireExistingTheme, requireExistingTranscript } from '@/lib/api/references';
import { itemResponse, listResponse, listResult } from '@/lib/api/response';
import { parseEnumParam, parseOrder, parsePageParams, parseSortField, readJson } from '@/lib/api/request';
import { MAX_QUOTE_WORDS, quoteCreateSchema } from '@/lib/validation/resource-schemas';
import { computeExactWordCount } from '@/lib/transcript/word-count';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/quotes
 * Lists quotes with pagination, filtering (transcriptId, themeId, speakerLabel)
 * and sorting (text, wasTruncated, createdAt, editedAt).
 */
export async function GET(req: NextRequest) {
  try {
    await enforceRateLimit(req);
    const sp = req.nextUrl.searchParams;
    const { limit, offset } = parsePageParams(sp);
    const sort = parseSortField(sp, ['text', 'wasTruncated', 'createdAt', 'editedAt'], 'createdAt');
    const order = parseOrder(sp);

    const speakerLabel = parseEnumParam(sp, 'speakerLabel', ['SPEAKER_01', 'SPEAKER_02']);

    const where: Prisma.QuoteWhereInput = {};
    const transcriptId = sp.get('transcriptId');
    if (transcriptId) where.transcriptId = transcriptId;
    const themeId = sp.get('themeId');
    if (themeId) where.themeId = themeId;
    if (speakerLabel) where.speakerLabel = speakerLabel;

    const { data, meta } = await listResult({
      findMany: () =>
        prisma.quote.findMany({
          where,
          orderBy: { [sort]: order } as Prisma.QuoteOrderByWithRelationInput,
          take: limit,
          skip: offset,
        }),
      count: () => prisma.quote.count({ where }),
      limit,
      offset,
    });

    return listResponse(data, meta);
  } catch (error) {
    return toApiError(error);
  }
}

/**
 * POST /api/v1/quotes
 * Creates a quote. Verbatim-excerpt text is capped at 50 words (FR-15).
 */
export async function POST(req: NextRequest) {
  try {
    await enforceRateLimit(req);
    const body = await readJson(req);
    const input = quoteCreateSchema.parse(body);

    const wordCount = computeExactWordCount(input.text);
    if (wordCount > MAX_QUOTE_WORDS) {
      throw new ApiError(
        422,
        'VALIDATION_ERROR',
        `Quote text cannot exceed 50 words (current count: ${wordCount} words).`
      );
    }

    await requireExistingTranscript(input.transcriptId);
    if (input.themeId) await requireExistingTheme(input.themeId);

    const quote = await prisma.quote.create({ data: input });

    return itemResponse(quote, 201);
  } catch (error) {
    return toApiError(error);
  }
}