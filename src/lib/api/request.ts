import { NextRequest } from 'next/server';
import { ApiError } from './errors';

export interface PageParams {
  limit: number;
  offset: number;
}

export type OrderDirection = 'asc' | 'desc';

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/** Reads and returns the request body as JSON or throws 400 for invalid JSON. */
export async function readJson(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ApiError(400, 'INVALID_BODY', 'Request body must be valid JSON.');
  }
}

/**
 * Parses `limit` and `offset`. Defaults to 20 and 0, clamps `limit` to 100,
 * and rejects non-integer or negative values.
 */
export function parsePageParams(searchParams: URLSearchParams): PageParams {
  const limit = parseIntParam(searchParams, 'limit', DEFAULT_LIMIT, 1, MAX_LIMIT);
  const offset = parseIntParam(searchParams, 'offset', 0, 0, undefined);
  return { limit, offset };
}

function parseIntParam(
  searchParams: URLSearchParams,
  name: string,
  fallback: number,
  min: number,
  clampMax: number | undefined
): number {
  const raw = searchParams.get(name);
  if (raw === null) return fallback;
  if (!/^-?\d+$/.test(raw)) {
    throw new ApiError(400, 'INVALID_QUERY', `Query parameter "${name}" must be an integer.`);
  }
  const value = parseInt(raw, 10);
  if (value < min) {
    throw new ApiError(400, 'INVALID_QUERY', `Query parameter "${name}" must be >= ${min}.`);
  }
  return clampMax === undefined ? value : Math.min(value, clampMax);
}

/**
 * Parses `sort` against the allowed field list. Returns `fallback` when absent.
 */
export function parseSortField(
  searchParams: URLSearchParams,
  allowed: readonly string[],
  fallback: string
): string {
  const raw = searchParams.get('sort');
  if (raw === null || raw === '') return fallback;
  if (!allowed.includes(raw)) {
    throw new ApiError(400, 'INVALID_QUERY', `Query parameter "sort" must be one of: ${allowed.join(', ')}.`);
  }
  return raw;
}

/** Parses `order` as `asc` or `desc`; defaults to `asc`. */
export function parseOrder(searchParams: URLSearchParams): OrderDirection {
  const raw = searchParams.get('order');
  if (raw === null || raw === '') return 'asc';
  if (raw !== 'asc' && raw !== 'desc') {
    throw new ApiError(400, 'INVALID_QUERY', 'Query parameter "order" must be "asc" or "desc".');
  }
  return raw;
}

/** Parses an ISO-8601 date filter; returns `undefined` when absent. */
export function parseDateParam(searchParams: URLSearchParams, name: string): Date | undefined {
  const raw = searchParams.get(name);
  if (raw === null || raw === '') return undefined;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, 'INVALID_QUERY', `Query parameter "${name}" must be a valid ISO-8601 date.`);
  }
  return date;
}

/** Parses a boolean filter; throws for anything that is not `true`/`false`. */
export function parseBooleanParam(searchParams: URLSearchParams, name: string): boolean | undefined {
  const raw = searchParams.get(name);
  if (raw === null || raw === '') return undefined;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new ApiError(400, 'INVALID_QUERY', `Query parameter "${name}" must be "true" or "false".`);
}

/** Parses an enum filter against allowed values; returns `undefined` when absent. */
export function parseEnumParam(
  searchParams: URLSearchParams,
  name: string,
  values: readonly string[]
): string | undefined {
  const raw = searchParams.get(name);
  if (raw === null || raw === '') return undefined;
  if (!values.includes(raw)) {
    throw new ApiError(400, 'INVALID_QUERY', `Query parameter "${name}" must be one of: ${values.join(', ')}.`);
  }
  return raw;
}