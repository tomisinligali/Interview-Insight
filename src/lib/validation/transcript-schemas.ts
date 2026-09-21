import { z } from 'zod';
import { TranscriptSourceType, Severity, Sentiment } from '@prisma/client';

export const createTranscriptSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title cannot exceed 200 characters'),
  interviewDate: z.string().datetime().optional().nullable(),
  interviewee: z.string().trim().max(100).optional().nullable(),
  tags: z.array(z.string().trim().max(50)).default([]),
  sourceType: z.nativeEnum(TranscriptSourceType),
  text: z.string().min(1, 'Transcript text cannot be empty'),
});

export const updateInsightFieldSchema = z.object({
  content: z.string().optional(),
  title: z.string().max(60, 'Theme title max 60 characters').optional(),
  description: z.string().optional(),
  sentiment: z.nativeEnum(Sentiment).optional(),
  sentimentReason: z.string().optional(),
  severity: z.nativeEnum(Severity).optional(),
  text: z.string().optional(),
  speakerLabel: z.string().optional().nullable(),
});

export const exportQuerySchema = z.object({
  format: z.enum(['md', 'pdf']),
});
