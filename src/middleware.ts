import { NextRequest, NextResponse } from 'next/server';

/**
 * CORS for the public /api/v1 API.
 *
 * The API is public and unauthenticated, so responses allow any origin. This
 * lets the consumer page (and any other cross-origin client) read responses,
 * including when it runs locally on http://localhost:3000 against the live
 * Vercel deployment. OPTIONS preflights (POST/PATCH/DELETE with a JSON body)
 * are answered directly with 204.
 */

const CORS_ALLOW_ORIGIN = '*';
const CORS_ALLOW_METHODS = 'GET, POST, PATCH, DELETE, OPTIONS';
const CORS_ALLOW_HEADERS = 'Content-Type, Accept';
const CORS_MAX_AGE = '86400';

export function middleware(request: NextRequest) {
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': CORS_ALLOW_ORIGIN,
        'Access-Control-Allow-Methods': CORS_ALLOW_METHODS,
        'Access-Control-Allow-Headers': CORS_ALLOW_HEADERS,
        'Access-Control-Max-Age': CORS_MAX_AGE,
        Vary: 'Origin',
      },
    });
  }

  const response = NextResponse.next();
  response.headers.set('Access-Control-Allow-Origin', CORS_ALLOW_ORIGIN);
  response.headers.set('Access-Control-Allow-Methods', CORS_ALLOW_METHODS);
  response.headers.set('Access-Control-Allow-Headers', CORS_ALLOW_HEADERS);
  response.headers.set('Access-Control-Max-Age', CORS_MAX_AGE);
  response.headers.set('Vary', 'Origin');
  return response;
}

export const config = {
  matcher: ['/api/v1/:path*'],
};