import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { after, before, test } from 'node:test';

import { RATE_LIMIT } from '../../src/config/rate-limit.ts';

const PORT = 3199;
const BASE = `http://127.0.0.1:${PORT}/api/v1`;
/** Every request from this file uses its own throwaway IP bucket. */
const RUN_IP = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
/** Dedicated IP used only for the over-limit abuse case. */
const ABUSE_IP = '203.0.113.77';

let server: ReturnType<typeof spawn> | null = null;

async function api(
  path: string,
  init?: RequestInit,
  ip: string = RUN_IP
): Promise<{ status: number; headers: Headers; body: unknown }> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), 'x-forwarded-for': ip },
  });
  const body = await response.json().catch(() => null);
  return { status: response.status, headers: response.headers, body };
}

async function waitUntilServerReady(target: string): Promise<void> {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(target, { headers: { 'x-forwarded-for': RUN_IP } });
      if (res.status !== 503) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error('Server did not become ready in time.');
}

before(async () => {
  const seed = spawn('npx', ['tsx', 'prisma/seed.ts'], {
    cwd: process.cwd(),
    stdio: 'ignore',
  });
  await new Promise((resolve) => seed.on('exit', resolve));

  server = spawn('npm', ['run', 'dev', '--', '-p', String(PORT)], {
    cwd: process.cwd(),
    stdio: 'ignore',
    detached: true,
  });
  await waitUntilServerReady(`${BASE}/transcripts?limit=1`);
});

after(() => {
  if (server) {
    process.kill(-server.pid!, 'SIGTERM');
  }
});

test('rate limit: config file holds the window and max', () => {
  assert.equal(RATE_LIMIT.maxRequests, 100);
  assert.equal(RATE_LIMIT.windowMs, 60_000);
});

test('rate limit: an IP over the limit gets 429, Retry-After, and the error envelope', async () => {
  const okCounts = [];
  let saw429 = false;
  let retryAfter: string | null = null;

  for (let i = 0; i < RATE_LIMIT.maxRequests + 5; i += 1) {
    const { status, headers, body } = await api('/transcripts?limit=1&offset=0', undefined, ABUSE_IP);
    if (status === 429) {
      saw429 = true;
      retryAfter = headers.get('retry-after');
      assert.deepEqual(Object.keys(body as Record<string, unknown>), ['error']);
      assert.equal((body as { error: { code: string } }).error.code, 'RATE_LIMIT_EXCEEDED');
      assert.match((body as { error: { message: string } }).error.message, /too many requests/i);
      break;
    }
    assert.equal(status, 200, `request ${i} should not be rate-limited yet`);
    okCounts.push(status);
  }

  assert.ok(saw429, 'expected the limit to trigger a 429');
  assert.equal(okCounts.length, RATE_LIMIT.maxRequests, 'first 100 requests should pass');
  assert.ok(retryAfter !== null, 'Retry-After header should be present');
  assert.ok(Number(retryAfter) >= 1, `Retry-After should be >= 1 second, got ${retryAfter}`);
});

test('rate limit: distinct IPs have independent budgets', async () => {
  for (let i = 0; i < 10; i += 1) {
    const ip = `198.51.100.${100 + i}`;
    const { status } = await api('/transcripts?limit=1', undefined, ip);
    assert.equal(status, 200, `IP ${ip} request ${i} should be allowed`);
  }
});