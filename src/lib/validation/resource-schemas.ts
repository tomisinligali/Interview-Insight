import { z } from 'zod';
import {
  SubscriptionTier,
  Severity,
  Sentiment,
  TranscriptSourceType,
} from '@prisma/client';

/**
 * Zod schemas for the Step 3 REST resource API (/api/v1/).
 * Centralizes the required-field and validation rules for the seven resources
 * defined in the Step 1 resource design. All schemas are strict: unknown or
 * immutable fields are rejected rather than silently dropped.
 */

const idString = z.string().min(1, 'id is required');
const isoDateTime = z.string().datetime();
const nullableString = z.string().trim().optional().nullable();

const dateTransform = (value: string | null | undefined) => (value ? new Date(value) : null);

/** Wraps an object schema in strict mode (reject unknown keys). */
function strict<T extends z.ZodRawShape>(schema: z.ZodObject<T>): z.ZodObject<T> {
  return schema.strict();
}

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

export const userCreateSchema = strict(
  z.object({
    email: z.string().trim().email().max(254),
    passwordHash: nullableString,
    googleId: nullableString,
    subscriptionTier: z.nativeEnum(SubscriptionTier).optional(),
    stripeCustomerId: nullableString,
    organizationId: nullableString,
  })
);

export const userUpdateSchema = strict(userCreateSchema.partial());

// ---------------------------------------------------------------------------
// Transcript
// ---------------------------------------------------------------------------

export const transcriptCreateSchema = strict(
  z.object({
    userId: idString,
    title: z.string().trim().min(1, 'title is required').max(200, 'title cannot exceed 200 characters'),
    interviewDate: isoDateTime.optional().nullable().transform(dateTransform),
    interviewee: z.string().trim().max(100).optional().nullable(),
    tags: z.array(z.string().trim().max(50)).default([]),
    sourceType: z.nativeEnum(TranscriptSourceType),
    originalFileKey: z.string().min(1).optional().nullable(),
    extractedText: z.string().min(1, 'extractedText is required'),
    detectedLanguage: nullableString,
    isNonEnglish: z.boolean().optional(),
    isLowConfidence: z.boolean().optional(),
  })
);

/** Editable fields for PATCH; parent/identity fields (userId, sourceType) are immutable. */
export const transcriptUpdateSchema = strict(
  transcriptCreateSchema.omit({ userId: true, sourceType: true }).partial()
);

// ---------------------------------------------------------------------------
// Summary (1:1 with a transcript)
// ---------------------------------------------------------------------------

export const summaryCreateSchema = strict(
  z.object({
    transcriptId: idString,
    content: z.string().min(1, 'content is required'),
  })
);

export const summaryUpdateSchema = strict(
  z.object({
    content: z.string().min(1, 'content is required'),
  }).partial()
);

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

export const themeCreateSchema = strict(
  z.object({
    transcriptId: idString,
    title: z.string().trim().min(1, 'title is required').max(60, 'title cannot exceed 60 characters'),
    description: z.string().min(1, 'description is required'),
    sentiment: z.nativeEnum(Sentiment),
    sentimentReason: z.string().trim().min(1, 'sentimentReason is required'),
  })
);

export const themeUpdateSchema = strict(
  z.object({
    title: z.string().trim().min(1, 'title is required').max(60, 'title cannot exceed 60 characters').optional(),
    description: z.string().min(1, 'description is required').optional(),
    sentiment: z.nativeEnum(Sentiment).optional(),
    sentimentReason: z.string().trim().min(1, 'sentimentReason is required').optional(),
  })
);

// ---------------------------------------------------------------------------
// Pain Point
// ---------------------------------------------------------------------------

export const painPointCreateSchema = strict(
  z.object({
    transcriptId: idString,
    themeId: nullableString,
    title: z.string().trim().min(1, 'title is required'),
    description: z.string().min(1, 'description is required'),
    severity: z.nativeEnum(Severity),
  })
);

/** Parent fields (transcriptId) are immutable; themeId is editable. */
export const painPointUpdateSchema = strict(
  z.object({
    themeId: nullableString,
    title: z.string().trim().min(1, 'title is required').optional(),
    description: z.string().min(1, 'description is required').optional(),
    severity: z.nativeEnum(Severity).optional(),
  })
);

// ---------------------------------------------------------------------------
// Quote
// ---------------------------------------------------------------------------

const quoteBaseSchema = z
  .object({
    transcriptId: idString,
    themeId: nullableString,
    text: z.string().trim().min(1, 'text is required'),
    speakerLabel: z.string().trim().min(1).max(100).optional().nullable(),
    sourceOffsetStart: z.number().int().min(0).optional().nullable(),
    sourceOffsetEnd: z.number().int().min(0).optional().nullable(),
    wasTruncated: z.boolean().optional(),
  })
  .strict();

export const quoteCreateSchema = quoteBaseSchema.refine(
  (data) =>
    data.sourceOffsetStart == null ||
    data.sourceOffsetEnd == null ||
    data.sourceOffsetEnd >= data.sourceOffsetStart,
  { message: 'sourceOffsetEnd must be >= sourceOffsetStart', path: ['sourceOffsetEnd'] }
);

/** Parent fields (transcriptId) are immutable; themeId is editable. */
export const quoteUpdateSchema = strict(quoteBaseSchema.omit({ transcriptId: true }).partial());

// ---------------------------------------------------------------------------
// Action Item
// ---------------------------------------------------------------------------

export const actionItemCreateSchema = strict(
  z.object({
    transcriptId: idString,
    themeId: nullableString,
    description: z.string().min(1, 'description is required'),
  })
);

/** Parent fields (transcriptId) are immutable; themeId is editable. */
export const actionItemUpdateSchema = strict(
  z.object({
    themeId: nullableString,
    description: z.string().min(1, 'description is required').optional(),
  })
);

// ---------------------------------------------------------------------------
// Shared domain constants
// ---------------------------------------------------------------------------

/** Transcript word limit enforced on create/update (FR-1). */
export const MAX_TRANSCRIPT_WORDS = 50000;

/** Quote text word limit (FR-15). */
export const MAX_QUOTE_WORDS = 50;