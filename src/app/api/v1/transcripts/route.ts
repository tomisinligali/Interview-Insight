import { NextRequest } from 'next/server';
import { Prisma, TranscriptSourceType } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';
import { ApiError, toApiError } from '@/lib/api/errors';
import { itemResponse, listResponse, listResult } from '@/lib/api/response';
import { parseEnumParam, parseOrder, parsePageParams, parseSortField, readJson } from '@/lib/api/request';
import { transcriptCreateSchema, MAX_TRANSCRIPT_WORDS } from '@/lib/validation/resource-schemas';
import { computeExactWordCount } from '@/lib/transcript/word-count';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/transcripts
 * Lists transcripts with pagination, filtering (userId, sourceType, title)
 * and sorting (title, createdAt, interviewDate, wordCount).
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const { limit, offset } = parsePageParams(sp);
    const sort = parseSortField(sp, ['title', 'createdAt', 'interviewDate', 'wordCount'], 'createdAt');
    const order = parseOrder(sp);

    const sourceType = parseEnumParam(sp, 'sourceType', Object.values(TranscriptSourceType));

    const where: Prisma.TranscriptWhereInput = { deletedAt: null };
    const userId = sp.get('userId');
    if (userId) where.userId = userId;
    const title = sp.get('title');
    if (title) where.title = { contains: title, mode: 'insensitive' };
    if (sourceType) where.sourceType = sourceType as TranscriptSourceType;

    const { data, meta } = await listResult({
      findMany: () =>
        prisma.transcript.findMany({
          where,
          orderBy: { [sort]: order } as Prisma.TranscriptOrderByWithRelationInput,
          take: limit,
          skip: offset,
        }),
      count: () => prisma.transcript.count({ where }),
      limit,
      offset,
    });

    return listResponse(data, meta);
  } catch (error) {
    return toApiError(error);
  }
}

/**
 * POST /api/v1/transcripts
 * Creates a transcript, computing the authoritative word count server-side.
 * (The full creation pipeline — usage cap, usage increment, async AI job —
 * belongs to the authenticated app flow POST /api/transcripts.)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await readJson(req);
    const input = transcriptCreateSchema.parse(body);

    const wordCount = computeExactWordCount(input.extractedText);
    if (wordCount > MAX_TRANSCRIPT_WORDS) {
      throw new ApiError(
        422,
        'VALIDATION_ERROR',
        `Transcript exceeds the 50,000-word limit (actual count: ${wordCount.toLocaleString()} words).`
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true },
    });
    if (!user) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'userId does not reference an existing user.');
    }

    const transcript = await prisma.transcript.create({
      data: { ...input, wordCount },
    });

    return itemResponse(transcript, 201);
  } catch (error) {
    return toApiError(error);
  }
}