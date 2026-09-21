# **AGENTS.md**

## **1\. What is this project?**

You are building **Interview Insights App v1**, a web application that turns raw interview transcripts into structured, editable insight reports.

The primary users are:

* UX Researchers  
* Product Managers  
* Customer-facing teams such as Customer Success and Sales

The application accepts pasted or uploaded text transcripts, processes them through an asynchronous AI pipeline, and produces exactly six editable insight sections:

1. Summary  
2. Key Themes  
3. Pain Points  
4. Notable Quotes  
5. Action Items  
6. Sentiment per Theme

The v1 product is **single-user**. Do not build team collaboration, shared workspaces, role-based permissions, or other future-phase functionality.

The authoritative product specification is the **PRD for Interview Insights App v2 — Post-Review Revision** supplied with this project. Treat that PRD as the source of truth for product requirements and business behavior.

When this file and the PRD appear to conflict, follow this file for engineering behavior and constraints, while treating the PRD as the source of product requirements. Do not silently invent a resolution for an unresolved product question.

**Build only v1.**

Do not implement v2 or v3 roadmap features unless the user explicitly authorizes them as a new scope.

---

## **2\. What is locked?**

The following technical choices are locked. Do not replace, swap, abstract away, "improve," or introduce an alternative implementation for any of them without explicit authorization.

### **Application stack**

Use:

* **Next.js**  
* **TypeScript**  
* **React**  
* **Next.js App Router**  
* **Prisma**  
* **PostgreSQL**  
* **Anthropic Claude API**  
* **NextAuth.js / Auth.js**  
* **bcrypt** for credential password hashing  
* **S3-compatible object storage**  
* **Postgres-backed processing jobs**  
* A separate worker process for long-running processing  
* **Flutterwave** for paid subscription billing

Do not replace Claude with another LLM provider.

Do not replace Prisma with another ORM.

Do not replace PostgreSQL with another database.

Do not replace Auth.js/NextAuth.js with another authentication framework.

Do not replace the Postgres-backed job queue with a different queue implementation unless explicitly authorized.

Do not replace Flutterwave with Stripe, PayPal, Paddle, Lemon Squeezy, or another billing provider.

The PRD originally mentions Stripe as an assumption. **Flutterwave is the authoritative billing-provider choice for this implementation.**

### **Database**

Use PostgreSQL with Prisma.

Use the Prisma data model defined by the PRD as the baseline schema.

Preserve the following model structure and relationships:

* `User`  
* `Organization`  
* `Transcript`  
* `ProcessingJob`  
* `ExportJob`  
* `Summary`  
* `Theme`  
* `PainPoint`  
* `Quote`  
* `ActionItem`  
* `UsageRecord`

Preserve the enums defined by the PRD, including:

* `SubscriptionTier`  
* `JobStatus`  
* `JobFailureType`  
* `Severity`  
* `Sentiment`  
* `TranscriptSourceType`  
* `ExportFormat`  
* `ExportJobStatus`

Do not normalize, denormalize, rename, remove, or replace these structures merely because another schema appears cleaner.

Preserve the required deletion behavior:

* Transcript-owned records use `onDelete: Cascade`.  
* `PainPoint.themeId`, `Quote.themeId`, and `ActionItem.themeId` use `onDelete: SetNull`.

Preserve the unique constraints and relationships defined by the PRD.

### **Hosting and infrastructure**

The PRD assumes Vercel or an equivalent Next.js-compatible host for the web application and a separately deployed worker for long-running jobs.

Do not move background processing into the Next.js request lifecycle.

The worker must remain separate from the Next.js web process.

The exact managed PostgreSQL vendor and S3-compatible provider remain unresolved in the PRD. Do not invent a provider and treat it as a product requirement. If implementation requires choosing one, surface the decision rather than silently changing scope.

---

## **3\. What must never happen?**

Breaking any rule in this section means **the task has failed, even if the application builds, runs, or appears to work.**

### **Product scope**

* Build only the v1 scope.  
* Never implement v2 features as part of v1.  
* Never implement v3 features as part of v1.  
* Never add a feature simply because it appears useful.  
* Never infer that a roadmap item is approved for the current build.

The following remain out of v1:

* Team/org collaboration  
* Shared transcript libraries  
* Viewer/editor permissions  
* Real-time collaborative editing  
* Jump-to-source UI  
* Multi-version edit history  
* Non-English processing  
* DOCX export  
* Org-level billing  
* Seat management  
* Re-engagement emails  
* Word-budget billing/usage caps  
* Audio/video transcription  
* PDF transcript input  
* Cross-transcript analysis  
* Slack/Notion/CRM integrations  
* Custom AI prompts/templates  
* Dedicated sales objection taxonomy

### **Transcript input and limits**

* Enforce the **50,000-word transcript limit on both client and server**. (FR-1)  
* Accept only the v1 input types: pasted text, `.txt`, `.docx`, `.srt`, and `.vtt`. (FR-1, FR-2)  
* Never accept PDF transcript input in v1. (FR-2, v1 scope)  
* Never add audio/video transcription in v1. (v1 scope)  
* Enforce the **10 MB maximum uploaded-file size**. (FR-2)  
* Extract uploaded-file text server-side. (FR-3)  
* For `.srt` and `.vtt`, strip timestamps and cue numbers while preserving speaker labels where present. (FR-3)  
* Treat a speaker label as matching `^[A-Za-z0-9_ ]{1,40}:` at the beginning of a line.  
* Do not require speaker labels for processing. Speaker labels are optional metadata. (FR-3)  
* Do not reject a transcript solely because speaker labels cannot be detected. (FR-3)  
* Perform the raw-file-size word-count pre-check before full extraction. (FR-4)  
* If the estimated word count implies more than 75,000 words, reject the file before full extraction. (FR-4)  
* After extraction, calculate the authoritative word count.  
* Reject any transcript exceeding 50,000 words and tell the user the actual count and the 50,000-word limit. (FR-4)  
* Do not process an over-limit transcript partially.  
* Do not incur AI-processing cost for a transcript that fails the pre-pipeline language gate.

### **Language handling**

* Detect the transcript language **before chunking or AI extraction**. (FR-3b)  
* If the transcript is detected as non-English with high confidence, flag it as `non_english`.  
* Warn the user that processing quality may be poor before submission can proceed. (FR-3b)  
* Do not silently process non-English transcripts as though they were supported.  
* Do not add non-English synthesis/processing support in v1.  
* Keep non-English detection separate from post-processing low-confidence detection. They are different mechanisms. (FR-3b, FR-20)

### **Usage limits and billing**

* Enforce the free tier at **3 transcripts per calendar month**. (FR-26)  
* Enforce the paid tier at **50 transcripts per calendar month**. (FR-26)  
* Block new transcript creation when the user's tier limit has been reached. (FR-28)  
* Show an upgrade prompt when the free-tier limit is reached. (FR-28)  
* Never partially process a transcript after a usage-cap rejection. (FR-28)  
* Count usage when a distinct `Transcript` is created, not when a processing job is retried. (FR-28b)  
* Increment `UsageRecord.transcriptsUsed` exactly once for the transcript creation. (FR-28b)  
* Perform the transcript creation, usage-cap check, usage increment, and processing-job enqueue as the required transaction boundary described by the PRD. (FR-28b, API design)  
* Never charge/count a manual retry as a new transcript. (FR-28b)  
* Never introduce pay-per-transcript overage billing in v1. (Section 8\)  
* Use monthly billing only in v1. (Section 8\)  
* Use **Flutterwave** for paid subscription billing.  
* Do not silently introduce annual billing.  
* Model paid-tier economics against the worst-case legitimate usage scenario of **50 transcripts × 50,000 words** before finalizing a production price. (FR-26, Section 8\)  
* Do not make pricing claims based on average transcript size when the pricing decision is explicitly required to consider worst-case legitimate usage.

### **Authentication and account security**

* Support email/password authentication. (FR-25)  
* Support Google OAuth. (FR-25)  
* Hash credential passwords with bcrypt. (Section 7\)  
* Use JWT-based session handling through Auth.js/NextAuth.js. (Section 7\)  
* Check the server-side account-deletion deny-list on every authenticated API request. (FR-30)  
* Immediately invalidate active sessions when an account is deleted by adding the user's ID to the short-lived deny-list. (FR-30)  
* Do not rely on JWT natural expiry to invalidate a deleted account. (FR-30)  
* Never allow a deleted account to continue making authenticated API requests merely because an old JWT has not expired.

### **Data deletion and privacy**

* Allow users to permanently delete individual transcripts. (FR-29)  
* Treat transcript deletion as irreversible.  
* Require an explicit confirmation before irreversible transcript deletion. (FR-29)  
* Delete the transcript's S3 object when the transcript is deleted. (FR-29)  
* Cascade transcript-owned database records through PostgreSQL/Prisma relationships. (FR-29)  
* Allow users to delete their account. (FR-30)  
* Delete the user's transcripts, insights, and account data within the defined account-deletion window. (FR-30)  
* Preserve immediate session invalidation when account deletion begins. (FR-30)  
* Encrypt stored data at rest using provider-level encryption. (Section 7\)  
* Do not introduce application-level field encryption as an unsolicited architectural change to v1.  
* Do not use user data to train AI models. (Section 9 / assumptions)  
* Do not persist generated PDF exports indefinitely. (Section 7\)  
* Store generated PDF exports temporarily in S3 with a short TTL and clean them up afterward. (Section 7\)

### **AI pipeline**

* Process transcripts asynchronously through the job queue. (FR-7, FR-8)  
* Persist processing status using `queued`, `processing`, `complete`, and `failed`. (FR-7)  
* Allow users to leave and return to the application without losing processing state. (FR-8)  
* Normalize transcript text before chunking. (Section 6\)  
* Strip excess whitespace and normalize line endings. (Section 6\)  
* Collapse timestamp artifacts remaining after subtitle parsing. (Section 6\)  
* Split text into paragraphs using existing line breaks or the defined sentence-boundary heuristic. (Section 6\)  
* Use approximately **3,000-word chunks with 300-word overlap**. (Section 6\)  
* Preserve original character offset ranges for every chunk. (Section 6\)  
* Never remove source offsets merely because jump-to-source is a v2 feature; v1 stores offsets for forward compatibility. (Section 6, assumptions)  
* Limit extraction concurrency to **5 chunk calls per transcript**. (Section 6\)  
* Validate every chunk extraction response against a JSON schema. (Section 6\)  
* Classify failures as `transient` or `deterministic`. (Section 6\)  
* Retry transient failures according to the defined backoff policy.  
* Retry deterministic chunk failures at most once with the adjusted prompt and reduced temperature.  
* Do not consume additional retry budget indefinitely on deterministic failures.  
* Mark a deterministically failing chunk as permanently failed for that attempt after its permitted retry. (Section 6\)  
* If more than 30% of chunks fail in one attempt, fail the entire job and queue a full retry. (FR-10, Section 6\)  
* If 30% or fewer chunks fail, allow synthesis to proceed using successfully extracted chunks. (Section 6\)  
* Retry full jobs up to 3 attempts for transient job-level failures with exponential backoff of **1 minute, 5 minutes, and 15 minutes**. (Section 6\)  
* Retry synthesis failures up to 2 times using the same merged input. (Section 6\)  
* Fail deterministic jobs fast after their permitted adjusted-prompt retry instead of consuming the full transient retry schedule. (Section 6\)  
* Use the specific user-facing formatting failure message for deterministic transcript-format failures: `This transcript may have formatting issues we can't process`. (Section 6\)  
* Never silently convert deterministic failures into generic successful output.  
* Mark malformed or low-signal transcripts as low confidence rather than pretending they are high-confidence results. (FR-20, Section 6\)  
* Treat transcripts under approximately 200 words or extraction results containing fewer than 2 themes as low-signal examples requiring `low_confidence`. (Section 6\)  
* Log every pipeline step with `job_id`, chunk index, latency, token count, and failure classification. (Section 6\)  
* Do not expose internal errors or sensitive implementation details unnecessarily in user-facing error messages.

### **Candidate deduplication and synthesis**

* Merge chunk-level extraction results before synthesis. (Section 6\)  
* Include source chunk offset ranges in the merged candidate payload. (Section 6\)  
* Explicitly flag candidates originating in known overlap zones as likely duplicates before semantic deduplication. (Section 6\)  
* If the merged candidate payload exceeds approximately **15,000 tokens**, run the required pre-synthesis batch-deduplication pass. (Section 6\)  
* Group approximately six chunks per deduplication batch when that pass is triggered. (Section 6\)  
* Run final synthesis against the reduced payload.  
* Do not allow synthesis input size to grow without bound as transcript size increases. (Section 6\)

### **Insight output**

* Produce **exactly six sections**. (FR-11)  
* Do not add a seventh output section in v1.  
* Summary must contain **150–300 words**. (FR-12)  
* Summary must be plain text and editable as one block. (FR-12)  
* Produce **3–8 Key Themes**. (FR-13)  
* Limit each theme title to **60 characters maximum**. (FR-13)  
* Give each theme a 1–3 sentence description. (FR-13)  
* Link themes to quote IDs through explicit synthesis output. (FR-13, FR-13b)  
* Include an explicit `themeId` on each selected quote when it supports a finalized theme. (FR-13b)  
* Use `themeId: null` for selected quotes that do not clearly support a finalized theme. (FR-13b)  
* Do not infer theme-to-quote relationships after synthesis when the synthesis response can provide the explicit linkage. (FR-13b)  
* Represent Pain Points with title, description, and `low`, `medium`, or `high` severity. (FR-14)  
* Represent Notable Quotes as verbatim excerpts from the transcript. (FR-15)  
* Validate every quote against the original transcript using an exact substring match before it reaches final output. (Section 9\)  
* Never present a hallucinated quote as a verbatim transcript quote.  
* Keep selected quotes at **50 words or fewer**. (FR-15)  
* If a quote exceeds 50 words after exact-substring validation, truncate only to the nearest sentence boundary under 50 words. (FR-15)  
* If no valid sentence boundary exists under 50 words, drop the quote rather than truncating it mid-sentence. (FR-15)  
* Preserve speaker labels when speaker labels exist in the source. (FR-15)  
* Represent Action Items as discrete, imperative-phrased tasks. (FR-16)  
* Allow Action Items to link to a theme or pain point. (FR-16)  
* Give every Key Theme exactly one sentiment label: `positive`, `neutral`, `negative`, or `mixed`. (FR-17)  
* Give every Key Theme a one-sentence sentiment justification. (FR-17)  
* Make every field independently editable inline. (FR-18)  
* Save edits on blur; do not require an explicit save button. (FR-18)  
* Provide only single-level per-field undo in v1. (FR-19)  
* Keep that undo state in session/browser state only.  
* Do not implement persisted multi-version edit history. (FR-19)  
* Display low-confidence warnings at the section level rather than per-field. (FR-20)  
* Use the required low-confidence banner wording: `This section may be less accurate — transcript was short, malformed, or lacked clear structure.` (FR-20)

### **Export**

* Support Markdown export. (FR-22)  
* Markdown export must contain one `.md` file.  
* Use `##` headers corresponding to the six insight sections. (FR-22)  
* Generate Markdown synchronously in the API route using pure string formatting. (FR-24)  
* Do not use a rendering engine for Markdown export. (FR-24)  
* Keep Markdown export targeted at under 5 seconds. (FR-24)  
* Support PDF export. (FR-21)  
* Generate PDF exports asynchronously through the worker. (FR-24)  
* Do not generate PDFs inline inside a serverless API route. (FR-24)  
* Return a job ID when a PDF export is requested. (API design)  
* Poll the PDF export job until completion and then provide the download URL. (API design)  
* Show visible PDF export progress/loading state rather than implying that PDF generation is instantaneous. (FR-24)  
* Ensure exports represent the user's **current edited state**, never merely the original AI output. (FR-23)  
* Keep temporary PDF files in S3 only for their short TTL.

### **API boundaries**

Implement the REST-style API routes defined by the PRD:

* `POST /api/transcripts`  
* `GET /api/transcripts/:id`  
* `PATCH /api/transcripts/:id/insights/:sectionType/:itemId`  
* `POST /api/transcripts/:id/retry`  
* `DELETE /api/transcripts/:id`  
* `GET /api/transcripts/:id/export?format=md`  
* `POST /api/transcripts/:id/export?format=pdf`  
* `GET /api/exports/:jobId`  
* `GET /api/usage`

Do not bypass these architectural boundaries by putting unrelated server behavior directly into client components.

### **Background processing**

* Keep worker processing separate from the Next.js web process. (Section 7\)  
* Poll the Postgres-backed `ProcessingJob` table every **5 seconds**. (Section 7\)  
* Claim jobs using `SELECT ... FOR UPDATE SKIP LOCKED` through Prisma `$queryRaw`. (Section 7\)  
* Use row locking to prevent two workers from processing the same job concurrently. (Section 7\)  
* Do not replace this with an application-level "check then update" race-prone implementation.  
* Run PDF generation through the same worker infrastructure. (FR-24, Section 7\)

---

## **4\. How is the work arranged?**

Use a feature-oriented structure while preserving clear separation between web/UI code, domain logic, database access, external services, and worker processing.

Use this structure unless an existing project constraint explicitly requires a compatible variation:

/  
├── AGENTS.md  
├── PRD.md  
├── package.json  
├── tsconfig.json  
├── next.config.\*  
├── prisma/  
│   ├── schema.prisma  
│   ├── migrations/  
│   └── seed.\*  
├── public/  
├── src/  
│   ├── app/  
│   │   ├── (auth)/  
│   │   ├── (dashboard)/  
│   │   ├── api/  
│   │   │   ├── transcripts/  
│   │   │   ├── exports/  
│   │   │   └── usage/  
│   │   ├── layout.tsx  
│   │   └── page.tsx  
│   ├── components/  
│   │   ├── auth/  
│   │   ├── transcripts/  
│   │   ├── insights/  
│   │   ├── exports/  
│   │   └── ui/  
│   ├── lib/  
│   │   ├── auth/  
│   │   ├── db/  
│   │   ├── storage/  
│   │   ├── billing/  
│   │   ├── ai/  
│   │   ├── transcript/  
│   │   ├── usage/  
│   │   ├── exports/  
│   │   └── validation/  
│   ├── server/  
│   │   ├── services/  
│   │   └── repositories/  
│   └── types/  
├── worker/  
│   ├── index.ts  
│   ├── jobs/  
│   │   ├── processing/  
│   │   └── exports/  
│   ├── pipeline/  
│   │   ├── normalize.ts  
│   │   ├── language.ts  
│   │   ├── chunk.ts  
│   │   ├── extract.ts  
│   │   ├── deduplicate.ts  
│   │   ├── synthesize.ts  
│   │   └── structure.ts  
│   └── services/  
└── tests/  
    ├── unit/  
    ├── integration/  
    └── e2e/

### **Architectural boundaries**

Keep these responsibilities separate:

* **UI components** render state and collect user interaction.  
* **Route handlers** authenticate, validate requests, invoke application services, and return responses.  
* **Application/domain services** contain business rules and orchestration.  
* **Repositories/data-access code** owns database interaction.  
* **AI services** own Claude API interaction and AI response validation.  
* **Storage services** own S3-compatible object-storage interaction.  
* **Billing services** own Flutterwave integration.  
* **Worker code** owns long-running processing and PDF generation.  
* **Prisma schema/migrations** own the database structure.

Do not put business rules directly into presentation components.

Do not make React components call Prisma directly.

Do not make React components call Anthropic directly.

Do not make browser code contain secret API keys.

Do not make the Next.js request lifecycle perform long-running AI processing or PDF rendering.

Do not create circular dependencies between layers.

Keep the worker executable independently from the Next.js application.

---

## **5\. How should the code look?**

Write clean, readable, modern TypeScript.

Prefer simple code over clever code.

Use the project's configured **LTS-supported runtime/tooling versions**. Do not introduce an end-of-life runtime or dependency when a maintained LTS-compatible option is available.

### **General coding rules**

* Use strict TypeScript.  
* Avoid `any` unless there is a documented and unavoidable boundary reason.  
* Give variables, functions, types, and modules precise names.  
* Keep functions small enough to understand without reconstructing hidden control flow.  
* Keep business rules explicit.  
* Prefer early validation and clear failure paths.  
* Avoid deeply nested conditionals.  
* Avoid duplicated business logic.  
* Centralize shared validation and domain rules.  
* Use typed schemas at external boundaries.  
* Validate all untrusted input.  
* Treat AI output as untrusted external input.  
* Never assume an LLM response is valid merely because the API returned successfully.  
* Use structured schemas for AI responses.  
* Handle failures explicitly.  
* Do not swallow exceptions.  
* Do not log secrets, credentials, tokens, raw authorization headers, or unnecessary sensitive transcript content.  
* Keep comments focused on explaining why a non-obvious decision exists.  
* Do not add comments that merely restate the code.  
* Do not leave TODOs for required v1 behavior.  
* Do not create speculative abstractions for features that are not in scope.

### **Database code**

* Use Prisma for normal database operations.  
* Use `$queryRaw` where PostgreSQL row-locking semantics are required by the architecture.  
* Parameterize raw queries.  
* Never construct unsafe SQL by string concatenation.  
* Use database transactions where the PRD requires atomicity.  
* Preserve foreign-key behavior.  
* Create migrations for schema changes.  
* Never manually modify production schema outside the migration strategy.

### **API code**

Every API route must:

1. Authenticate when authentication is required.  
2. Check account/session validity.  
3. Validate route parameters.  
4. Validate request bodies.  
5. Enforce authorization against the requested resource.  
6. Enforce applicable usage/business rules.  
7. Perform the operation.  
8. Return an appropriate typed response.  
9. Handle expected failures explicitly.

Never trust a transcript ID supplied by the client to imply ownership.

Never allow one user to read, modify, export, retry, or delete another user's transcript.

### **AI code**

Treat the AI pipeline as a deterministic application pipeline around a probabilistic external service.

Separate:

* normalization  
* language detection  
* chunking  
* extraction  
* validation  
* deduplication  
* synthesis  
* final validation  
* persistence

Never let raw Claude output flow directly into the database without schema validation and required transcript/quote validation.

### **UI code**

Build accessible, responsive interfaces.

Keep loading, queued, processing, complete, and failed states explicit.

Do not hide long-running work behind an indefinite spinner.

Do not make users guess whether processing succeeded.

Do not use an explicit "Save" button for inline insight editing where the PRD requires save-on-blur.

Make destructive actions visibly destructive and require confirmation where specified.

---

## **6\. What counts as done?**

A task is not done merely because the application runs.

Before declaring a task complete, verify that:

### **Requirements**

* Every requested requirement for the task has been implemented.  
* No v2 or v3 functionality was introduced.  
* All applicable PRD requirement IDs were satisfied.  
* All applicable rules in this `AGENTS.md` remain intact.  
* No business-protection rule was weakened for convenience.  
* No locked technology or service was replaced.

### **Code quality**

* TypeScript passes without errors.  
* The application builds successfully.  
* Relevant lint checks pass.  
* Relevant tests pass.  
* Database migrations are valid.  
* No secrets are committed.  
* No debugging code remains.  
* No dead code was introduced unnecessarily.  
* No unrelated refactoring was performed.

### **Security and data**

* Authentication boundaries are enforced.  
* Authorization/resource ownership is enforced.  
* Usage limits are enforced server-side.  
* Destructive operations follow the required deletion behavior.  
* AI-generated quotes are validated against source text.  
* Sensitive data is not unnecessarily exposed in logs or responses.

### **Worker and async behavior**

* Processing jobs are asynchronous.  
* Worker claiming is concurrency-safe.  
* Retry behavior matches the required failure classification.  
* PDF generation remains asynchronous.  
* Job state remains observable to the user.

### **Final response**

At the end of **every implementation task**, provide a concise completion checklist containing:

* Requirements implemented  
* PRD requirement IDs satisfied  
* Tests/checks run  
* Build status  
* Any known limitations  
* Any unresolved PRD/open-question decisions that were encountered

Do not claim a requirement is complete when it has only been partially implemented.

If the build fails, say so plainly. Do not describe the task as complete.

---

## **7\. What does the agent do when unsure?**

When unsure, **do not invent behavior**.

Do not introduce a new feature because it seems useful.

Do not expand the scope.

Do not implement a v2/v3 feature "while you're here."

Do not change a locked technology.

Do not replace an explicitly defined architecture with a preferred architecture.

Do not create a shortcut that violates a business rule merely to make the feature easier to implement.

Do not inject spaghetti code to work around uncertainty.

Do not duplicate logic in multiple places because the correct shared boundary is unclear.

Do not silently resolve an unresolved PRD question by making an irreversible product decision.

Instead:

1. Check this `AGENTS.md`.  
2. Check the PRD requirement and its requirement ID.  
3. Check the existing implementation and established project conventions.  
4. Prefer the smallest implementation that satisfies the explicitly stated requirement.  
5. Preserve existing behavior unless the requested change requires changing it.  
6. If the PRD explicitly marks a decision as unresolved, do not pretend it has already been decided.  
7. If a decision is necessary to proceed, surface the decision and use the least-assumptive implementation possible.  
8. Never trade away a stated security, privacy, financial, data-integrity, or architectural rule to avoid asking for clarification.

### **Priority order**

When making an implementation decision, use this order:

1. Explicit user instruction  
2. This `AGENTS.md`  
3. Explicit v1 requirements in the PRD  
4. Existing project constraints and established code  
5. Clearly stated PRD assumptions  
6. General engineering best practices

Never use personal preference to override a higher-priority rule.

### **Scope boundary**

The following principle is absolute:

> **Features go into tasks. Rules go into this `AGENTS.md`.**

Implement only features that are explicitly part of the authorized task and v1 scope.

Enforce every applicable rule in this document regardless of whether the feature appears to work without it.

A feature that works while violating a rule is **not complete**.  
A task that passes tests while violating a rule is **not successful**.  
A build that succeeds while violating a business, security, privacy, data, or architectural rule is **a failed implementation**.

