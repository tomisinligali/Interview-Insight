import { NextResponse } from 'next/server';

export interface ListMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/** Consistent list envelope: `{ data, meta: { total, limit, offset, hasMore } }`. */
export function listResponse(data: unknown[], meta: ListMeta): NextResponse {
  return NextResponse.json({ data, meta });
}

/** Consistent single-resource envelope: `{ data: ... }` (or status 201). */
export function itemResponse(data: unknown, status = 200): NextResponse {
  return NextResponse.json({ data }, { status });
}

/**
 * Runs the findMany + count queries for one page and returns the list payload
 * with the standard meta block. `hasMore` is true when another page exists.
 */
export async function listResult<T>(options: {
  findMany: () => Promise<T[]>;
  count: () => Promise<number>;
  limit: number;
  offset: number;
}): Promise<{ data: T[]; meta: ListMeta }> {
  const { findMany, count, limit, offset } = options;
  const [data, total] = await Promise.all([findMany(), count()]);
  return {
    data,
    meta: { total, limit, offset, hasMore: offset + limit < total },
  };
}