# PRD: Interview Insights App (v2 — Post-Review Revision)

*This revision incorporates all corrections from the structured PRD review (Skeptic / Author / Engineer / Product Lead / Judge). Each changed section notes what was fixed and why, inline, so the rationale isn't lost.*

## 1. Product Summary

A web app that converts raw interview transcripts (customer interviews, user research sessions, sales calls) into structured, editable insight reports. The user uploads or pastes a transcript; the system runs it through an AI pipeline and returns a summary, key themes, pain points, notable quotes, action items, and sentiment per theme. Output replaces manual note-taking and re-listening/re-reading. Built on Next.js, TypeScript, Prisma, and PostgreSQL, using Anthropic Claude for AI processing.

## 2. Problem Statement

Researchers, PMs, and customer-facing teams spend significant time per interview manually extracting themes, quotes, and action items. This work is repetitive, inconsistent across people, and creates a backlog that delays decision-making. Existing note-taking tools store transcripts but don't structure them into decision-ready output. Teams either skip synthesis entirely or do it inconsistently, losing signal from raw interview data.

**[FIXED — Lapse 20]** Removed the unvalidated "45-60 minutes manual" claim as a stated fact. The actual manual-synthesis baseline is unmeasured. See Section 3 for the reframed goal and Section 14 for the validation task.

## 3. Goals and Non-Goals

**Goals (v1):**
- Deliver a complete structured insight report (all six output types) within 5 minutes of transcript submission for transcripts under 10,000 words. **[FIXED — Lapse 20]** This is now an absolute target, not a claimed reduction from an unvalidated manual baseline. A separate pre-launch task validates real-world manual synthesis time with target users (Section 14); marketing/comparison claims will be updated based on that data, not before.
- Produce six structured output types per transcript, each independently editable.
- Support text-based transcript formats without requiring speaker labels.
- Handle transcripts up to 50,000 words reliably, with visible progress and failure states.
- Let users export finished insights as PDF or Markdown.
- Detect and flag non-English input before processing (see Section 5.1, FR-3b). **[FIXED — Lapse 4]**

**Non-Goals (v1):**
- No audio/video transcription (user must supply text).
- No PDF input parsing.
- No multi-language *processing* support (English-only extraction/synthesis). Note: non-English *detection* is in scope as a guardrail (FR-3b), even though non-English *processing* is not.
- No team/org accounts, shared workspaces, or role-based permissions.
- No integrations (Slack, Notion, CRM export, etc.).
- No real-time collaborative editing of insights.
- No custom AI prompt configuration by end users.
- No multi-version edit history (single-level per-field undo only — see FR-19).

## 4. User Personas

| Persona | Role | Primary Use Case | Key Need |
|---|---|---|---|
| UX Researcher | Runs 5–15 user interviews/month | Synthesize interviews into themes for a research report | Accurate theme clustering, quote traceability |
| Product Manager | Runs occasional customer calls | Quickly extract pain points and action items | Speed, skimmable summary, action items tied to features |
| Customer-facing rep (CS/Sales) | Runs frequent calls, low time for synthesis | Pull sentiment and general friction points from a sales/support call | Fast turnaround, sentiment flag, minimal editing needed. **[FIXED — Lapse 19]** Objections are captured via the Pain Points output type in v1 as an imperfect fit (pricing pushback, feature gaps, etc. get logged as pain points with severity, not as a dedicated "objection" type). Dedicated objection-tracking with sales-specific taxonomy is a v3 candidate, not a v1 feature. |

## 5. Functional Requirements

### 5.1 Transcript Input

| ID | Requirement |
|---|---|
| FR-1 | User can paste raw text into a textarea (max 50,000 words, enforced client- and server-side). |
| FR-2 | User can upload a file in `.txt`, `.docx`, `.srt`, or `.vtt` format, max file size 10MB. |
| FR-3 | On upload, system extracts plain text server-side: `.docx` via text extraction library, `.srt`/`.vtt` via subtitle parser that strips timestamps and cue numbers, keeping speaker labels if present in the text. **[FIXED — Lapse 9]** A line is treated as a speaker label if it matches the pattern `^[A-Za-z0-9_ ]{1,40}:` at the start of a line, with no punctuation other than the trailing colon (e.g., "SPEAKER_01:", "Jane Doe:"). Lines not matching this pattern are treated as transcript body text. This is a best-effort heuristic — mismatches are expected, and speaker label remains optional metadata per the confirmed assumptions, not something the pipeline blocks on. |
| FR-3b | **[NEW — Lapse 4]** Before word-count validation, the system runs a language check on the extracted text (via a lightweight language-detection library, e.g., langdetect, or a fast Claude call as part of Step 1 normalization). If the detected language is not English with high confidence, the transcript is flagged `non_english` and the user is warned in the UI ("This transcript doesn't appear to be in English. Processing quality may be poor.") before they can confirm submission. This is a pre-pipeline gate, not a post-hoc low-confidence flag — it runs before any chunking or extraction cost is incurred. |
| FR-4 | Word count is computed in two passes. **[FIXED — Lapse: wasted processing before rejection]** Pass 1 (pre-check): before full text extraction, estimate word count from raw file size (assume ~6 characters per word average). If the estimate implies more than 75,000 words, reject immediately without running extraction. Pass 2 (authoritative): after full extraction, compute the exact word count. If it exceeds 50,000 words, reject with an explicit error message stating the actual count and the limit. |
| FR-5 | User assigns a title and optional metadata (interview date, interviewee name, tags) at upload time. All fields optional except title, which defaults to filename or "Untitled Interview [date]" if not provided. |
| FR-6 | Uploaded file is stored in S3-compatible object storage; extracted text is stored in Postgres linked to the transcript record. |

### 5.2 Processing

| ID | Requirement |
|---|---|
| FR-7 | On submit, transcript enters a processing queue. User sees a status indicator with states: `queued`, `processing`, `complete`, `failed`. |
| FR-8 | Processing is asynchronous. User can navigate away and return; status persists. |
| FR-9 | Processing time targets: under 3 minutes for a 10,000-word transcript, under 8 minutes for a 50,000-word transcript. **[FIXED — Lapse 14]** These are estimates derived from pipeline math (see Section 6 worked example), not committed SLAs. They must be confirmed via a real load test on 3 representative transcript sizes (5k / 25k / 50k words) before being used in any user-facing commitment or marketing claim (see Section 14 action item). |
| FR-10 | If processing fails after retries (see Section 6), status becomes `failed` with a user-facing message and a manual "Retry" button. **[FIXED — Lapse 6]** Manual retry re-processes only chunks marked `failed` from the most recent attempt, then re-runs synthesis with the updated full chunk set. It does not re-run successfully-processed chunks. Full-job retry (all chunks reprocessed) is only triggered automatically when more than 30% of chunks failed in a single attempt, since partial data is considered unreliable at that failure rate. |

### 5.3 Insight Output

| ID | Requirement |
|---|---|
| FR-11 | Output includes exactly six sections: Summary, Key Themes, Pain Points, Notable Quotes, Action Items, Sentiment per Theme. |
| FR-12 | Summary: 150–300 word narrative overview, plain text, editable as a single text block. |
| FR-13 | Key Themes: list of 3–8 themes, each with a title (max 60 chars), a 1–3 sentence description, and a list of linked quote IDs. **[FIXED — Lapse 10]** See FR-13b for how the linkage is actually generated. |
| FR-13b | **[NEW — Lapse 10]** The theme-to-quote linkage is generated during the synthesis step, not inferred after the fact. Synthesis output JSON must include, for each selected quote, an explicit `themeId` referencing one of the finalized theme IDs in the same synthesis response. Quotes that don't clearly support any finalized theme are still included but with `themeId: null`. |
| FR-14 | Pain Points: list of discrete pain point entries, each with a title, description, and severity tag (`low`/`medium`/`high`) assigned by the AI, editable by user. |
| FR-15 | Notable Quotes: list of verbatim excerpts pulled directly from transcript text, each tagged with the theme it supports (per FR-13b) and, if speaker labels exist in the source (per FR-3), the speaker label. Extraction and synthesis prompts instruct the model to select excerpts of 50 words or fewer. **[FIXED — Lapse 17]** If a returned quote exceeds 50 words after exact-substring validation against source text, it is truncated to the nearest sentence boundary under 50 words. If no valid sentence boundary exists under 50 words, the quote is dropped rather than truncated mid-sentence. |
| FR-16 | Action Items: list of discrete, imperative-phrased tasks (e.g., "Investigate onboarding drop-off in week 1"), each optionally linked to a theme or pain point. |
| FR-17 | Sentiment per Theme: each Key Theme gets one sentiment label (`positive`/`neutral`/`negative`/`mixed`) plus a 1-sentence justification. |
| FR-18 | Every field in every section is independently editable inline. Edits save on blur, no explicit "save" button required. |
| FR-19 | **[FIXED — Lapse 18]** No multi-version history in v1 — this remains out of scope and is deferred to v2. However, each editable field retains its immediately prior value in session/browser state, allowing a single-level "undo last edit" per field. This undo is not persisted across page reloads and is not a substitute for version history; it exists specifically to reduce the risk of an accidental, unrecoverable edit. |
| FR-20 | Low-confidence output is flagged at the section level (not per-field) with a visible banner: "This section may be less accurate — transcript was short, malformed, or lacked clear structure." Note: this is distinct from the non-English gate in FR-3b, which runs before processing rather than flagging after. |

### 5.4 Export

| ID | Requirement |
|---|---|
| FR-21 | User can export the full insight report as PDF, formatted with section headers matching the six output types. **[FIXED — Lapse 2]** See FR-24 for the revised generation mechanism. |
| FR-22 | User can export as Markdown, one `.md` file with `##` headers per section. |
| FR-23 | Exports reflect current edited state, not original AI output. |
| FR-24 | **[FIXED — Lapse 2]** Markdown export is synchronous and generated on-demand directly in the API route handler (pure string formatting, no rendering engine), target under 5 seconds. PDF export is generated asynchronously via the same worker process used for AI pipeline jobs, not inline in a serverless route handler, to avoid serverless execution time and memory limits. The export API route enqueues a lightweight export job (using the `ProcessingJob`-style pattern, see Section 10) and the frontend polls for completion, then streams/downloads the result. PDF export target: typically 15–30 seconds, with a visible loading/progress state shown to the user rather than a blocking spinner implying near-instant completion. |

### 5.5 Account and Usage

| ID | Requirement |
|---|---|
| FR-25 | User signs up via email/password or Google OAuth. |
| FR-26 | Free tier: 3 transcripts/month, reset on calendar month. Paid tier: 50 transcripts/month at a fixed price point. **[FIXED — Lapse 3]** Pricing must be modeled against the worst-case cost scenario — 50 transcripts/month at the 50,000-word cap each — not an average-case transcript assumption, to ensure margin holds under maximum legitimate usage. See Section 14 Open Questions for the unresolved question of whether a word-budget-based cap should replace or supplement the flat transcript count. |
| FR-27 | Usage counter is visible on the dashboard at all times: "X of Y transcripts used this month." |
| FR-28 | When free tier limit is reached, upload is blocked with an upgrade prompt; no partial processing occurs. |
| FR-28b | **[NEW — Lapse 7]** `UsageRecord.transcriptsUsed` increments by 1 at transcript creation (upload/paste submission), inside the same database transaction that creates the `Transcript` row and checks the tier cap (see Section 7 API design). It does not increment again on retry. Manual retries of an existing transcript's failed job (per FR-10) act on the same `Transcript` record and never count as additional usage, since usage is tied to distinct `Transcript` records, not job attempts. |
| FR-29 | User can permanently delete a transcript and all derived insights. Deletion removes the S3 object and cascades in Postgres. **[FIXED — Lapse 1]** Cascade behavior is now explicitly defined in the Prisma schema (Section 10) via `onDelete: Cascade` on all transcript-owned child records. Deletion is irreversible and stated as such in a confirmation dialog. |
| FR-30 | User can delete their account, which deletes all transcripts, insights, and account data within 30 days [ASSUMPTION: 30-day window is a common compliance-safe default; exact number is a legal/ops decision — see Open Questions]. **[FIXED — Lapse 13]** On account deletion, all active sessions for the user are invalidated immediately by adding the user ID to a short-lived deny-list checked at the API middleware layer, regardless of remaining JWT expiry. This prevents a deleted account from continuing to make authenticated requests until natural token expiry. |

## 6. AI Processing Pipeline

**Step 1 — Input Handling**
- Extracted transcript text is normalized: strip excess whitespace, normalize line endings, collapse timestamp artifacts left over from `.srt`/`.vtt` parsing.
- **[FIXED — Lapse 4]** A language-detection check (FR-3b) runs at this stage, before chunking. Non-English transcripts are flagged and gated at the UI level; processing does not proceed automatically.
- Text is split into paragraphs using existing line breaks or, if absent, using a sentence-boundary heuristic (split every ~5 sentences) to create paragraph structure for chunking.

**Step 2 — Chunking Strategy**
- Transcript is split into chunks of ~3,000 words with 300-word overlap between consecutive chunks, to preserve context across chunk boundaries.
- A 50,000-word transcript produces roughly 18 chunks.
- Each chunk retains its original character offset range, used later to trace quotes back to source text **and, per the fix below, to flag likely duplicate candidates from overlap regions.**

**Step 3 — Extraction (per chunk)**
- Each chunk is sent to Claude with a structured extraction prompt requesting a JSON object containing: candidate themes, candidate pain points, candidate quotes (verbatim, with offset), candidate action items, for that chunk only.
- Output is validated against a JSON schema. **[FIXED — Lapse 8]** If a chunk's response fails schema validation, the failure is classified as either `transient` (timeout, rate limit, 5xx server error) or `deterministic` (schema validation failure, unparseable JSON, same input producing the same failure). Transient failures are retried per the standard backoff policy (see Error Handling below). Deterministic failures are retried at most once with an adjusted prompt (explicit instruction to return valid JSON only, reduced temperature); if still failing, that chunk is marked permanently `failed` for this attempt without consuming further retry budget.
- Extraction calls run with bounded concurrency (max 5 concurrent chunk calls per transcript) to manage rate limits and cost.

**Step 4 — Synthesis**
- All chunk-level extraction results are merged into a single payload.
- **[FIXED — Lapse 11]** If the merged candidate payload (themes + pain points + quotes + action items across all chunks) exceeds approximately 15,000 tokens, a pre-synthesis batch-dedup pass runs first: chunks are grouped into batches of ~6, each batch is deduplicated independently, and the reduced outputs from each batch are then merged into the final synthesis call. This keeps the final synthesis call's input bounded regardless of transcript length.
- **[FIXED — Lapse 12]** Because chunk overlap (Step 2) can cause the same source text to generate near-duplicate candidates from adjacent chunks, the merge payload includes each candidate's originating chunk offset range. Candidates whose offsets fall within a known overlap zone are explicitly flagged as likely duplicates before the LLM-based dedup pass runs, reducing reliance on semantic-only deduplication.
- A synthesis call sends the merged (and pre-deduplicated, where applicable) candidate data to Claude with a prompt to: deduplicate remaining overlapping themes, merge near-duplicate pain points, select the strongest 5–15 quotes total (each 50 words or fewer per FR-15), assign one sentiment label per final theme, assign an explicit `themeId` to each selected quote (per FR-13b), and produce the final Summary from the merged theme/pain point data.
- Synthesis output is validated against the final output JSON schema (matching the six-section structure in Section 5.3).

**Step 5 — Output Structuring**
- Validated synthesis output is written to Postgres as structured rows (see Section 10 data model), not as a single JSON blob, so each theme/quote/action item is independently editable and queryable.
- Quotes are matched back to original transcript offsets to enable "jump to source" functionality (v2 feature, offsets stored in v1 for forward compatibility).

**Worked Latency Estimate [NEW — Lapse 14]**

For a 50,000-word transcript (~18 chunks, max 5 concurrent):
- Extraction: 18 chunks ÷ 5 concurrency ≈ 4 sequential batches, at an estimated ~15–20 seconds per Claude call for a 3,000-word chunk with structured JSON output ≈ 60–80 seconds total, plus retry overhead for any transient/deterministic failures.
- Pre-synthesis batch dedup (if triggered): 3 batches of 6 chunks, run largely in parallel ≈ 15–25 seconds.
- Final synthesis call on the reduced payload ≈ 20–40 seconds.
- Estimated total: roughly 2–3 minutes under ideal conditions, before accounting for queue wait time, retries, or Claude API latency variance.
- **This is a directional estimate, not a validated number.** FR-9's stated 8-minute target for 50k-word transcripts includes margin for retries, queueing, and latency variance, but must be confirmed via real load testing (Section 14) before being treated as reliable.

**Error Handling**
- Per-chunk extraction failure: chunk is marked `failed` (with `transient`/`deterministic` classification per Step 3), and synthesis proceeds using only successfully extracted chunks. If more than 30% of chunks fail, the entire job is marked `failed` (not partially completed) and queued for full retry.
- Full job retry: up to 3 attempts, exponential backoff (1min, 5min, 15min), applied only to `transient`-classified failures at the job level. After 3 failed attempts, job status becomes `failed` permanently and is surfaced to the user with a manual retry option (which, per FR-10, retries only the failed chunks, not the full job, unless the >30% threshold is hit again).
- Synthesis-step failure: retried up to 2 times with the same merged input before failing the job.
- **[FIXED — Lapse 8]** If a job's failures are classified as `deterministic` (e.g., consistently malformed transcript encoding), the job fails fast after the single adjusted-prompt retry described in Step 3, rather than consuming the full 3-attempt/21-minute retry budget. The user-facing failure message in this case specifically states: "This transcript may have formatting issues we can't process" rather than a generic failure message.
- Malformed/low-signal transcript (e.g., under 200 words, or extraction returns fewer than 2 themes): job still completes, but result is flagged `low_confidence` at the transcript level, and the low-confidence banner (FR-20) is shown on all sections.
- All pipeline steps are logged with a `job_id`, chunk index, latency, token count, and failure classification (`transient`/`deterministic`) for observability and cost tracking.

## 7. Technical Requirements

**Architecture**
- Next.js app (App Router) handles both frontend (React Server Components + client components for editable fields) and backend (API routes / route handlers).
- Background processing runs via a job queue: a Postgres-backed `ProcessingJob` table polled by a worker process. **[FIXED — Lapse 5]** The worker polls every 5 seconds. Job claiming uses `SELECT ... FOR UPDATE SKIP LOCKED` via a Prisma raw query (`$queryRaw`), since Prisma's query builder doesn't natively support row-locking semantics, to atomically claim a `QUEUED` job and prevent duplicate processing if multiple worker instances run concurrently. [ASSUMPTION] A single worker instance is expected to be sufficient for v1 volume; the locking mechanism is built in now specifically to avoid a rework later, but horizontal worker scaling itself remains a v2+ concern.
- Worker process(es) run separately from the Next.js web process, polling `ProcessingJob` rows and calling the Anthropic API per Section 6.
- **[FIXED — Lapse 2]** PDF export generation also runs via the worker process (reusing the same job queue infrastructure), not inline in a Next.js API route, since PDF rendering is too slow/memory-heavy for a serverless function with tight execution limits.

**API Design**
- REST-style route handlers under `/api/`:
  - `POST /api/transcripts` — create transcript record, upload file to S3, check tier usage cap, increment `UsageRecord` (FR-28b), and enqueue processing job, all within a single transaction.
  - `GET /api/transcripts/:id` — fetch transcript + current insight state + job status.
  - `PATCH /api/transcripts/:id/insights/:sectionType/:itemId` — edit a single insight field (theme, pain point, quote, action item).
  - `POST /api/transcripts/:id/retry` — manually re-enqueue a failed job; retries only failed chunks per FR-10.
  - `DELETE /api/transcripts/:id` — delete transcript; cascade delete now handled at the database level via Prisma schema `onDelete: Cascade` (Section 10), plus deletion of the S3 object.
  - `GET /api/transcripts/:id/export?format=md` — synchronous Markdown export, string formatting only.
  - `POST /api/transcripts/:id/export?format=pdf` — enqueues an async PDF export job; returns a job ID.
  - `GET /api/exports/:jobId` — polls PDF export job status; returns a download URL on completion.
  - `GET /api/usage` — return current usage count and tier limit for the logged-in user.

**File Storage**
- Raw uploaded files stored in S3-compatible bucket, path pattern `transcripts/{userId}/{transcriptId}/original.{ext}`.
- Extracted plain text stored directly in Postgres (`Transcript.extractedText`), not in object storage, since it's queried and processed repeatedly.
- Generated PDF exports are generated on-demand via the worker process and not persisted long-term in v1; generated files are written to a temporary S3 path with a short TTL (e.g., 1 hour) to support the download link, then cleaned up.

**Auth**
- Email/password via credential hashing (bcrypt) and Google OAuth, both via NextAuth.js (Auth.js) configured with a Prisma adapter against the same Postgres database.
- Session-based auth using JWT sessions (stateless, suited to serverless/edge deployment).
- **[FIXED — Lapse 13]** A short-lived server-side deny-list (e.g., a Postgres table or Redis set keyed by user ID) is checked at the API middleware layer on every authenticated request. On account deletion, the user's ID is added to this deny-list immediately, invalidating all active sessions regardless of JWT expiry.

**Hosting/Infra Assumptions**
- Next.js app deployed on Vercel or equivalent Next.js-compatible host. [ASSUMPTION] Not specified in the brief; Vercel is the default deployment target for Next.js and is assumed for concreteness.
- Worker process deployed separately (e.g., a small container service) since long-running AI pipeline jobs (and now PDF export jobs) exceed typical serverless function time limits.
- Postgres hosted on a managed provider (e.g., RDS, Supabase, Neon) — specific vendor not decided (see Open Questions).
- S3-compatible storage via AWS S3 or equivalent (e.g., Cloudflare R2).

**Encryption**
- Data encrypted at rest via provider-level encryption (S3 default encryption, Postgres disk encryption via managed provider).
- No application-level field encryption in v1 beyond provider defaults. [ASSUMPTION] The brief states "encrypted at rest" without specifying application-layer encryption; provider-level encryption satisfies this requirement at lower engineering cost.

## 8. Business Model

- Freemium model, single-user payer.
- Free tier: 3 transcripts/month.
- Paid tier: 50 transcripts/month, flat monthly subscription price. **[FIXED — Lapse 3]** Price point must be derived from worst-case cost modeling (50 × 50,000-word transcripts/month), not an average-case assumption, to protect margin under maximum legitimate usage. See Open Questions for the unresolved question of whether a word-budget cap should supplement the flat count.
- Billing via Stripe (subscription mode), integrated at the user level. [ASSUMPTION] Stripe is the de facto standard for individual-payer SaaS subscriptions; not specified in the brief but needed to make billing concrete.
- Overage handling: no pay-per-transcript overage in v1 — user is blocked and prompted to upgrade once the tier cap is hit (per FR-28).
- **[FIXED — Lapse: framing]** No annual billing plan in v1; monthly only. This simplifies initial billing logic, but it also defers the cash-flow predictability and lower-churn benefits typically associated with annual commitments — this is an acceptable v1 trade-off, not a cost-free simplification, and should be revisited once monthly retention data exists.

## 9. Risks

| Risk | Type | Mitigation |
|---|---|---|
| AI extraction produces inaccurate or hallucinated quotes (text not actually in transcript) | Technical | Validate every extracted quote by exact substring match against source text post-extraction; discard/flag any quote that doesn't match verbatim before it reaches synthesis. Overflow/mismatch handling defined in FR-15. |
| Long transcripts (50k words) hit API rate limits or high latency, degrading UX | Technical | Bounded concurrency (max 5 parallel chunk calls), exponential backoff retries, transient/deterministic failure classification (Section 6), and clear async status UI so users aren't blocked waiting. |
| Users don't trust AI-generated insights enough to rely on them for decisions | Product | **[FIXED — Lapse: mitigation was aspirational, not measured]** Full inline editability, quote traceability, and low-confidence flagging reduce the cost of AI errors but do not by themselves guarantee trust. Trust is measured post-launch via the Edit Rate metric (Section 11): if edit rate exceeds 30% sustained over a month, this is treated as a quality signal requiring extraction/synthesis prompt revision, not just a UX observation. |
| Free tier is too generous, cannibalizing paid conversions | Business | Start with a conservative 3/month cap; monitor conversion rate (denominator defined in Section 11) and adjust cap based on real usage data post-launch. |
| Anthropic API cost scales faster than subscription revenue at high transcript volume | Business | **[FIXED — Lapse 3]** Paid tier pricing modeled against worst-case usage (50 × 50k-word transcripts/month), not average-case, per Section 8. Token cost per transcript tracked in job logs (Section 6). Open question remains on whether a word-budget cap should supplement transcript-count caps (Section 14). |
| Sensitive interview content (PII, confidential business info) stored insecurely | Technical/Business | Encryption at rest (Section 7), explicit no-training-on-user-data policy, user-initiated deletion with database-level cascade (FR-29, Section 10) and immediate session invalidation (FR-30). |
| Malformed or non-English transcripts silently produce garbage output | Product | **[FIXED — Lapse 4]** Non-English input is now caught by a pre-pipeline language-detection gate (FR-3b) before any processing cost is incurred, rather than relying solely on post-hoc low-confidence flagging. |
| **[NEW]** Chunk overlap produces duplicate candidate insights | Technical | Offset-based duplicate flagging pre-synthesis (Section 6, Step 4); monitored via a QA metric comparing theme count post-dedup vs pre-dedup ratio during internal testing. |
| **[NEW]** Concurrent workers double-process the same job | Technical | `SELECT ... FOR UPDATE SKIP LOCKED` job claiming (Section 7) ensures only one worker instance can claim a given job. |

## 10. Prisma Data Model

**[FIXED — Lapse 1]** All relations pointing to `Transcript` now specify `onDelete: Cascade`. Relations from child insight records to `Theme` via optional `themeId` now specify `onDelete: SetNull`, since deleting a theme should not delete the pain points/quotes/action items that reference it — they should simply lose the theme link.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum SubscriptionTier {
  FREE
  PAID
}

enum JobStatus {
  QUEUED
  PROCESSING
  COMPLETE
  FAILED
}

enum JobFailureType {
  TRANSIENT
  DETERMINISTIC
}

enum Severity {
  LOW
  MEDIUM
  HIGH
}

enum Sentiment {
  POSITIVE
  NEUTRAL
  NEGATIVE
  MIXED
}

enum TranscriptSourceType {
  PASTE
  TXT
  DOCX
  SRT
  VTT
}

enum ExportFormat {
  PDF
  MARKDOWN
}

enum ExportJobStatus {
  QUEUED
  PROCESSING
  COMPLETE
  FAILED
}

model User {
  id                String        @id @default(cuid())
  email             String        @unique
  passwordHash      String?
  googleId          String?       @unique
  createdAt         DateTime      @default(now())
  deletedAt         DateTime?
  subscriptionTier  SubscriptionTier @default(FREE)
  stripeCustomerId  String?       @unique

  // [ASSUMPTION] organizationId is nullable now to support future team accounts
  // without a breaking schema change, per the brief's data model requirement.
  organizationId    String?
  organization      Organization? @relation(fields: [organizationId], references: [id])

  transcripts       Transcript[]
  usageRecords      UsageRecord[]
  exportJobs        ExportJob[]
}

model Organization {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())
  members   User[]
}

model Transcript {
  id              String               @id @default(cuid())
  userId          String
  user            User                 @relation(fields: [userId], references: [id])
  title           String
  interviewDate   DateTime?
  interviewee     String?
  tags            String[]
  // [ASSUMPTION] Tags stored as a plain string array, not a normalized Tag
  // model, since no tag search/filter/analytics requirement exists in v1
  // scope. Revisit if v2 adds cross-transcript search.
  sourceType      TranscriptSourceType
  originalFileKey String?              // S3 object key, null if pasted text
  extractedText   String               // full plain text, stored in Postgres
  wordCount       Int
  detectedLanguage String?             // [NEW] populated by FR-3b language check
  isNonEnglish    Boolean              @default(false) // [NEW] FR-3b gate flag
  isLowConfidence Boolean              @default(false)
  createdAt       DateTime             @default(now())
  deletedAt       DateTime?

  processingJobs  ProcessingJob[]
  exportJobs      ExportJob[]
  summary         Summary?
  themes          Theme[]
  painPoints      PainPoint[]
  quotes          Quote[]
  actionItems     ActionItem[]
}

model ProcessingJob {
  id             String         @id @default(cuid())
  transcriptId   String
  transcript     Transcript     @relation(fields: [transcriptId], references: [id], onDelete: Cascade)
  status         JobStatus      @default(QUEUED)
  attemptCount   Int            @default(0)
  lastError      String?
  lastFailureType JobFailureType?  // [NEW] transient vs deterministic classification
  chunkCount     Int?
  failedChunks   Int            @default(0)
  claimedAt      DateTime?      // [NEW] set when a worker claims via SKIP LOCKED
  createdAt      DateTime       @default(now())
  startedAt      DateTime?
  completedAt    DateTime?
}

model ExportJob {
  // [NEW] Supports async PDF export (Lapse 2 fix); Markdown export
  // remains synchronous and does not use this model.
  id           String          @id @default(cuid())
  transcriptId String
  transcript   Transcript      @relation(fields: [transcriptId], references: [id], onDelete: Cascade)
  userId       String
  user         User            @relation(fields: [userId], references: [id])
  format       ExportFormat
  status       ExportJobStatus @default(QUEUED)
  resultFileKey String?        // temporary S3 key, short TTL
  createdAt    DateTime        @default(now())
  completedAt  DateTime?
}

model Summary {
  id           String     @id @default(cuid())
  transcriptId String     @unique
  transcript   Transcript @relation(fields: [transcriptId], references: [id], onDelete: Cascade)
  content      String
  editedAt     DateTime?
}

model Theme {
  id              String       @id @default(cuid())
  transcriptId    String
  transcript      Transcript   @relation(fields: [transcriptId], references: [id], onDelete: Cascade)
  title           String
  description     String
  sentiment       Sentiment
  sentimentReason String
  editedAt        DateTime?
  createdAt       DateTime     @default(now())

  quotes          Quote[]
  painPoints      PainPoint[]
  actionItems     ActionItem[]
}

model PainPoint {
  id           String     @id @default(cuid())
  transcriptId String
  transcript   Transcript @relation(fields: [transcriptId], references: [id], onDelete: Cascade)
  themeId      String?
  theme        Theme?     @relation(fields: [themeId], references: [id], onDelete: SetNull)
  title        String
  description  String
  severity     Severity
  editedAt     DateTime?
  createdAt    DateTime   @default(now())
}

model Quote {
  id                String     @id @default(cuid())
  transcriptId      String
  transcript        Transcript @relation(fields: [transcriptId], references: [id], onDelete: Cascade)
  themeId           String?
  theme             Theme?     @relation(fields: [themeId], references: [id], onDelete: SetNull)
  text              String
  speakerLabel      String?
  sourceOffsetStart Int?
  sourceOffsetEnd   Int?
  wasTruncated      Boolean    @default(false) // [NEW] FR-15 overflow handling flag
  editedAt          DateTime?
  createdAt         DateTime   @default(now())
}

model ActionItem {
  id           String     @id @default(cuid())
  transcriptId String
  transcript   Transcript @relation(fields: [transcriptId], references: [id], onDelete: Cascade)
  themeId      String?
  theme        Theme?     @relation(fields: [themeId], references: [id], onDelete: SetNull)
  description  String
  editedAt     DateTime?
  createdAt    DateTime   @default(now())
}

model UsageRecord {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  periodStart     DateTime
  periodEnd       DateTime
  transcriptsUsed Int      @default(0)
  // [NEW] Incremented at Transcript creation only (FR-28b); retries never
  // increment this again, since usage is tied to distinct Transcript rows.

  @@unique([userId, periodStart])
}
```

## 11. Success Metrics

| Metric | Target | Measurement Window |
|---|---|---|
| Time-to-insight (upload to complete output) | Under 3 min median for transcripts ≤10k words | Ongoing, per job — treated as directional until load-tested (see Section 14) |
| Processing success rate (jobs reaching `complete` without manual retry) | ≥ 95% | Weekly |
| Free-to-paid conversion rate | ≥ 5% of users who complete at least one transcript upload convert within 60 days | **[FIXED — Lapse 15]** Denominator explicitly defined as uploaders, not all signups. | Monthly cohort |
| Weekly active uploader retention | ≥ 40% of users who upload in week 1 upload again in week 4 | **[FIXED — Lapse 16]** No re-engagement feature (email nudges, notifications) exists in v1 to actively drive this number. This is a monitoring-only metric until a v2 retention feature is scoped; it should not be treated as a target the current feature set is expected to hit. | 4-week cohort |
| Edit rate on AI output (proxy for output quality) | Under 30% of generated fields edited by user | Per transcript, aggregated monthly — cross-referenced with the trust-risk mitigation in Section 9 |
| Export usage | ≥ 50% of completed transcripts are exported at least once | Monthly |
| Low-confidence flag rate | Under 10% of all processed transcripts | Monthly |
| **[NEW]** Non-English detection rate | Tracked, no target set in v1 | Monthly — informs whether v2 language support is worth prioritizing |
| **[NEW]** Chunk-overlap dedup effectiveness | Post-dedup theme count should not exceed pre-dedup candidate count by more than ~2x on average | Weekly, internal QA metric only |

## 12. Assumptions

Confirmed assumptions (provided, treated as fact):
- Primary users are UX researchers, PMs, customer-facing teams.
- v1 single-user; data model supports future team accounts.
- Input formats: paste, `.txt`, `.docx`, `.srt`, `.vtt`. No PDF or audio in v1.
- Speaker labels optional.
- Max 50,000 words in v1.
- English only in v1 for processing (detection of non-English is now a v1 guardrail, per FR-3b).
- Six output types, all user-editable.
- Export as PDF and Markdown.
- Multi-step AI pipeline (chunk, extract, synthesize) with retry logic.
- LLM provider: Anthropic Claude via API.
- Freemium model, usage cap on free tier, paid tier for volume.
- Individual payer in v1; org billing later.
- Encryption at rest, user-initiated deletion, no training on user data.
- File storage in S3-compatible object storage.
- Auth: email/password + Google OAuth.
- Low-confidence flagging for malformed transcripts; failed jobs queued and retried with visible failure state.

Additional assumptions from the original PRD ([ASSUMPTION] tags):
- 30-day account deletion window (FR-30).
- Quote source offsets stored in v1 for forward-compatible "jump to source" in v2.
- Processing queue implemented as a Postgres-backed job table, not a specific external queue vendor.
- Vercel assumed as default Next.js hosting target.
- Provider-level encryption (not app-layer field encryption) satisfies the "encrypted at rest" requirement.
- Stripe assumed as billing provider.
- Monthly billing only in v1, no annual plan (now explicitly framed as a trade-off, not a free simplification — Section 8).
- `organizationId` added as nullable field on `User` now, to avoid a breaking migration when team accounts ship.
- Tags stored as a plain string array, not a normalized model, since no v1 search/filter requirement exists.

New assumptions introduced by this revision:
- **[NEW]** Language detection uses a lightweight library or a fast Claude call; exact tool choice deferred to implementation (Section 14 open question).
- **[NEW]** Single worker instance is sufficient for v1 volume; `SKIP LOCKED` locking is built in now to avoid rework later, but horizontal scaling of workers is a v2+ concern.
- **[NEW]** PDF export files are stored temporarily in S3 with a short TTL (assumed 1 hour) rather than persisted indefinitely, since exports are regenerated on demand.
- **[NEW]** The 15,000-token threshold for triggering pre-synthesis batch dedup is a starting estimate, not empirically validated; it should be tuned after observing real synthesis payload sizes in production.

## 13. Phased Roadmap

**v1 (this PRD's scope):**
- Single-user accounts, email/password + Google OAuth, with session deny-list on account deletion.
- Paste and file upload (.txt, .docx, .srt, .vtt), 50k word cap with two-pass word-count validation.
- Pre-pipeline non-English detection gate.
- Full AI pipeline: chunk, extract, synthesize, with chunk-level retry, transient/deterministic failure classification, offset-based dedup for overlapping candidates, and low-confidence flagging.
- Six insight output types, fully editable, with explicit theme-to-quote linkage and single-level per-field undo.
- Markdown export (synchronous) and PDF export (async via worker queue).
- Freemium billing (Stripe), free tier cap, single paid tier priced against worst-case usage.
- Manual chunk-level retry for failed jobs.
- Cascade-safe deletion (transcript and account level).
- Concurrency-safe job queue (`SKIP LOCKED`).

**v2:**
- Team/org accounts with shared transcript libraries and role-based permissions (viewer/editor).
- "Jump to source" — click a quote, jump to its location in the original transcript (offsets already stored in v1).
- Multi-version edit history (beyond the v1 single-level undo).
- Language detection expansion to actual non-English *processing* support (not just detection), if usage data (Section 11 non-English detection rate) justifies it.
- Additional export format: DOCX.
- Org-level billing and seat management.
- Re-engagement features (email nudges) to actively support the retention metric in Section 11.
- Word-budget-based usage caps, if the flat transcript-count model proves cost-risky in production (Section 14).

**v3:**
- Audio/video upload with built-in transcription (removing the "text-only" constraint).
- PDF transcript input support.
- Cross-transcript analysis (theme trends across multiple interviews over time).
- Integrations (Notion, Slack, CRM export).
- Custom prompt/template configuration for extraction (e.g., industry-specific pain point taxonomies).
- Dedicated objection-tracking taxonomy for the CS/Sales persona (Section 4), separate from generic Pain Points.

## 14. Open Questions

- What is the exact price point for the paid tier? Needs cost-per-transcript modeling from real Claude API usage, specifically against the worst-case 50×50k-word scenario (Section 8), before finalizing.
- Should a word-budget-based usage cap (e.g., total monthly word allowance) replace or supplement the flat transcript-count cap, to prevent cost blowout from long-transcript-heavy users?
- Which Postgres hosting provider (RDS, Supabase, Neon, etc.)? Affects connection pooling strategy with Prisma.
- Is a Postgres-polling job queue (current v1 approach, with `SKIP LOCKED`) sufficient at expected v1 volume, or should a managed queue (e.g., SQS, BullMQ + Redis) be used instead? Revisit once real job volume is known.
- Should low-confidence flagging block export, or just warn? Currently assumed to only warn (not block).
- Is there a legal/compliance requirement (e.g., GDPR, CCPA) that changes the 30-day account deletion window or requires a formal Data Processing Agreement with Anthropic?
- Should free-tier users get all six output types, or a reduced set, to drive upgrades? Currently assumed full feature parity across tiers, gated only by transcript count.
- Does `.docx` extraction need to preserve any formatting (bold/highlights users may have added to mark key moments), or is plain text extraction sufficient? Currently assumed plain text only.
- **[NEW]** What tool/library will perform language detection (FR-3b) — a dedicated library (e.g., langdetect) or a fast dedicated Claude call? Needs a cost/accuracy trade-off decision before implementation.
- **[NEW]** Is the pre-launch manual-synthesis timing study (below) feasible before the committed launch date, or does the goal in Section 3 need to ship without that validation and be corrected post-launch?

**Pre-launch validation task (not a build task, but a blocking action item):**
- Run a timing study with 5–10 target users (mix of UX researchers, PMs, CS/Sales) measuring actual time spent manually synthesizing a real interview transcript. Use this to either support or revise any future "time saved" marketing claim. This does not block v1 engineering work, but should block any marketing copy that makes a comparative speed claim.
