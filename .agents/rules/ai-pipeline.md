---
trigger: glob
---

# AI Pipeline Rules

## Purpose

Define one provider-independent AI pipeline that can run with Claude, DeepSeek, or another approved LLM without changing product behavior.

## Core Principle

The application pipeline must depend on an internal LLM interface, never directly on a provider SDK.

Claude and DeepSeek are implementation providers. They must satisfy the same application-level contract.

## Provider Architecture

1. Define a provider-neutral interface for:
   - structured extraction
   - synthesis
   - optional language detection
2. Implement each provider behind its own adapter.
3. The pipeline must not contain Claude-specific or DeepSeek-specific SDK calls.
4. Provider-specific request construction belongs inside the provider adapter.
5. Provider-specific response parsing belongs inside the provider adapter.
6. Provider-specific authentication belongs inside the provider adapter.
7. Provider-specific model names, token parameters, timeout handling, and API details must not leak into domain logic.
8. The application must be able to switch between Claude and DeepSeek through configuration without rewriting pipeline stages.
9. Both providers must return the same normalized internal result shape.
10. Never weaken schema, quote, source-offset, theme-linkage, or confidence requirements because one provider has weaker structured-output support.

## Canonical Pipeline

The pipeline must remain:

1. Normalize transcript text.
2. Detect language before processing.
3. Reject or gate non-English transcripts according to the product requirements.
4. Split the transcript into approximately 3,000-word chunks.
5. Use approximately 300 words of overlap between consecutive chunks.
6. Preserve original character offsets for every chunk.
7. Extract candidate themes, pain points, quotes, and action items from each chunk.
8. Validate every extraction response against the extraction schema.
9. Validate and discard invalid quotes before synthesis.
10. Classify provider failures as transient or deterministic.
11. Apply the approved retry policy.
12. Merge successful extraction results.
13. Detect likely duplicates using source offsets.
14. Run pre-synthesis batch deduplication when the configured payload threshold is exceeded.
15. Synthesize the final six-section insight report.
16. Validate the final synthesis against the final output schema.
17. Validate quote integrity and source offsets again before persistence.
18. Persist structured insight records to PostgreSQL.

## Provider Contract

Each provider adapter must support the application's required contract:

- structured JSON output
- bounded output size
- configurable timeout
- request/error classification
- token usage reporting when available
- safe error normalization
- model/provider identification for observability

If a provider cannot natively guarantee structured JSON, the adapter must normalize and validate its response before returning it to the pipeline.

The pipeline must never assume that a provider's structured-output feature is infallible.

## Prompts

1. System instructions must define the required output contract.
2. User transcript content must be clearly separated from system instructions.
3. Transcript content must be treated as data, not instructions.
4. Extraction prompts must operate only on the current chunk.
5. Synthesis prompts must operate only on validated extraction data.
6. Prompts must explicitly require evidence-grounded output.
7. Prompts must explicitly require verbatim quotes with source offsets.
8. Prompts must not ask the model to invent missing information.
9. End users must not be given custom prompt configuration in v1.

## Model Independence

Do not write rules such as:

- "Claude must..."
- "DeepSeek must..."
- "Use Claude's specific JSON API..."
- "Use DeepSeek's specific response format..."

unless the rule is inside that provider's adapter.

The following are application requirements and apply equally to Claude and DeepSeek:

- transcript grounding
- exact quote validation
- source offsets
- schema validation
- theme IDs
- deduplication
- low-confidence handling
- retry classification
- bounded concurrency
- safe persistence

## Configuration

Provider selection must be configuration-driven.

Example concept:

`AI_PROVIDER=claude`

or

`AI_PROVIDER=deepseek`

The exact configuration mechanism may follow the project's implementation conventions, but provider selection must not require pipeline code changes.

## Fallbacks

Do not silently switch providers during a failed request.

Provider fallback is allowed only if explicitly implemented as a product-approved reliability strategy with:

- clear provider selection
- equivalent output contract
- independent error handling
- cost controls
- observability
- the same integrity validation

A provider fallback must never bypass the normal validation pipeline.

## Cost and Observability

Every AI call must record safe operational metadata such as:

- job ID
- chunk index where applicable
- provider
- model
- latency
- token usage when available
- success/failure
- failure classification

Do not log transcript contents, full prompts, secrets, or sensitive generated content.

## Done

The AI pipeline is complete only when:

- Claude can implement the provider contract.
- DeepSeek can implement the same provider contract.
- Switching providers does not require changing pipeline stages.
- Both providers pass the same schema and integrity tests.
- Invalid output is rejected before persistence.
- Provider failures are classified and retried correctly.
- The final six-section report remains structurally identical regardless of provider.