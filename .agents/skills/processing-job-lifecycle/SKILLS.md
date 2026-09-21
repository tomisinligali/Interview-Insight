
### `.agents/skills/processing-job-lifecycle/skill.md`

```markdown
---
name: processing-job-lifecycle
description: Load for processing jobs, workers, queue polling, SKIP LOCKED, chunk retries, job retries, failure classification, concurrency, manual retry, recovery, or worker state.
---

# Processing Job Lifecycle

This skill teaches the ordered background-processing workflow. Its laws live in `processing-reliability.md`, `ai-pipeline.md`, and `database-schema.md`.

## Procedure

1. Create a queued processing job after successful transcript creation.

2. Run the worker separately from the Next.js web process.

3. Poll the Postgres job table every 5 seconds.

4. Claim one queued job atomically using `SELECT ... FOR UPDATE SKIP LOCKED`.

5. Mark the job as processing and record its claim/start information.

6. Run chunk extraction with no more than five concurrent calls.

7. Record each chunk's result and failure classification.

8. Retry transient chunk failures using the approved backoff.

9. Retry deterministic chunk failures once with the adjusted prompt.

10. If more than 30% of chunks fail, fail the whole attempt and use full-job retry.

11. Retry transient full-job failures up to three attempts using the approved delays.

12. Retry synthesis failures up to two times with the same merged input.

13. For manual retry:
    - Reuse the latest successful chunks.
    - Re-run only failed chunks.
    - Re-run synthesis.
    - Reapply the failure threshold.

14. Mark permanent failures as failed and expose the user-facing retry state.

15. Mark successful jobs complete only after final persistence succeeds.

16. Ensure worker crashes leave jobs recoverable.

## Code Skeleton

```ts
async function claimNextJob() {
  return prisma.$queryRaw<ProcessingJob[]>`
    SELECT *
    FROM "ProcessingJob"
    WHERE status = 'QUEUED'
    ORDER BY "createdAt"
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  `;
}
async function processJob(job: ProcessingJob) {
  await markProcessing(job.id);

  const results = await runWithConcurrency(
    getChunks(job.transcriptId),
    5,
    processChunk
  );

  const failed = results.filter((r) => r.status === "failed");

  if (failed.length / results.length > 0.3) {
    await scheduleFullRetry(job, failed);
    return;
  }

  const report = await synthesize(results);
  await persistReport(report);

  await markComplete(job.id);
}