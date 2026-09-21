import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

/**
 * Integration tests for the Step 4 bad-input handling of the /api/v1 REST API.
 *
 * These run against a live Next.js dev server with a seeded database and assert
 * the exact status codes and error-envelope shapes required by the assessment:
 *
 *  - limit beyond the maximum is clamped, not honoured
 *  - negative offset -> 400 with a clear message
 *  - unknown sort field -> 400, never silently ignored
 *  - malformed identifiers -> 400/404, never 500
 *  - POST missing a required field -> 422 that identifies the field
 *  - schema validation is applied to bodies and query parameters
 *  - every error uses the one defined envelope { error: { code, message } }
 */

const PORT = 3199;
const BASE = `http://127.0.0.1:${PORT}/api/v1`;
const READY_TIMEOUT_MS = 120_000;

let server: ChildProcess | null = null;

/** Performs an API request and returns status + parsed body (or null). */
async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, init);
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

/** Asserts the single, consistent error envelope shape. */
function assertErrorEnvelope(status: number, body: unknown, errorCode: string) {
  assert.notEqual(status, 200, `expected a non-2xx status, got ${status}`);
  assert.ok(body && typeof body === 'object', 'error body must be an object');
  const envelope = body as { error?: unknown };
  assert.deepEqual(Object.keys(envelope), ['error'], 'envelope must only contain "error"');
  const error = envelope.error as { code?: unknown; message?: unknown };
  assert.deepEqual(Object.keys(error).sort(), ['code', 'message']);
  assert.equal(typeof error.code, 'string');
  assert.equal(typeof error.message, 'string');
  assert.equal(error.code, errorCode);
}

before(async () => {
  const seed = spawn('npx', ['tsx', 'prisma/seed.ts'], { stdio: 'ignore' });
  const seedExitCode = await new Promise<number>((resolve) => seed.on('exit', (code) => resolve(code ?? -1)));
  assert.equal(seedExitCode, 0, 'prisma seed must exit 0');

  server = spawn('npm', ['run', 'dev', '--', '-p', String(PORT)], { stdio: 'ignore' });

  const deadline = Date.now() + READY_TIMEOUT_MS;
  for (;;) {
    if (server.exitCode !== null) {
      throw new Error(`next dev exited early with code ${server.exitCode}`);
    }
    try {
      const res = await fetch(`${BASE}/transcripts?limit=1`);
      if (res.status === 200) break;
    } catch {
      // server not up yet
    }
    if (Date.now() > deadline) throw new Error('server did not become ready in time');
    await delay(1000);
  }
});

after(() => {
  if (server) server.kill('SIGTERM');
});

test('GET list: limit beyond maximum is clamped to 100, not honoured', async () => {
  const { status, body } = await api('/transcripts?limit=5000');

  assert.equal(status, 200);
  assert.ok(body && typeof body === 'object');
  assert.deepEqual(Object.keys(body).sort(), ['data', 'meta'], 'success envelope must be { data, meta }');
  assert.equal(body.meta.limit, 100, 'limit must be clamped to the configured maximum');
  assert.equal(body.meta.offset, 0);
  assert.ok(Array.isArray(body.data), 'data must be an array');
  assert.ok(body.data.length <= 100, 'must not return more than the configured maximum');
});

test('GET list: negative offset returns 400 with a clear message', async () => {
  const { status, body } = await api('/transcripts?offset=-5');

  assert.equal(status, 400);
  assertErrorEnvelope(status, body, 'INVALID_QUERY');
  assert.match((body.error as { message: string }).message, /offset/);
});

test('GET list: non-integer offset/limit return 400', async () => {
  for (const query of ['offset=abc', 'limit=1.5', 'offset=', 'limit=12px']) {
    const { status, body } = await api(`/transcripts?${query}`);
    assert.equal(status, 400, `expected 400 for query "${query}"`);
    assertErrorEnvelope(status, body, 'INVALID_QUERY');
  }
});

test('GET list: unknown sort field returns 400 and is not silently ignored', async () => {
  const { status, body } = await api('/transcripts?sort=definitelyNotAField');

  assert.equal(status, 400);
  assertErrorEnvelope(status, body, 'INVALID_QUERY');
  assert.match((body.error as { message: string }).message, /sort|definitelyNotAField/);

  const { status: allStatus } = await api('/transcripts?sort=nonexistentField&limit=5');
  assert.equal(allStatus, 400);
});

test('GET list: invalid order and invalid enum filter return 400', async () => {
  const { status: orderStatus, body: orderBody } = await api('/transcripts?order=sideways');
  assert.equal(orderStatus, 400);
  assertErrorEnvelope(orderStatus, orderBody, 'INVALID_QUERY');

  const { status: enumStatus, body: enumBody } = await api('/transcripts?sourceType=YAML');
  assert.equal(enumStatus, 400);
  assertErrorEnvelope(enumStatus, enumBody, 'INVALID_QUERY');
});

test('GET item: malformed identifiers return 400 or 404, never 500', async () => {
  const malformedIds = [
    'not-a-real-id',
    'abc def',
    '1234567890',
    'cm00000000000000000000000000',
    'a.b-c_d',
  ];

  for (const id of malformedIds) {
    const { status, body } = await api(`/transcripts/${encodeURIComponent(id)}`);

    assert.ok(status === 400 || status === 404, `expected 400 or 404 for id "${id}", got ${status}`);
    assert.notEqual(status, 500, `malformed id "${id}" must never produce a 500`);
    assertErrorEnvelope(status, body, 'NOT_FOUND');
  }
});

test('GET item: nonexistent but well-formed id returns 404 with the error envelope', async () => {
  const { status, body } = await api('/transcripts/cmubcwuyq0001gyglp4x6sma7');

  assert.equal(status, 404);
  assertErrorEnvelope(status, body, 'NOT_FOUND');
});

test('POST: missing required field returns 422 and identifies the field', async () => {
  const { status, body } = await api('/themes', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ transcriptId: 'abc', description: 'd', sentiment: 'POSITIVE', sentimentReason: 'r' }),
  });

  assert.equal(status, 422);
  assertErrorEnvelope(status, body, 'VALIDATION_ERROR');
  assert.match((body.error as { message: string }).message, /title/);

  const { status: secondStatus, body: secondBody } = await api('/transcripts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: 'abc', title: 'T', sourceType: 'PASTE' }),
  });
  assert.equal(secondStatus, 422);
  assertErrorEnvelope(secondStatus, secondBody, 'VALIDATION_ERROR');
  assert.match((secondBody.error as { message: string }).message, /extractedText/);
});

test('POST: non-JSON body returns 400 with a clear message', async () => {
  const res = await fetch(`${BASE}/themes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{ this is not valid json',
  });
  const body = await res.json();

  assert.equal(res.status, 400);
  assertErrorEnvelope(res.status, body, 'INVALID_BODY');
});

test('POST: unknown or immutable fields are rejected (strict schema validation)', async () => {
  const { status, body } = await api('/quotes', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      transcriptId: 'abc',
      text: 'A quote',
      madeUpField: 'should be rejected',
    }),
  });

  assert.equal(status, 422);
  assertErrorEnvelope(status, body, 'VALIDATION_ERROR');

  // PATCH a real quote with an immutable parent field -> must be rejected, not applied.
  const list = await api('/quotes?limit=1');
  const quoteId = (list.body as { data: { id: string }[] }).data[0].id;
  const { status: patchStatus, body: patchBody } = await api(`/quotes/${quoteId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ transcriptId: 'different-parent' }),
  });
  assert.equal(patchStatus, 422);
  assertErrorEnvelope(patchStatus, patchBody, 'VALIDATION_ERROR');
});