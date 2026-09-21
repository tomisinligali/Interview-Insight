import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { TranscriptRepository } from '@/server/repositories/transcript-repository';
import { createTranscriptSchema } from '@/lib/validation/transcript-schemas';
import { computeExactWordCount, estimateExceedsPreCheckLimit } from '@/lib/transcript/word-count';
import { prisma } from '@/lib/db/prisma';

/**
 * POST /api/transcripts
 * Creates transcript, validates word limits, checks tier quota, increments usage, and enqueues job.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Get user (mock/demo user fallback for initial dev testing)
    const userId = req.headers.get('x-user-id') || 'user_alex_pm';

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized user' }, { status: 401 });
    }

    // 2. Parse request body
    const body = await req.json();
    const validated = createTranscriptSchema.parse(body);

    // 3. Pass 1: Word Count Pre-check (raw string size estimate)
    const stringByteSize = Buffer.byteLength(validated.text, 'utf8');
    if (estimateExceedsPreCheckLimit(stringByteSize)) {
      return NextResponse.json(
        { error: 'Transcript exceeds estimated pre-check word count limit (>75,000 words).' },
        { status: 400 }
      );
    }

    // 4. Pass 2: Authoritative Exact Word Count
    const exactCount = computeExactWordCount(validated.text);
    if (exactCount > 50000) {
      return NextResponse.json(
        {
          error: `Transcript exceeds the maximum 50,000-word limit. Actual count: ${exactCount.toLocaleString()} words.`,
          actualWordCount: exactCount,
          limit: 50000,
        },
        { status: 400 }
      );
    }

    // 5. Transaction Boundary: Creation, Quota Check, Usage Increment & Job Enqueue
    const result = await TranscriptRepository.createWithUsageTransaction({
      userId: user.id,
      title: validated.title,
      interviewDate: validated.interviewDate ? new Date(validated.interviewDate) : null,
      interviewee: validated.interviewee,
      tags: validated.tags,
      sourceType: validated.sourceType,
      extractedText: validated.text,
      wordCount: exactCount,
      userTier: user.subscriptionTier,
    });

    return NextResponse.json({
      success: true,
      transcript: result.transcript,
      job: result.job,
    }, { status: 201 });

  } catch (error: any) {
    if (error.message?.startsWith('USAGE_LIMIT_EXCEEDED')) {
      const parts = error.message.split(':');
      return NextResponse.json(
        {
          error: 'Monthly transcript limit reached. Upgrade to Paid tier for additional processing capacity.',
          used: parseInt(parts[1], 10),
          limit: parseInt(parts[2], 10),
        },
        { status: 403 }
      );
    }

    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }

    console.error('Error in POST /api/transcripts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/transcripts
 * Lists transcripts for the current user.
 */
export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id') || 'user_alex_pm';

    const transcripts = await prisma.transcript.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        interviewDate: true,
        interviewee: true,
        tags: true,
        sourceType: true,
        wordCount: true,
        isNonEnglish: true,
        isLowConfidence: true,
        createdAt: true,
        processingJobs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    return NextResponse.json({ transcripts });
  } catch (error: any) {
    console.error('Error in GET /api/transcripts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
