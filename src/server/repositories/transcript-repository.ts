import { prisma } from '@/lib/db/prisma';
import { TranscriptSourceType, JobStatus, SubscriptionTier } from '@prisma/client';

export class TranscriptRepository {
  /**
   * Performs the atomic creation transaction boundary (FR-28b):
   * Checks usage limit -> Increments UsageRecord -> Creates Transcript -> Enqueues ProcessingJob
   */
  static async createWithUsageTransaction(params: {
    userId: string;
    title: string;
    interviewDate?: Date | null;
    interviewee?: string | null;
    tags: string[];
    sourceType: TranscriptSourceType;
    extractedText: string;
    wordCount: number;
    userTier: SubscriptionTier;
  }) {
    const { userId, title, interviewDate, interviewee, tags, sourceType, extractedText, wordCount, userTier } = params;

    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const maxAllowed = userTier === SubscriptionTier.PAID ? 50 : 3;

    return await prisma.$transaction(async (tx) => {
      // 1. Get or create UsageRecord for current calendar month
      let usage = await tx.usageRecord.findUnique({
        where: {
          userId_periodStart: {
            userId,
            periodStart,
          },
        },
      });

      if (!usage) {
        usage = await tx.usageRecord.create({
          data: {
            userId,
            periodStart,
            periodEnd,
            transcriptsUsed: 0,
          },
        });
      }

      // 2. Enforce monthly tier limit
      if (usage.transcriptsUsed >= maxAllowed) {
        throw new Error(`USAGE_LIMIT_EXCEEDED:${usage.transcriptsUsed}:${maxAllowed}`);
      }

      // 3. Increment UsageRecord
      await tx.usageRecord.update({
        where: { id: usage.id },
        data: { transcriptsUsed: { increment: 1 } },
      });

      // 4. Create Transcript record
      const transcript = await tx.transcript.create({
        data: {
          userId,
          title,
          interviewDate,
          interviewee,
          tags,
          sourceType,
          extractedText,
          wordCount,
        },
      });

      // 5. Enqueue ProcessingJob
      const job = await tx.processingJob.create({
        data: {
          transcriptId: transcript.id,
          status: JobStatus.QUEUED,
        },
      });

      return { transcript, job };
    });
  }

  /**
   * Fetches transcript with full insight sections and latest processing status.
   */
  static async findById(id: string, userId: string) {
    return await prisma.transcript.findFirst({
      where: {
        id,
        userId,
        deletedAt: null,
      },
      include: {
        summary: true,
        themes: {
          orderBy: { createdAt: 'asc' },
        },
        painPoints: {
          orderBy: { createdAt: 'asc' },
        },
        quotes: {
          orderBy: { createdAt: 'asc' },
        },
        actionItems: {
          orderBy: { createdAt: 'asc' },
        },
        processingJobs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  /**
   * Deletes a transcript and triggers S3 deletion & DB cascade.
   */
  static async deleteTranscript(id: string, userId: string) {
    const transcript = await prisma.transcript.findFirst({
      where: { id, userId, deletedAt: null },
    });

    if (!transcript) return null;

    // Permanent cascade deletion per FR-29
    await prisma.transcript.delete({
      where: { id },
    });

    return transcript;
  }
}
