import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

/**
 * Error thrown by API helpers for expected (non-HTTP-500) failures.
 * Route handlers throw it and let `toApiError` shape the response.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly headers?: Record<string, string>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Consistent error envelope: `{ error: { code, message } }`. */
export function errorResponse(
  status: number,
  code: string,
  message: string,
  headers?: Record<string, string>
): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status, headers });
}

/**
 * Converts any thrown value into a consistent error envelope with an honest
 * status code. Known error types map precisely; unknown errors are logged and
 * returned as a generic 500.
 */
export function toApiError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return errorResponse(error.status, error.code, error.message, error.headers);
  }

  if (error instanceof ZodError) {
    const first = error.issues[0];
    const path = first && (first as { path: (string | number)[] }).path.join('.');
    const message = first ? `${path ? `${path}: ` : ''}${first.message}` : 'Invalid request body.';
    return errorResponse(422, 'VALIDATION_ERROR', message);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return errorResponse(409, 'CONFLICT', 'A record with the same unique value already exists.');
    }
    if (error.code === 'P2003') {
      return errorResponse(422, 'INVALID_REFERENCE', 'A referenced record does not exist.');
    }
    if (error.code === 'P2025') {
      return errorResponse(404, 'NOT_FOUND', 'Record not found.');
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return errorResponse(400, 'INVALID_QUERY', 'Malformed query against the data layer.');
  }

  console.error('Unhandled API error:', error);
  return errorResponse(500, 'INTERNAL_ERROR', 'Internal server error.');
}