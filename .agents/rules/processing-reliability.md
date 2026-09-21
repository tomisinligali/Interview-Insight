---
trigger: always_on
---

# Processing Reliability Rules

## Purpose

Ensure large transcript jobs complete safely without duplicate processing, silent failure, or unnecessary provider cost.

## Rules

1. Transcript processing must run asynchronously through the approved Postgres-backed job queue.
2. Job claiming must use concurrency-safe locking with `SELECT ... FOR UPDATE SKIP LOCKED`.
3. A job must never be processed concurrently by two workers.
4. Each transcript must preserve its processing state and failure state.
5. Chunk extraction concurrency must not exceed 5 concurrent provider calls per transcript.
6. Each chunk must retain its index and original source offset range.
7. Classify failures as `transient` or `deterministic`.
8. Retry transient failures using the approved exponential backoff policy.
9. Retry deterministic chunk failures at most once with the adjusted prompt.
10. Do not waste retry budget on deterministic failures that continue after the adjusted attempt.
11. If more than 30% of chunks fail, fail the whole processing attempt and queue the job for full retry.
12. Full job retries may occur up to 3 attempts for transient job-level failures.
13. Synthesis may be retried up to 2 times using the same valid merged input.
14. Manual retry must retry only failed chunks unless the whole-job failure threshold is reached again.
15. Processing must be idempotent; retries must not create duplicate insights or duplicate usage records.
16. A failed job must produce a visible user-facing failure state.
17. Low-signal transcripts may complete but must be marked `low_confidence` according to the product rules.
18. Log job ID, chunk index, latency, token usage, and failure classification without logging sensitive transcript content.
19. Do not silently return partial results when the failure threshold requires the whole job to fail.
20. Provider outages, rate limits, and timeouts must be handled without crashing the worker.
21. Worker failures must leave jobs recoverable rather than permanently stuck in `PROCESSING`.

## Done

Processing is not complete if jobs can be duplicated, lost, silently fail, exceed concurrency limits, consume retry budget incorrectly, or produce duplicate persisted insights.