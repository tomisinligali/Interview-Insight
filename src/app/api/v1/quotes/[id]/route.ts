import { NextRequest } from 'next/server';

import { prisma } from '@/lib/db/prisma';
import { ApiError, toApiError } from '@/lib/api/errors';
import { requireExistingTheme } from '@/lib/api/references';
import { itemResponse } from '@/lib/api/response';
import { readJson } from '@/lib/api/request';
import { quoteUpdateSchema } from '@/lib/validation/resource-schemas';

export const dynamic = 'force-dynamic';

async function requireQuote(id: string) {
  const quote = await prisma.quote.findUnique({ where: { id } });
  if (!quote) {
    throw new ApiError(404, 'NOT_FOUND', 'Quote not found.');
  }
  return quote;
}

/**
 * GET /api/v1/quotes/:id
 * Retrieves a single quote.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const quote = await requireQuote(params.id);
    return itemResponse(quote);
  } catch (error) {
    return toApiError(error);
  }
}

/**
 * PATCH /api/v1/quotes/:id
 * Updates quote fields (themeId is editable) and stamps editedAt.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const existing = await requireQuote(params.id);

    const body = await readJson(req);
    const input = quoteUpdateSchema.parse(body);

    if (input.themeId !== undefined && input.themeId !== null) {
      await requireExistingTheme(input.themeId);
    }

    const quote = await prisma.quote.update({
      where: { id: existing.id },
      data: { ...input, editedAt: new Date() },
    });

    return itemResponse(quote);
  } catch (error) {
    return toApiError(error);
  }
}

/**
 * DELETE /api/v1/quotes/:id
 * Removes the quote.
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const existing = await requireQuote(params.id);

    await prisma.quote.delete({ where: { id: existing.id } });

    return itemResponse({ id: existing.id, deleted: true });
  } catch (error) {
    return toApiError(error);
  }
}