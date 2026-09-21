# Interview Insights App

Web application that turns raw interview transcripts into structured, editable insight reports (Summary, Key Themes, Pain Points, Notable Quotes, Action Items, Sentiment per Theme).

This README is the **complete documentation for the public REST API** served under `/api/v1/`. The authoritative specs live in `docs/AGENTS.md` and `docs/interview-insights-prd-v2.md`; the resource design and the API below are kept in lockstep with `prisma/schema.prisma`.

The unprotected `/api/*` routes are the authenticated app flow (transcript creation, exports, usage) and are out of scope for this API document.

---

## Step 1 — Resource design (API shape)

### Identifiers

Every resource uses a **generated, non-sequential identifier** (`cuid()` via Prisma) as its primary key.

Deliberately **not** sequential integers (`1, 2, 3, …`): a predictable counter lets anyone enumerate the entire dataset by counting, leaking existence and volume of records. A generated opaque ID (like `cm0abc123…`) does not reveal how many records exist or what comes next.

### Relationships (one page)

```
 USER 1 ──────── * TRANSCRIPT

 TRANSCRIPT ── (0..1) SUMMARY          one optional summary per transcript
 TRANSCRIPT ── * THEME                 transcript has many themes
 TRANSCRIPT ── * PAIN POINT            transcript has many pain points
 TRANSCRIPT ── * QUOTE                 transcript has many quotes
 TRANSCRIPT ── * ACTION ITEM           transcript has many action items

 THEME ── * PAIN POINT  (optional link, SetNull on theme delete)
 THEME ── * QUOTE       (optional link, SetNull on theme delete)
 THEME ── * ACTION ITEM (optional link, SetNull on theme delete)
```

Cardinality in words:

- A **User** owns many **Transcripts**. A Transcript belongs to exactly one User.
- A **Transcript** has at most one **Summary**, plus many **Themes**, **Pain Points**, **Quotes**, and **Action Items**. Each of those belongs to exactly one Transcript (Summary 1:1, the rest 1:N).
- A **Theme** may be referenced by many **Pain Points**, **Quotes**, and **Action Items** (optional link — `SetNull` if the Theme is deleted).
- Insights are optional children of a Theme but **required** children of a Transcript.

Deletion behavior (mandated by `docs/AGENTS.md` + PRD):

- Transcript-owned records → `onDelete: Cascade` (deleting a transcript removes its summary, themes, pain points, quotes, action items).
- `PainPoint.themeId`, `Quote.themeId`, `ActionItem.themeId` → `onDelete: SetNull` (a deleted theme never deletes insights that reference it).

### Resource: `User`

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | String (cuid) | Yes | Generated identifier |
| `email` | String | Yes | Unique |
| `passwordHash` | String | Optional | `null` for OAuth-only accounts; **never returned by the API** |
| `googleId` | String | Optional | Unique; null for password-only accounts |
| `subscriptionTier` | `FREE \| PAID` | Yes (default `FREE`) | Enum |
| `stripeCustomerId` | String | Optional | Unique; direct billing link |
| `organizationId` | String (FK → Organization) | Optional | Null until org assignment |
| `createdAt` | DateTime | Yes (default `now()`) | |
| `deletedAt` | DateTime | Optional | Soft-delete flag |

### Resource: `Transcript`

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | String (cuid) | Yes | Generated identifier |
| `userId` | String (FK → User) | Yes | Owner; every record traces to a user |
| `title` | String | Yes | Max 200 chars |
| `interviewDate` | DateTime | Optional | ISO-8601 |
| `interviewee` | String | Optional | |
| `tags` | String array | Yes (may be empty) | Postgres text array |
| `sourceType` | `PASTE \| TXT \| DOCX \| SRT \| VTT` | Yes | Enum; immutable after creation |
| `originalFileKey` | String | Optional | S3 object key; null for pasted text |
| `extractedText` | String | Yes | Raw transcript content |
| `wordCount` | Int | Yes | Computed server-side; not accepted on create |
| `detectedLanguage` | String | Optional | |
| `isNonEnglish` | Boolean | Yes (default `false`) | Language-flag |
| `isLowConfidence` | Boolean | Yes (default `false`) | AI-confidence flag |
| `createdAt` | DateTime | Yes (default `now()`) | |
| `deletedAt` | DateTime | Optional | Soft-delete flag |

### Resource: `Summary`

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | String (cuid) | Yes | Generated identifier |
| `transcriptId` | String (FK → Transcript) | Yes | Unique (one per transcript); Cascade on delete |
| `content` | String | Yes | Free-text summary |
| `editedAt` | DateTime | Optional | Tracks user edits |

### Resource: `Theme`

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | String (cuid) | Yes | Generated identifier |
| `transcriptId` | String (FK → Transcript) | Yes | Cascade on delete |
| `title` | String | Yes | Max 60 chars per PRD FR-13 |
| `description` | String | Yes | 1–3 sentence summary |
| `sentiment` | `POSITIVE \| NEUTRAL \| NEGATIVE \| MIXED` | Yes | Enum |
| `sentimentReason` | String | Yes | Justification |
| `createdAt` | DateTime | Yes (default `now()`) | |
| `editedAt` | DateTime | Optional | Tracks user edits |

### Resource: `Pain Point`

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | String (cuid) | Yes | Generated identifier |
| `transcriptId` | String (FK → Transcript) | Yes | Cascade on delete |
| `themeId` | String (FK → Theme) | Optional | `SetNull` on theme delete |
| `title` | String | Yes | |
| `description` | String | Yes | |
| `severity` | `LOW \| MEDIUM \| HIGH` | Yes | Enum |
| `createdAt` | DateTime | Yes (default `now()`) | |
| `editedAt` | DateTime | Optional | Tracks user edits |

### Resource: `Quote`

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | String (cuid) | Yes | Generated identifier |
| `transcriptId` | String (FK → Transcript) | Yes | Cascade on delete |
| `themeId` | String (FK → Theme) | Optional | `SetNull` on theme delete |
| `text` | String | Yes | ≤ 50 words; verbatim from transcript |
| `speakerLabel` | String | Optional | Only when transcript supports it |
| `sourceOffsetStart` | Int | Optional | Character offset into transcript |
| `sourceOffsetEnd` | Int | Optional | Character offset into transcript; must be ≥ `sourceOffsetStart` |
| `wasTruncated` | Boolean | Yes (default `false`) | True when truncated at a sentence boundary |
| `createdAt` | DateTime | Yes (default `now()`) | |
| `editedAt` | DateTime | Optional | Tracks user edits |

### Resource: `Action Item`

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | String (cuid) | Yes | Generated identifier |
| `transcriptId` | String (FK → Transcript) | Yes | Cascade on delete |
| `themeId` | String (FK → Theme) | Optional | `SetNull` on theme delete |
| `description` | String | Yes | Imperative-phrased task |
| `createdAt` | DateTime | Yes (default `now()`) | |
| `editedAt` | DateTime | Optional | Tracks user edits |

### Scope note

Seven resources (User, Transcript, Summary, Theme, Pain Point, Quote, Action Item) form the user-facing insight flow and are the set this API exposes. The assessment asked for 3–5; this expands to 7 so the structure is sufficient for the project's REST API requirements (the API operates on all seven, per `docs/AGENTS.md` and `prisma/schema.prisma`).

Four schema models support plumbing, not stored insight content, and are intentionally **not** exposed by the API: `Organization`, `ProcessingJob`, `ExportJob`, `UsageRecord`.

---

## Design decisions

### Why these resources were chosen

The API exposes exactly the seven resources that make up the product's stored, user-facing content: `User`, `Transcript`, `Summary`, `Theme`, `Pain Point`, `Quote`, and `Action Item`. These are the models the PRD defines for the insight flow (the schema to preserve per `docs/AGENTS.md` §2), the objects the AI pipeline produces, and the objects the UI reads and edits. Every one of them is a "noun" a client can meaningfully list, read, create, update, or delete on its own.

The four remaining schema models (`Organization`, `ProcessingJob`, `ExportJob`, `UsageRecord`) are plumbing — ownership metadata, queue state, and billing counters — surfaced through the authenticated app flow or internal to the worker, not projection data for a public REST API. Exposing them would widen the API with state a client cannot act on meaningfully.

### Why generated identifiers are used

Every primary key is a `cuid()` generated in Prisma (mandated by the PRD schema). Sequential integers were rejected:

- **No enumeration.** An opaque ID reveals nothing about how many records exist or what comes next, so a client cannot walk the whole dataset by counting, and cannot use ID gaps to infer activity or deleted rows.
- **No coordination.** Each record's ID is generated locally, so creating a record does not require a counter or lock.
- **Stable and opaque by design.** IDs are returned verbatim by the API and used directly as path parameters (`/api/v1/transcripts/:id`) with no ambiguity.

### Why offset pagination was chosen

List endpoints use **offset pagination** (`offset` + `limit`) rather than cursor pagination:

- **Simple and predictable.** A client can jump to "page N" by setting `offset`, and `meta.total` gives the full count; there is nothing to store between requests.
- **Fits the data size.** Collections here are bounded (a handful of insight rows per transcript), where deep-offset cost is negligible — the usual argument for cursors (efficient deep traversal on very large, constantly-mutating streams) does not apply.
- **Explicit trade-off.** Offset pagination lets rows shift between pages if the dataset is mutated between requests, and deep offsets are less efficient than cursors; that is accepted at this scale rather than imposing cursor ordering rules on mixed sort fields.

### What the API response envelope shape is and why

There is exactly one success shape and exactly one error shape, used by every endpoint:

- List: `{ "data": [ ... ], "meta": { "total", "limit", "offset", "hasMore" } }`
- Single resource: `{ "data": { ... } }`
- Deletion: `{ "data": { "id", "deleted": true } }`
- Error: `{ "error": { "code", "message" } }`

Rationale:

- **Stable across resources.** Clients write one parsing path instead of per-resource shapes.
- **Payload and metadata stay separate.** `meta` carries pagination facts without polluting the records, and single-item responses stay visually identical across Create/Update/Delete.
- **Errors are machine-actionable.** The `code` is a stable, documented token (`NOT_FOUND`, `VALIDATION_ERROR`, …) a client can branch on; `message` is human-readable detail. Unknown-path 404s return this same JSON envelope, not an HTML page.

---

## API reference

### Base URL and versioning

All endpoints are mounted under **`/api/v1`** and are served with `Content-Type: application/json`. In development the full URL is `http://localhost:3000/api/v1`.

Every resource follows the same five-verb pattern:

```
GET    /api/v1/<collection>       list (paged, filterable, sortable)
POST   /api/v1/<collection>       create
GET    /api/v1/<collection>/:id   read one
PATCH  /api/v1/<collection>/:id   update one
DELETE /api/v1/<collection>/:id   delete one
```

Collections: `users`, `transcripts`, `summaries`, `themes`, `pain-points`, `quotes`, `action-items`.

### Conventions shared by every endpoint

**Authentication:** none. This is a public, unauthenticated API.

**Rate limiting:** every `/api/v1` request (including 404 paths) counts against the caller's IP. The limit is **100 requests per 60 seconds** per IP (values live in `src/config/rate-limit.ts`, never in handlers). When exceeded the API returns **429** with the error envelope plus a `Retry-After` header (integer seconds).

**Pagination (list endpoints):**

| Param | Type | Default | Rules |
|---|---|---|---|
| `limit` | integer | `20` | ≥ 1; values above `100` are **clamped to 100** |
| `offset` | integer | `0` | ≥ 0 |

Every list response includes `meta: { total, limit, offset, hasMore }`; `hasMore` is `true` when another page exists.

**Sorting (list endpoints):** `sort` selects a field from the per-resource allowlist below (an unknown value is a 400, never silently ignored); `order` is `asc` (default) or `desc`. Both are optional.

**Filtering (list endpoints):** per-resource query parameters listed below. Exact-match filters (IDs, enums) must equal the stored value; substring filters are case-insensitive and match anywhere in the value. An invalid enum or boolean value is a 400.

**Request bodies:** `POST` and `PATCH` take a JSON body with a `Content-Type: application/json` header. Bodies are validated by strict schemas — unknown fields are rejected (422), and immutable parent/identity fields (e.g. PATCHing `transcriptId`) are rejected rather than dropped. `POST` creates return **201**; `PATCH`/`DELETE` return **200**.

**Response statuses:**

| Status | When |
|---|---|
| `200` | Successful read / update / delete |
| `201` | Successful create |
| `400` | Malformed query parameter (`INVALID_QUERY`) or non-JSON body (`INVALID_BODY`) |
| `404` | `:id` does not exist, or path is not a known resource (`NOT_FOUND`) |
| `409` | Unique-constraint violation — duplicate `email`/`googleId`/`stripeCustomerId`, or a second Summary for one Transcript (`CONFLICT`) |
| `422` | Body fails schema validation (`VALIDATION_ERROR`) or references a nonexistent record (`INVALID_REFERENCE`) |
| `429` | Rate limit exceeded (`RATE_LIMIT_EXCEEDED`) — includes `Retry-After` |
| `500` | Unexpected failure (`INTERNAL_ERROR`) |

**Error envelope (all errors):**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Transcript not found."
  }
}
```

**Soft deletion:** `users` and `transcripts` are soft-deleted (sets `deletedAt`). After deletion they disappear from lists and `GET`/`PATCH`/`DELETE :id` return `404`. The other five resources are hard-deleted; the record is removed immediately.

---

### Users

#### List users — `GET /api/v1/users`

| Param | Type | Default | Notes |
|---|---|---|---|
| `limit` | integer | `20` | clamped to `100` |
| `offset` | integer | `0` | |
| `sort` | enum | `createdAt` | one of `email`, `createdAt`, `subscriptionTier` |
| `order` | `asc \| desc` | `asc` | |
| `email` | string | — | case-insensitive substring on `email` |
| `subscriptionTier` | `FREE \| PAID` | — | exact enum |
| `organizationId` | string | — | exact match |

Soft-deleted accounts are excluded. `passwordHash` is never returned.

```sh
curl "http://localhost:3000/api/v1/users?subscriptionTier=PAID&limit=2&sort=email&order=asc"
```

```json
{
  "data": [
    {
      "id": "cm3t2m3rx0000abcd1234efgh",
      "email": "researcher@example.com",
      "googleId": null,
      "subscriptionTier": "PAID",
      "stripeCustomerId": "cus_Qx7pm3A1kL",
      "organizationId": null,
      "createdAt": "2026-01-12T09:41:07.000Z",
      "deletedAt": null
    }
  ],
  "meta": { "total": 1, "limit": 2, "offset": 0, "hasMore": false }
}
```

#### Create user — `POST /api/v1/users`

| Body field | Type | Required | Notes |
|---|---|---|---|
| `email` | string | Yes | valid email, ≤ 254 chars, unique |
| `passwordHash` | string \| null | No | null for OAuth-only accounts |
| `googleId` | string \| null | No | unique |
| `subscriptionTier` | `FREE \| PAID` | No | defaults to `FREE` |
| `stripeCustomerId` | string \| null | No | unique |
| `organizationId` | string \| null | No | must reference an existing org (`422` otherwise) |

```sh
curl -X POST "http://localhost:3000/api/v1/users" \
  -H "Content-Type: application/json" \
  -d '{"email":"new.pm@example.com","subscriptionTier":"FREE"}'
```

```json
{
  "data": {
    "id": "cm3t2m3rx0001abcd1234efgi",
    "email": "new.pm@example.com",
    "googleId": null,
    "subscriptionTier": "FREE",
    "stripeCustomerId": null,
    "organizationId": null,
    "createdAt": "2026-09-21T10:00:00.000Z",
    "deletedAt": null
  }
}
```

Duplicate `email` → `409 CONFLICT`.

#### Get user — `GET /api/v1/users/:id`

```sh
curl "http://localhost:3000/api/v1/users/cm3t2m3rx0001abcd1234efgi"
```

```json
{
  "data": {
    "id": "cm3t2m3rx0001abcd1234efgi",
    "email": "new.pm@example.com",
    "googleId": null,
    "subscriptionTier": "FREE",
    "stripeCustomerId": null,
    "organizationId": null,
    "createdAt": "2026-09-21T10:00:00.000Z",
    "deletedAt": null
  }
}
```

Nonexistent or deleted id → `404 NOT_FOUND`.

#### Update user — `PATCH /api/v1/users/:id`

Accepts any subset of the create fields above (at least one required); `email`/`googleId`/`stripeCustomerId` conflicts map to `409`.

```sh
curl -X PATCH "http://localhost:3000/api/v1/users/cm3t2m3rx0001abcd1234efgi" \
  -H "Content-Type: application/json" \
  -d '{"subscriptionTier":"PAID"}'
```

```json
{
  "data": {
    "id": "cm3t2m3rx0001abcd1234efgi",
    "email": "new.pm@example.com",
    "googleId": null,
    "subscriptionTier": "PAID",
    "stripeCustomerId": null,
    "organizationId": null,
    "createdAt": "2026-09-21T10:00:00.000Z",
    "deletedAt": null
  }
}
```

#### Delete user — `DELETE /api/v1/users/:id`

Soft-deletes the account (sets `deletedAt`); the record is kept for compliance.

```sh
curl -X DELETE "http://localhost:3000/api/v1/users/cm3t2m3rx0001abcd1234efgi"
```

```json
{
  "data": { "id": "cm3t2m3rx0001abcd1234efgi", "deleted": true }
}
```

Not found → `404 NOT_FOUND`.

---

### Transcripts

#### List transcripts — `GET /api/v1/transcripts`

| Param | Type | Default | Notes |
|---|---|---|---|
| `limit` | integer | `20` | clamped to `100` |
| `offset` | integer | `0` | |
| `sort` | enum | `createdAt` | one of `title`, `createdAt`, `interviewDate`, `wordCount` |
| `order` | `asc \| desc` | `asc` | |
| `userId` | string | — | exact match on owner |
| `sourceType` | `PASTE \| TXT \| DOCX \| SRT \| VTT` | — | exact enum |
| `title` | string | — | case-insensitive substring on `title` |

Soft-deleted transcripts are excluded.

```sh
curl "http://localhost:3000/api/v1/transcripts?sourceType=SRT&sort=wordCount&order=desc&limit=5"
```

```json
{
  "data": [
    {
      "id": "cm3t2m3rx0002abcd1234efgj",
      "userId": "cm3t2m3rx0000abcd1234efgh",
      "title": "Onboarding interviews",
      "interviewDate": "2026-02-04T00:00:00.000Z",
      "interviewee": "Sam Rivera",
      "tags": ["onboarding", "sales"],
      "sourceType": "SRT",
      "originalFileKey": null,
      "extractedText": "Interviewer: How did onboarding go?\nSam: ...",
      "wordCount": 1240,
      "detectedLanguage": "en",
      "isNonEnglish": false,
      "isLowConfidence": false,
      "createdAt": "2026-02-04T12:02:11.000Z",
      "deletedAt": null
    }
  ],
  "meta": { "total": 1, "limit": 5, "offset": 0, "hasMore": false }
}
```

#### Create transcript — `POST /api/v1/transcripts`

`wordCount` is computed server-side from `extractedText` and must not be sent.

| Body field | Type | Required | Notes |
|---|---|---|---|
| `userId` | string | Yes | must reference an existing user (`422` otherwise) |
| `title` | string | Yes | ≤ 200 chars |
| `sourceType` | `PASTE \| TXT \| DOCX \| SRT \| VTT` | Yes | immutable after creation |
| `extractedText` | string | Yes | raw transcript text; > 50,000 words → `422` |
| `interviewDate` | string (ISO-8601) \| null | No | |
| `interviewee` | string \| null | No | |
| `tags` | string[] | No | defaults to `[]` |
| `originalFileKey` | string \| null | No | |
| `detectedLanguage` | string \| null | No | |
| `isNonEnglish` | boolean | No | defaults to `false` |
| `isLowConfidence` | boolean | No | defaults to `false` |

```sh
curl -X POST "http://localhost:3000/api/v1/transcripts" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "cm3t2m3rx0000abcd1234efgh",
    "title": "Churn call",
    "sourceType": "PASTE",
    "extractedText": "Customer: we considered leaving twice..."
  }'
```

```json
{
  "data": {
    "id": "cm3t2m3rx0003abcd1234efgk",
    "userId": "cm3t2m3rx0000abcd1234efgh",
    "title": "Churn call",
    "interviewDate": null,
    "interviewee": null,
    "tags": [],
    "sourceType": "PASTE",
    "originalFileKey": null,
    "extractedText": "Customer: we considered leaving twice...",
    "wordCount": 8,
    "detectedLanguage": null,
    "isNonEnglish": false,
    "isLowConfidence": false,
    "createdAt": "2026-09-21T10:00:00.000Z",
    "deletedAt": null
  }
}
```

#### Get transcript — `GET /api/v1/transcripts/:id`

```sh
curl "http://localhost:3000/api/v1/transcripts/cm3t2m3rx0003abcd1234efgk"
```

```json
{
  "data": {
    "id": "cm3t2m3rx0003abcd1234efgk",
    "userId": "cm3t2m3rx0000abcd1234efgh",
    "title": "Churn call",
    "interviewDate": null,
    "interviewee": null,
    "tags": [],
    "sourceType": "PASTE",
    "originalFileKey": null,
    "extractedText": "Customer: we considered leaving twice...",
    "wordCount": 8,
    "detectedLanguage": null,
    "isNonEnglish": false,
    "isLowConfidence": false,
    "createdAt": "2026-09-21T10:00:00.000Z",
    "deletedAt": null
  }
}
```

Nonexistent or deleted id → `404 NOT_FOUND`.

#### Update transcript — `PATCH /api/v1/transcripts/:id`

Accepts any subset of the create fields **except `userId` and `sourceType`** (immutable; sending them is a `422`). At least one field is required. When `extractedText` changes, `wordCount` is recomputed; over-limit text is rejected with `422`.

```sh
curl -X PATCH "http://localhost:3000/api/v1/transcripts/cm3t2m3rx0003abcd1234efgk" \
  -H "Content-Type: application/json" \
  -d '{"title":"Churn call (revised)","tags":["churn","retention"]}'
```

```json
{
  "data": {
    "id": "cm3t2m3rx0003abcd1234efgk",
    "userId": "cm3t2m3rx0000abcd1234efgh",
    "title": "Churn call (revised)",
    "interviewDate": null,
    "interviewee": null,
    "tags": ["churn", "retention"],
    "sourceType": "PASTE",
    "originalFileKey": null,
    "extractedText": "Customer: we considered leaving twice...",
    "wordCount": 8,
    "detectedLanguage": null,
    "isNonEnglish": false,
    "isLowConfidence": false,
    "createdAt": "2026-09-21T10:00:00.000Z",
    "deletedAt": null
  }
}
```

#### Delete transcript — `DELETE /api/v1/transcripts/:id`

Soft-deletes the transcript (sets `deletedAt`). Full cascade deletion of children and S3 cleanup run in the authenticated app flow.

```sh
curl -X DELETE "http://localhost:3000/api/v1/transcripts/cm3t2m3rx0003abcd1234efgk"
```

```json
{
  "data": { "id": "cm3t2m3rx0003abcd1234efgk", "deleted": true }
}
```

Not found → `404 NOT_FOUND`.

---

### Summaries

A Transcript has at most one Summary (`transcriptId` is unique). Creating a second summary for the same transcript is a **409**.

#### List summaries — `GET /api/v1/summaries`

| Param | Type | Default | Notes |
|---|---|---|---|
| `limit` | integer | `20` | clamped to `100` |
| `offset` | integer | `0` | |
| `sort` | enum | `transcriptId` | one of `id`, `transcriptId`, `editedAt` |
| `order` | `asc \| desc` | `asc` | |
| `transcriptId` | string | — | exact match |
| `edited` | `true \| false` | — | `true` → only edited summaries; `false` → only never-edited |

```sh
curl "http://localhost:3000/api/v1/summaries?transcriptId=cm3t2m3rx0002abcd1234efgj&edited=true"
```

```json
{
  "data": [
    {
      "id": "cm3t2m3rx0004abcd1234efgl",
      "transcriptId": "cm3t2m3rx0002abcd1234efgj",
      "content": "Onboarding feedback was broadly positive, with two recurring pain points around tooling and documentation.",
      "editedAt": "2026-02-06T09:15:00.000Z"
    }
  ],
  "meta": { "total": 1, "limit": 20, "offset": 0, "hasMore": false }
}
```

#### Create summary — `POST /api/v1/summaries`

| Body field | Type | Required | Notes |
|---|---|---|---|
| `transcriptId` | string | Yes | must reference an existing transcript (`422` otherwise) |
| `content` | string | Yes | free-text summary |

```sh
curl -X POST "http://localhost:3000/api/v1/summaries" \
  -H "Content-Type: application/json" \
  -d '{"transcriptId":"cm3t2m3rx0002abcd1234efgj","content":"Onboarding feedback was broadly positive."}'
```

```json
{
  "data": {
    "id": "cm3t2m3rx0004abcd1234efgl",
    "transcriptId": "cm3t2m3rx0002abcd1234efgj",
    "content": "Onboarding feedback was broadly positive.",
    "editedAt": null
  }
}
```

A second summary for the same transcript → `409 CONFLICT`.

#### Get summary — `GET /api/v1/summaries/:id`

```sh
curl "http://localhost:3000/api/v1/summaries/cm3t2m3rx0004abcd1234efgl"
```

```json
{
  "data": {
    "id": "cm3t2m3rx0004abcd1234efgl",
    "transcriptId": "cm3t2m3rx0002abcd1234efgj",
    "content": "Onboarding feedback was broadly positive.",
    "editedAt": null
  }
}
```

Nonexistent id → `404 NOT_FOUND`.

#### Update summary — `PATCH /api/v1/summaries/:id`

Only `content` is editable; `transcriptId` is immutable (sending it is a `422`). Edits stamp `editedAt`.

```sh
curl -X PATCH "http://localhost:3000/api/v1/summaries/cm3t2m3rx0004abcd1234efgl" \
  -H "Content-Type: application/json" \
  -d '{"content":"Onboarding feedback was positive; tooling was the weak spot."}'
```

```json
{
  "data": {
    "id": "cm3t2m3rx0004abcd1234efgl",
    "transcriptId": "cm3t2m3rx0002abcd1234efgj",
    "content": "Onboarding feedback was positive; tooling was the weak spot.",
    "editedAt": "2026-09-21T10:05:12.000Z"
  }
}
```

#### Delete summary — `DELETE /api/v1/summaries/:id`

Hard-deletes the summary. Transcripts are optional to have a summary.

```sh
curl -X DELETE "http://localhost:3000/api/v1/summaries/cm3t2m3rx0004abcd1234efgl"
```

```json
{
  "data": { "id": "cm3t2m3rx0004abcd1234efgl", "deleted": true }
}
```

Not found → `404 NOT_FOUND`.

---

### Themes

#### List themes — `GET /api/v1/themes`

| Param | Type | Default | Notes |
|---|---|---|---|
| `limit` | integer | `20` | clamped to `100` |
| `offset` | integer | `0` | |
| `sort` | enum | `createdAt` | one of `title`, `sentiment`, `createdAt`, `editedAt` |
| `order` | `asc \| desc` | `asc` | |
| `transcriptId` | string | — | exact match |
| `sentiment` | `POSITIVE \| NEUTRAL \| NEGATIVE \| MIXED` | — | exact enum |

```sh
curl "http://localhost:3000/api/v1/themes?transcriptId=cm3t2m3rx0002abcd1234efgj&sentiment=POSITIVE"
```

```json
{
  "data": [
    {
      "id": "cm3t2m3rx0005abcd1234efgm",
      "transcriptId": "cm3t2m3rx0002abcd1234efgj",
      "title": "Faster time-to-value",
      "description": "Customers highlighted quicker ramp-up after the guided walkthrough.",
      "sentiment": "POSITIVE",
      "sentimentReason": "All references to the walkthrough were appreciative.",
      "createdAt": "2026-02-05T11:20:00.000Z",
      "editedAt": null
    }
  ],
  "meta": { "total": 1, "limit": 20, "offset": 0, "hasMore": false }
}
```

#### Create theme — `POST /api/v1/themes`

| Body field | Type | Required | Notes |
|---|---|---|---|
| `transcriptId` | string | Yes | must reference an existing transcript (`422` otherwise) |
| `title` | string | Yes | ≤ 60 chars (PRD FR-13) |
| `description` | string | Yes | 1–3 sentences |
| `sentiment` | `POSITIVE \| NEUTRAL \| NEGATIVE \| MIXED` | Yes | |
| `sentimentReason` | string | Yes | one-sentence justification |

```sh
curl -X POST "http://localhost:3000/api/v1/themes" \
  -H "Content-Type: application/json" \
  -d '{
    "transcriptId": "cm3t2m3rx0002abcd1234efgj",
    "title": "Faster time-to-value",
    "description": "Customers highlighted quicker ramp-up.",
    "sentiment": "POSITIVE",
    "sentimentReason": "All references were appreciative."
  }'
```

```json
{
  "data": {
    "id": "cm3t2m3rx0005abcd1234efgm",
    "transcriptId": "cm3t2m3rx0002abcd1234efgj",
    "title": "Faster time-to-value",
    "description": "Customers highlighted quicker ramp-up.",
    "sentiment": "POSITIVE",
    "sentimentReason": "All references were appreciative.",
    "createdAt": "2026-09-21T10:10:00.000Z",
    "editedAt": null
  }
}
```

#### Get theme — `GET /api/v1/themes/:id`

```sh
curl "http://localhost:3000/api/v1/themes/cm3t2m3rx0005abcd1234efgm"
```

```json
{
  "data": {
    "id": "cm3t2m3rx0005abcd1234efgm",
    "transcriptId": "cm3t2m3rx0002abcd1234efgj",
    "title": "Faster time-to-value",
    "description": "Customers highlighted quicker ramp-up.",
    "sentiment": "POSITIVE",
    "sentimentReason": "All references were appreciative.",
    "createdAt": "2026-09-21T10:10:00.000Z",
    "editedAt": null
  }
}
```

Nonexistent id → `404 NOT_FOUND`.

#### Update theme — `PATCH /api/v1/themes/:id`

`title`, `description`, `sentiment`, and `sentimentReason` are editable; `transcriptId` is immutable. Edits stamp `editedAt`.

```sh
curl -X PATCH "http://localhost:3000/api/v1/themes/cm3t2m3rx0005abcd1234efgm" \
  -H "Content-Type: application/json" \
  -d '{"sentiment":"NEUTRAL","sentimentReason":"Mixed references after the second release."}'
```

```json
{
  "data": {
    "id": "cm3t2m3rx0005abcd1234efgm",
    "transcriptId": "cm3t2m3rx0002abcd1234efgj",
    "title": "Faster time-to-value",
    "description": "Customers highlighted quicker ramp-up.",
    "sentiment": "NEUTRAL",
    "sentimentReason": "Mixed references after the second release.",
    "createdAt": "2026-09-21T10:10:00.000Z",
    "editedAt": "2026-09-21T10:15:00.000Z"
  }
}
```

#### Delete theme — `DELETE /api/v1/themes/:id`

Hard-deletes the theme. Pain Points, Quotes, and Action Items that reference it keep their `themeId` set to `null` (`SetNull`).

```sh
curl -X DELETE "http://localhost:3000/api/v1/themes/cm3t2m3rx0005abcd1234efgm"
```

```json
{
  "data": { "id": "cm3t2m3rx0005abcd1234efgm", "deleted": true }
}
```

Not found → `404 NOT_FOUND`.

---

### Pain Points

#### List pain points — `GET /api/v1/pain-points`

| Param | Type | Default | Notes |
|---|---|---|---|
| `limit` | integer | `20` | clamped to `100` |
| `offset` | integer | `0` | |
| `sort` | enum | `createdAt` | one of `title`, `severity`, `createdAt`, `editedAt` |
| `order` | `asc \| desc` | `asc` | |
| `transcriptId` | string | — | exact match |
| `themeId` | string | — | exact match |
| `severity` | `LOW \| MEDIUM \| HIGH` | — | exact enum |

```sh
curl "http://localhost:3000/api/v1/pain-points?transcriptId=cm3t2m3rx0002abcd1234efgj&severity=HIGH"
```

```json
{
  "data": [
    {
      "id": "cm3t2m3rx0006abcd1234efgn",
      "transcriptId": "cm3t2m3rx0002abcd1234efgj",
      "themeId": "cm3t2m3rx0005abcd1234efgm",
      "title": "Docs are two releases behind",
      "description": "Users found stale examples for the latest API.",
      "severity": "HIGH",
      "createdAt": "2026-02-05T11:25:00.000Z",
      "editedAt": null
    }
  ],
  "meta": { "total": 1, "limit": 20, "offset": 0, "hasMore": false }
}
```

#### Create pain point — `POST /api/v1/pain-points`

| Body field | Type | Required | Notes |
|---|---|---|---|
| `transcriptId` | string | Yes | must reference an existing transcript (`422` otherwise) |
| `title` | string | Yes | |
| `description` | string | Yes | |
| `severity` | `LOW \| MEDIUM \| HIGH` | Yes | |
| `themeId` | string \| null | No | must reference an existing theme when set (`422` otherwise) |

```sh
curl -X POST "http://localhost:3000/api/v1/pain-points" \
  -H "Content-Type: application/json" \
  -d '{
    "transcriptId": "cm3t2m3rx0002abcd1234efgj",
    "title": "Docs are two releases behind",
    "description": "Users found stale examples for the latest API.",
    "severity": "HIGH",
    "themeId": "cm3t2m3rx0005abcd1234efgm"
  }'
```

```json
{
  "data": {
    "id": "cm3t2m3rx0006abcd1234efgn",
    "transcriptId": "cm3t2m3rx0002abcd1234efgj",
    "themeId": "cm3t2m3rx0005abcd1234efgm",
    "title": "Docs are two releases behind",
    "description": "Users found stale examples for the latest API.",
    "severity": "HIGH",
    "createdAt": "2026-09-21T10:20:00.000Z",
    "editedAt": null
  }
}
```

#### Get pain point — `GET /api/v1/pain-points/:id`

```sh
curl "http://localhost:3000/api/v1/pain-points/cm3t2m3rx0006abcd1234efgn"
```

```json
{
  "data": {
    "id": "cm3t2m3rx0006abcd1234efgn",
    "transcriptId": "cm3t2m3rx0002abcd1234efgj",
    "themeId": "cm3t2m3rx0005abcd1234efgm",
    "title": "Docs are two releases behind",
    "description": "Users found stale examples for the latest API.",
    "severity": "HIGH",
    "createdAt": "2026-09-21T10:20:00.000Z",
    "editedAt": null
  }
}
```

Nonexistent id → `404 NOT_FOUND`.

#### Update pain point — `PATCH /api/v1/pain-points/:id`

`title`, `description`, `severity`, and `themeId` are editable; `transcriptId` is immutable. Edits stamp `editedAt`.

```sh
curl -X PATCH "http://localhost:3000/api/v1/pain-points/cm3t2m3rx0006abcd1234efgn" \
  -H "Content-Type: application/json" \
  -d '{"severity":"MEDIUM","themeId":null}'
```

```json
{
  "data": {
    "id": "cm3t2m3rx0006abcd1234efgn",
    "transcriptId": "cm3t2m3rx0002abcd1234efgj",
    "themeId": null,
    "title": "Docs are two releases behind",
    "description": "Users found stale examples for the latest API.",
    "severity": "MEDIUM",
    "createdAt": "2026-09-21T10:20:00.000Z",
    "editedAt": "2026-09-21T10:25:00.000Z"
  }
}
```

Sending a non-existent `themeId` → `422 INVALID_REFERENCE`.

#### Delete pain point — `DELETE /api/v1/pain-points/:id`

Hard-deletes the pain point.

```sh
curl -X DELETE "http://localhost:3000/api/v1/pain-points/cm3t2m3rx0006abcd1234efgn"
```

```json
{
  "data": { "id": "cm3t2m3rx0006abcd1234efgn", "deleted": true }
}
```

Not found → `404 NOT_FOUND`.

---

### Quotes

Quotes are verbatim transcript excerpts, capped at **50 words** on create (`422` if exceeded, PRD FR-15).

#### List quotes — `GET /api/v1/quotes`

| Param | Type | Default | Notes |
|---|---|---|---|
| `limit` | integer | `20` | clamped to `100` |
| `offset` | integer | `0` | |
| `sort` | enum | `createdAt` | one of `text`, `wasTruncated`, `createdAt`, `editedAt` |
| `order` | `asc \| desc` | `asc` | |
| `transcriptId` | string | — | exact match |
| `themeId` | string | — | exact match |
| `speakerLabel` | `SPEAKER_01 \| SPEAKER_02` | — | exact match |

```sh
curl "http://localhost:3000/api/v1/quotes?transcriptId=cm3t2m3rx0002abcd1234efgj&speakerLabel=SPEAKER_01"
```

```json
{
  "data": [
    {
      "id": "cm3t2m3rx0007abcd1234efgo",
      "transcriptId": "cm3t2m3rx0002abcd1234efgj",
      "themeId": "cm3t2m3rx0005abcd1234efgm",
      "text": "The walkthrough is the single best part of our setup day.",
      "speakerLabel": "SPEAKER_01",
      "sourceOffsetStart": 124,
      "sourceOffsetEnd": 185,
      "wasTruncated": false,
      "createdAt": "2026-02-05T11:30:00.000Z",
      "editedAt": null
    }
  ],
  "meta": { "total": 1, "limit": 20, "offset": 0, "hasMore": false }
}
```

#### Create quote — `POST /api/v1/quotes`

| Body field | Type | Required | Notes |
|---|---|---|---|
| `transcriptId` | string | Yes | must reference an existing transcript (`422` otherwise) |
| `text` | string | Yes | verbatim excerpt, ≤ 50 words |
| `themeId` | string \| null | No | must reference an existing theme when set (`422` otherwise) |
| `speakerLabel` | string \| null | No | when the transcript supports labels |
| `sourceOffsetStart` | integer \| null | No | ≥ 0 |
| `sourceOffsetEnd` | integer \| null | No | ≥ `sourceOffsetStart` (`422` if not) |
| `wasTruncated` | boolean | No | defaults to `false` |

```sh
curl -X POST "http://localhost:3000/api/v1/quotes" \
  -H "Content-Type: application/json" \
  -d '{
    "transcriptId": "cm3t2m3rx0002abcd1234efgj",
    "text": "The walkthrough is the single best part of our setup day.",
    "speakerLabel": "SPEAKER_01",
    "sourceOffsetStart": 124,
    "sourceOffsetEnd": 185
  }'
```

```json
{
  "data": {
    "id": "cm3t2m3rx0007abcd1234efgo",
    "transcriptId": "cm3t2m3rx0002abcd1234efgj",
    "themeId": null,
    "text": "The walkthrough is the single best part of our setup day.",
    "speakerLabel": "SPEAKER_01",
    "sourceOffsetStart": 124,
    "sourceOffsetEnd": 185,
    "wasTruncated": false,
    "createdAt": "2026-09-21T10:30:00.000Z",
    "editedAt": null
  }
}
```

#### Get quote — `GET /api/v1/quotes/:id`

```sh
curl "http://localhost:3000/api/v1/quotes/cm3t2m3rx0007abcd1234efgo"
```

```json
{
  "data": {
    "id": "cm3t2m3rx0007abcd1234efgo",
    "transcriptId": "cm3t2m3rx0002abcd1234efgj",
    "themeId": null,
    "text": "The walkthrough is the single best part of our setup day.",
    "speakerLabel": "SPEAKER_01",
    "sourceOffsetStart": 124,
    "sourceOffsetEnd": 185,
    "wasTruncated": false,
    "createdAt": "2026-09-21T10:30:00.000Z",
    "editedAt": null
  }
}
```

Nonexistent id → `404 NOT_FOUND`.

#### Update quote — `PATCH /api/v1/quotes/:id`

`text`, `themeId`, `speakerLabel`, `sourceOffsetStart`, `sourceOffsetEnd`, and `wasTruncated` are editable; `transcriptId` is immutable. A `text` longer than 50 words and an `end < start` are `422`. Edits stamp `editedAt`.

```sh
curl -X PATCH "http://localhost:3000/api/v1/quotes/cm3t2m3rx0007abcd1234efgo" \
  -H "Content-Type: application/json" \
  -d '{"themeId":"cm3t2m3rx0005abcd1234efgm"}'
```

```json
{
  "data": {
    "id": "cm3t2m3rx0007abcd1234efgo",
    "transcriptId": "cm3t2m3rx0002abcd1234efgj",
    "themeId": "cm3t2m3rx0005abcd1234efgm",
    "text": "The walkthrough is the single best part of our setup day.",
    "speakerLabel": "SPEAKER_01",
    "sourceOffsetStart": 124,
    "sourceOffsetEnd": 185,
    "wasTruncated": false,
    "createdAt": "2026-09-21T10:30:00.000Z",
    "editedAt": "2026-09-21T10:35:00.000Z"
  }
}
```

#### Delete quote — `DELETE /api/v1/quotes/:id`

Hard-deletes the quote.

```sh
curl -X DELETE "http://localhost:3000/api/v1/quotes/cm3t2m3rx0007abcd1234efgo"
```

```json
{
  "data": { "id": "cm3t2m3rx0007abcd1234efgo", "deleted": true }
}
```

Not found → `404 NOT_FOUND`.

---

### Action Items

#### List action items — `GET /api/v1/action-items`

| Param | Type | Default | Notes |
|---|---|---|---|
| `limit` | integer | `20` | clamped to `100` |
| `offset` | integer | `0` | |
| `sort` | enum | `createdAt` | one of `description`, `createdAt`, `editedAt` |
| `order` | `asc \| desc` | `asc` | |
| `transcriptId` | string | — | exact match |
| `themeId` | string | — | exact match |

```sh
curl "http://localhost:3000/api/v1/action-items?transcriptId=cm3t2m3rx0002abcd1234efgj"
```

```json
{
  "data": [
    {
      "id": "cm3t2m3rx0008abcd1234efgp",
      "transcriptId": "cm3t2m3rx0002abcd1234efgj",
      "themeId": "cm3t2m3rx0005abcd1234efgm",
      "description": "Update the onboarding docs to match the latest API.",
      "createdAt": "2026-02-05T11:35:00.000Z",
      "editedAt": null
    }
  ],
  "meta": { "total": 1, "limit": 20, "offset": 0, "hasMore": false }
}
```

#### Create action item — `POST /api/v1/action-items`

| Body field | Type | Required | Notes |
|---|---|---|---|
| `transcriptId` | string | Yes | must reference an existing transcript (`422` otherwise) |
| `description` | string | Yes | imperative-phrased task |
| `themeId` | string \| null | No | must reference an existing theme when set (`422` otherwise) |

```sh
curl -X POST "http://localhost:3000/api/v1/action-items" \
  -H "Content-Type: application/json" \
  -d '{
    "transcriptId": "cm3t2m3rx0002abcd1234efgj",
    "description": "Update the onboarding docs to match the latest API.",
    "themeId": "cm3t2m3rx0005abcd1234efgm"
  }'
```

```json
{
  "data": {
    "id": "cm3t2m3rx0008abcd1234efgp",
    "transcriptId": "cm3t2m3rx0002abcd1234efgj",
    "themeId": "cm3t2m3rx0005abcd1234efgm",
    "description": "Update the onboarding docs to match the latest API.",
    "createdAt": "2026-09-21T10:40:00.000Z",
    "editedAt": null
  }
}
```

#### Get action item — `GET /api/v1/action-items/:id`

```sh
curl "http://localhost:3000/api/v1/action-items/cm3t2m3rx0008abcd1234efgp"
```

```json
{
  "data": {
    "id": "cm3t2m3rx0008abcd1234efgp",
    "transcriptId": "cm3t2m3rx0002abcd1234efgj",
    "themeId": "cm3t2m3rx0005abcd1234efgm",
    "description": "Update the onboarding docs to match the latest API.",
    "createdAt": "2026-09-21T10:40:00.000Z",
    "editedAt": null
  }
}
```

Nonexistent id → `404 NOT_FOUND`.

#### Update action item — `PATCH /api/v1/action-items/:id`

`description` and `themeId` are editable; `transcriptId` is immutable. A non-existent `themeId` is a `422`. Edits stamp `editedAt`.

```sh
curl -X PATCH "http://localhost:3000/api/v1/action-items/cm3t2m3rx0008abcd1234efgp" \
  -H "Content-Type: application/json" \
  -d '{"themeId":null}'
```

```json
{
  "data": {
    "id": "cm3t2m3rx0008abcd1234efgp",
    "transcriptId": "cm3t2m3rx0002abcd1234efgj",
    "themeId": null,
    "description": "Update the onboarding docs to match the latest API.",
    "createdAt": "2026-09-21T10:40:00.000Z",
    "editedAt": "2026-09-21T10:45:00.000Z"
  }
}
```

#### Delete action item — `DELETE /api/v1/action-items/:id`

Hard-deletes the action item.

```sh
curl -X DELETE "http://localhost:3000/api/v1/action-items/cm3t2m3rx0008abcd1234efgp"
```

```json
{
  "data": { "id": "cm3t2m3rx0008abcd1234efgp", "deleted": true }
}
```

Not found → `404 NOT_FOUND`.

---

## Error codes

| `code` | HTTP | Meaning |
|---|---|---|
| `INVALID_QUERY` | 400 | A query parameter is malformed (non-integer `limit`/`offset`, unknown `sort`, invalid `order`/enum/boolean) |
| `INVALID_BODY` | 400 | Request body is not valid JSON |
| `NOT_FOUND` | 404 | `:id` does not exist, is deleted, or the path is not a known resource |
| `CONFLICT` | 409 | Unique constraint violation (duplicate `email`/`googleId`/`stripeCustomerId`; second Summary for one Transcript) |
| `VALIDATION_ERROR` | 422 | Body fails the schema: missing/invalid field, unknown field, empty PATCH, over word limit |
| `INVALID_REFERENCE` | 422 | A referenced record (`userId`, `transcriptId`, `themeId`, `organizationId`) does not exist |
| `RATE_LIMIT_EXCEEDED` | 429 | Per-IP rate limit hit; retry after the `Retry-After` header value |
| `INTERNAL_ERROR` | 500 | Unexpected failure |

Every error body is `{ "error": { "code", "message" } }`, including `404` on unknown `/api/v1/*` paths.