import { prisma } from '@/lib/db/prisma';
import { ApiError } from './errors';

/**
 * Reference-existence checks for create/update payloads. Parent references
 * resolve against live records (soft-deleted transcripts are rejected) and
 * throw a 422 validation error when missing.
 */

export async function requireExistingTranscript(transcriptId: string): Promise<void> {
  const row = await prisma.transcript.findFirst({
    where: { id: transcriptId, deletedAt: null },
    select: { id: true },
  });
  if (!row) {
    throw new ApiError(422, 'INVALID_REFERENCE', 'transcriptId does not reference an existing transcript.');
  }
}

export async function requireExistingTheme(themeId: string): Promise<void> {
  const row = await prisma.theme.findUnique({ where: { id: themeId }, select: { id: true } });
  if (!row) {
    throw new ApiError(422, 'INVALID_REFERENCE', 'themeId does not reference an existing theme.');
  }
}

export async function requireExistingUser(userId: string): Promise<void> {
  const row = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true },
  });
  if (!row) {
    throw new ApiError(422, 'INVALID_REFERENCE', 'userId does not reference an existing user.');
  }
}

export async function requireExistingOrganization(organizationId: string): Promise<void> {
  const row = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true },
  });
  if (!row) {
    throw new ApiError(422, 'INVALID_REFERENCE', 'organizationId does not reference an existing organization.');
  }
}