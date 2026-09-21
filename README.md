# Interview Insights App

Web application that turns raw interview transcripts into structured, editable insight reports (Summary, Key Themes, Pain Points, Notable Quotes, Action Items, Sentiment per Theme).

The authoritative specs live in `docs/AGENTS.md` and `docs/interview-insights-prd-v2.md`. The resource design below covers every resource the product's REST API operates on and is kept in lockstep with `prisma/schema.prisma`.

---

## Step 1 — Resource design (before code)

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
| `passwordHash` | String | Optional | `null` for OAuth-only accounts |
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
| `title` | String | Yes | |
| `interviewDate` | DateTime | Optional | |
| `interviewee` | String | Optional | |
| `tags` | String array | Yes (may be empty) | Postgres text array |
| `sourceType` | `PASTE \| TXT \| DOCX \| SRT \| VTT` | Yes | Enum; drives ingestion path |
| `originalFileKey` | String | Optional | S3 object key; null for pasted text |
| `extractedText` | String | Yes | Raw transcript content |
| `wordCount` | Int | Yes | |
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
| `sourceOffsetEnd` | Int | Optional | Character offset into transcript |
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

Seven resources (User, Transcript, Summary, Theme, Pain Point, Quote, Action Item) form the user-facing insight flow and are the set this design documents. The assessment asked for 3–5; this expands to 7 so the structure is sufficient for the project's later REST API requirements (the API operates on all seven, per `docs/AGENTS.md` and `prisma/schema.prisma`). Coverage intentionally took precedence over the count guideline, while the relationship diagram still fits on one page.

Four schema models support plumbing, not stored insight content, and are designed into later steps under the same rules (generated IDs, correct cascade/SetNull, ownership path to User): `Organization`, `ProcessingJob`, `ExportJob`, `UsageRecord`.