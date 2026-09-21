/**
 * Transcript Word Count & Text Extraction Utilities
 * 
 * Implements FR-3 (Speaker label regex heuristic) and FR-4 (Two-pass word count validation).
 */

/**
 * Speaker label regex heuristic per FR-3:
 * Matches `^[A-Za-z0-9_ ]{1,40}:` at the start of a line.
 */
export const SPEAKER_LABEL_REGEX = /^[A-Za-z0-9_ ]{1,40}:/;

/**
 * Pass 1: Pre-check word count estimate from raw file byte size (assume ~6 characters per word average).
 * Returns true if estimated word count > 75,000 words.
 */
export function estimateExceedsPreCheckLimit(fileSizeBytes: number): boolean {
  const estimatedCharCount = fileSizeBytes;
  const estimatedWordCount = Math.floor(estimatedCharCount / 6);
  return estimatedWordCount > 75000;
}

/**
 * Pass 2: Authoritative exact word count computation.
 * Counts whitespace-delimited words.
 */
export function computeExactWordCount(text: string): number {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

/**
 * Strips subtitle timestamps and cue numbers from SRT/VTT text while preserving text content.
 */
export function cleanSubtitleText(rawText: string): string {
  return rawText
    // Remove WEBVTT header
    .replace(/^WEBVTT.*/gi, '')
    // Remove SRT/VTT timestamp arrows & line numbers
    .replace(/\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}.*/g, '')
    .replace(/^\d+\s*$/gm, '')
    // Normalize extra line breaks
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
