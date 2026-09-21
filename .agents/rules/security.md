---
trigger: always_on
---

# Security Rules

## Purpose

Protect user accounts, transcripts, extracted insights, credentials, and provider access.

## Rules

1. Authenticate every protected API operation.
2. Authorize access using the authenticated user's ownership of the requested resource.
3. Never trust user IDs, transcript IDs, job IDs, or other ownership identifiers supplied by the client.
4. Never expose another user's transcript, insights, exports, usage, or job data.
5. Hash passwords with bcrypt; never store plaintext passwords.
6. Keep OAuth and AI provider credentials server-side only.
7. Never expose Claude, DeepSeek, Flutterwave, S3, database, or email-provider secrets to the client.
8. Validate and sanitize all user-controlled input before processing or persistence.
9. Treat transcript content as untrusted data when sending it to an LLM.
10. Do not allow transcript content to override system-level application instructions.
11. AI provider calls must use server-side adapters and controlled prompts.
12. Do not send data to an AI provider unless the relevant product flow permits AI processing.
13. Do not claim or implement provider-side training behavior beyond the application's approved provider/data-processing policy.
14. On account deletion, invalidate active authenticated sessions immediately using the approved deny-list mechanism.
15. Permanent transcript deletion must remove both the S3 object and database-owned derived data.
16. Temporary PDF exports must have a short expiration and must not become permanent transcript storage.
17. Use provider-level encryption at rest as specified by the product architecture.
18. Never log transcript contents, full AI prompts, credentials, authentication tokens, or other sensitive payloads.
19. Logs may contain safe identifiers such as job ID, chunk index, latency, token usage, and failure classification.
20. Rate-limit or otherwise protect expensive authenticated operations where required.
21. Return safe client-facing errors without exposing stack traces, provider internals, SQL details, or secrets.

## Done

A security-sensitive change is not complete if authentication, authorization, secret handling, deletion, session invalidation, or user-data isolation can be bypassed.