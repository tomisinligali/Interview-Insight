
### `.agents/skills/export-generation/skill.md`

```markdown
---
name: export-generation
description: Load for Markdown export, PDF generation, export jobs, PDF worker processing, temporary S3 files, export polling, download URLs, or export status.
---

# Export Generation

This skill teaches the two export workflows. Its laws live in `processing-reliability.md`, `database-schema.md`, `security.md`, and `design-system-rule.md`.

## Procedure

1. Load the current persisted insight report.

2. Confirm the user owns the transcript.

3. Use the current edited state, not the original AI output.

4. For Markdown:
   - Build the report as a string.
   - Use `##` headers.
   - Include all six sections.
   - Return it synchronously from the API route.

5. For PDF:
   - Create an export job.
   - Set it to `QUEUED`.
   - Let the worker process it.
   - Generate the PDF from the current report state.

6. Write the generated PDF to temporary S3 storage.

7. Give the temporary object a short TTL.

8. Mark the export job complete only after the object is available.

9. Return the export job status through the polling endpoint.

10. Return a download URL only after successful completion.

11. Mark failed export jobs as failed and expose the failure state.

12. Do not make PDF rendering part of the synchronous serverless request.

## Code Skeleton

```ts
// Markdown
export async function GET(request: Request) {
  const report = await getOwnedReport(transcriptId);

  const markdown = renderMarkdown(report);

  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown",
    },
  });
}
// PDF request
const job = await prisma.exportJob.create({
  data: {
    transcriptId,
    userId,
    format: "PDF",
    status: "QUEUED",
  },
});

await enqueueExportJob(job.id);

return Response.json({
  jobId: job.id,
});
// Worker
const report = await getCurrentReport(job.transcriptId);
const pdf = await renderPdf(report);

const key = `temporary-exports/${job.id}.pdf`;

await uploadToS3(key, pdf, { ttl: "short" });

await markExportComplete(job.id, key);