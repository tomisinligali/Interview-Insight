
### `.agents/skills/transcript-ingestion/skill.md`

```markdown
---
name: transcript-ingestion
description: Load for transcript paste, file upload, TXT, DOCX, SRT, VTT, parsing, text extraction, normalization, language detection, word counting, speaker labels, metadata, S3 storage, or transcript creation.
---

# Transcript Ingestion

This skill teaches the ordered transcript intake flow. Its laws live in `coding-standard.md`, `database-schema.md`, `security.md`, and `ai-output-integrity.md`.

## Procedure

1. Identify the input source.
   - Pasted text
   - `.txt`
   - `.docx`
   - `.srt`
   - `.vtt`

2. Validate the file type and the 10MB file limit before processing.

3. For pasted text, use the submitted text directly.

4. For files, extract plain text server-side.
   - `.docx`: extract text.
   - `.srt`/`.vtt`: remove timestamps and cue numbers.
   - Preserve speaker labels when present.

5. Detect speaker labels using the approved line pattern:
   `^[A-Za-z0-9_ ]{1,40}:`

6. Normalize the extracted text.
   - Normalize line endings.
   - Strip excess whitespace.
   - Remove timestamp artifacts left by subtitle parsing.

7. Run the pre-check word estimate before expensive extraction work.
   - Reject when the estimate implies more than 75,000 words.

8. Run authoritative word counting after extraction.
   - Reject above 50,000 words.
   - Return the actual count and the limit.

9. Run language detection before chunking or AI extraction.
   - Mark non-English input.
   - Warn the user.
   - Do not automatically continue processing.

10. Apply the title and optional metadata.
    - Title is required.
    - Use the approved default when omitted.

11. For file uploads, store the original object in S3-compatible storage using the approved transcript key pattern.

12. Store extracted text and transcript metadata in PostgreSQL.

13. Create the transcript and usage record according to the billing transaction flow.

14. Enqueue processing only after the transcript creation flow succeeds.

## Code Skeleton

```ts
async function ingestTranscript(input: TranscriptInput) {
  validateSourceType(input);
  validateFileSize(input);

  const rawText = input.kind === "paste"
    ? input.text
    : await extractPlainText(input.file);

  const normalizedText = normalizeTranscript(rawText);

  const language = detectLanguage(normalizedText);

  if (!isEnglish(language)) {
    return markNonEnglish({
      language,
      text: normalizedText,
    });
  }

  const wordCount = countWords(normalizedText);

  if (wordCount > 50_000) {
    throw new TranscriptTooLongError(wordCount);
  }

  return createTranscript({
    text: normalizedText,
    wordCount,
    language,
    metadata: input.metadata,
  });
}
function detectSpeakerLabel(line: string) {
  return /^[A-Za-z0-9_ ]{1,40}:/.test(line);
}