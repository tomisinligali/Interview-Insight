
### `.agents/skills/ai-pipeline-orchestration/skill.md`

```markdown
---
name: ai-pipeline-orchestration
description: Load for AI extraction, synthesis, chunking, overlap, deduplication, Claude, DeepSeek, provider switching, structured JSON, schema validation, themeId, quotes, sentiment, or insight generation.
---

# AI Pipeline Orchestration

This skill teaches the complete provider-neutral AI workflow. Its laws live in `ai-pipeline.md` and `ai-output-integrity.md`.

## Procedure

1. Start with validated, normalized transcript text.

2. Confirm the transcript passed language gating.

3. Split the transcript into approximately 3,000-word chunks with 300-word overlap.

4. Store each chunk's original character offsets.

5. Send each chunk through the configured LLM provider adapter.

6. Ask for structured extraction of:
   - Themes
   - Pain points
   - Quotes
   - Action items

7. Validate every provider response against the extraction schema.

8. Validate quotes against the original transcript before allowing them into synthesis.

9. Classify provider failures as transient or deterministic.

10. Apply the processing retry workflow.

11. Merge successful extraction results with their source offsets.

12. Flag candidates originating from overlap zones.

13. If the merged payload exceeds approximately 15,000 tokens:
    - Group chunks into batches of approximately six.
    - Deduplicate each batch.
    - Merge the reduced results.

14. Run final synthesis on validated candidate data.

15. Require the final response to contain exactly the six product output sections.

16. Validate the synthesis response against the final schema.

17. Revalidate quotes, offsets, and `themeId` relationships.

18. Persist only validated structured results.

19. Keep provider-specific behavior inside the provider adapter.

20. Use the same internal contract for Claude and DeepSeek.

## Code Skeleton

```ts
interface LlmProvider {
  extract(input: ExtractionInput): Promise<ExtractionResult>;
  synthesize(input: SynthesisInput): Promise<SynthesisResult>;
}

const provider: LlmProvider = providerFactory(config.aiProvider);

const chunks = chunkTranscript(text, {
  targetWords: 3000,
  overlapWords: 300,
});

const extracted = await extractChunks(provider, chunks);

const validated = extracted.map(validateExtraction);

const deduped = await deduplicateCandidates(validated);

const result = await provider.synthesize({
  candidates: deduped,
});

const finalReport = validateFinalOutput(result);
validateQuoteIntegrity(finalReport, text);
validateThemeLinks(finalReport);

await persistInsightReport(finalReport);
// Provider-specific code stays here.
class ClaudeProvider implements LlmProvider {
  async extract(input: ExtractionInput) {
    return normalizeProviderResponse(
      await claudeClient.extract(input)
    );
  }
}

class DeepSeekProvider implements LlmProvider {
  async extract(input: ExtractionInput) {
    return normalizeProviderResponse(
      await deepSeekClient.extract(input)
    );
  }
}