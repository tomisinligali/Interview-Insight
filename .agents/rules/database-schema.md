---
trigger: always_on
---

# Database Schema Rules

## Purpose

Keep transcript data, insight data, jobs, usage, and account data correct, isolated, and safely deletable.

## Rules

1. PostgreSQL is the source of truth for application data.
2. Prisma is the only ORM/data-access layer.
3. Every user-owned record must have a clear ownership path back to the user.
4. Transcript-owned derived records must follow the PRD deletion behavior.
5. Deleting a transcript must remove its stored object and cascade its database-owned derived records.
6. Deleting a theme must not delete quotes, pain points, or action items that reference it; nullable theme relationships must use `SetNull` where required.
7. Preserve quote source offsets in the database.
8. Store structured insight records as separate rows, not as one opaque JSON blob.
9. Use enums or database constraints for fixed states such as job status, failure type, severity, sentiment, and export status.
10. Usage accounting must be transaction-safe and must not increment again when an existing transcript is retried.
11. Job claiming must be concurrency-safe using the approved Postgres locking strategy.
12. Add indexes only for real query paths, ownership lookups, job claiming, usage checks, and other demonstrated access patterns.
13. Never modify an existing production schema by changing a default and assuming existing rows will update.
14. Any breaking or data-changing schema change requires an explicit migration.
15. Never use destructive migrations to remove user data unless the product requirement explicitly requires permanent deletion.
16. Do not store secrets, provider API keys, or raw credentials in database records.
17. Database transactions must be used when multiple related writes must succeed or fail together.

## Done

A schema change is not complete until migrations, relations, deletion behavior, constraints, indexes, and affected application queries remain correct.