import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';
import { ApiError, toApiError } from '@/lib/api/errors';
import { itemResponse } from '@/lib/api/response';
import { readJson } from '@/lib/api/request';
import { MAX_TRANSCRIPT_WORDS, transcriptUpdateSchema } from '@/lib/validation/resource-schemas';
import { computeExactWordCount } from '@/lib/transcript/word-count';

export const dynamic = 'force-dynamic';

/** Finds a live (non-soft-deleted) transcript by id or throws 404. */
async function requireTranscript(id: string) {
  const transcript = await prisma.transcript.findFirst({
    where: { id, deletedAt: null },
  });
  if (!transcript) {
    throw new ApiError(404, 'NOT_FOUND', 'Transcript not found.');
  }
  return transcript;
}

/**
 * GET /api/v1/transcripts/:id
 * Retrieves a single transcript.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const transcript = await requireTranscript(params.id);
    return itemResponse(transcript);
  } catch (error) {
    return toApiError(error);
  }
}

/**
 * PATCH /api/v1/transcripts/:id
 * Partially updates editable transcript fields. When extractedText changes,
 * the authoritative word count is recomputed; over-limit text is rejected.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const existing = await requireTranscript(params.id);

    const body = await readJson(req);
    const input = transcriptUpdateSchema.parse(body);

    if (Object.keys(input).length === 0) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'At least one field is required.');
    }

    const data: Prisma.TranscriptUpdateInput = { ...input };
    if (input.extractedText !== undefined) {
      const wordCount = computeExactWordCount(input.extractedText);
      if (wordCount > MAX_TRANSCRIPT_WORDS) {
        throw new ApiError(
          422,
          'VALIDATION_ERROR',
          `Transcript exceeds the 50,000-word limit (actual count: ${wordCount.toLocaleString()} words).`
        );
      }
      data.wordCount = wordCount;
    }

    const transcript = await prisma.transcript.update({
      where: { id: existing.id },
      data,
    });

    return itemResponse(transcript);
  } catch (error) {
    return toApiError(error);
  }
}

/**
 * DELETE /api/v1/transcripts/:id
 * Soft-deletes a transcript (sets deletedAt). Cascading hard deletion of
 * children and S3 cleanup are handled by the authenticated app flow.
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const existing = await prisma.transcript.findUnique({
      where: { id: params.id },
      select: { id: true },
    });
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Transcript not found.');
    }

    await prisma.transcript.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });

    return itemResponse({ id: existing.id, deleted: true });
  } catch (error) {
    return toApiError(error);
  }
}