---
trigger: always_on
---

# AI Output Integrity Rules

## Purpose

Ensure every AI-generated insight is grounded in the user's transcript.

## Rules

1. AI output must never be treated as trusted data merely because the provider returned it.
2. Validate every AI response against the expected JSON schema before using it.
3. Every notable quote must be verified against the original transcript using exact text matching.
4. Never save a quote that does not match the transcript verbatim.
5. Quotes must remain within the PRD's 50-word limit.
6. If a valid quote exceeds 50 words, truncate only at a valid sentence boundary under 50 words; otherwise discard it.
7. Preserve the quote's source character offsets.
8. Quote speaker labels must only be used when supported by the source transcript.
9. Final quotes must reference an explicit finalized `themeId` when a theme clearly supports them.
10. Use `themeId: null` when a quote does not clearly support a finalized theme.
11. Do not invent themes, pain points, action items, quotes, speakers, or evidence not supported by the transcript.
12. Deduplication must account for source offsets so overlapping chunks do not create duplicate insights.
13. Low-confidence output must remain visibly flagged according to the product requirements.
14. User edits must not be overwritten by a later AI processing step unless the user explicitly requests regeneration.
15. AI output must be persisted only after final schema and integrity validation succeeds.
16. If integrity validation fails, reject or discard the affected output rather than silently saving it.
17. Provider changes must not weaken any of these integrity requirements.

## Done

AI processing is not complete when the provider returns valid JSON. It is complete only when the output is schema-valid, transcript-grounded, correctly linked, and safe to persist.