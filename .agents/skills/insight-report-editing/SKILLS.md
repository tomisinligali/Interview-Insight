
### `.agents/skills/insight-report-editing/skill.md`

```markdown
---
name: insight-report-editing
description: Load for Summary, Key Themes, Pain Points, Notable Quotes, Action Items, Sentiment per Theme, inline editing, blur-save, themeId, quote links, low-confidence banners, or single-level undo.
---

# Insight Report Editing

This skill teaches the ordered editing workflow for the generated report. Its laws live in `design-system-rule.md`, `database-schema.md`, and `ai-output-integrity.md`.

## Procedure

1. Load the transcript's current structured insight state.

2. Render exactly six sections:
   - Summary
   - Key Themes
   - Pain Points
   - Notable Quotes
   - Action Items
   - Sentiment per Theme

3. Render each section from its structured database rows.

4. Show the low-confidence banner when the transcript is marked low-confidence.

5. For an edit:
   - Capture the current field value.
   - Replace it with the user's value.
   - Keep the previous value in session/browser state for single-level undo.

6. Save the field when it loses focus.

7. Send only the changed field to the API.

8. Authorize the transcript and insight ownership on the server.

9. Persist the edited value and `editedAt`.

10. Keep theme-to-quote relationships intact unless the user explicitly edits a supported relationship.

11. On undo:
    - Restore the immediately previous value.
    - Do not create multi-version history.
    - Do not persist undo history across reloads.

12. Ensure later exports read the current edited database state.

## Code Skeleton

```tsx
function EditableField({
  value,
  onSave,
}: {
  value: string;
  onSave: (value: string) => Promise<void>;
}) {
  const [current, setCurrent] = useState(value);
  const [previous, setPrevious] = useState<string | null>(null);

  async function handleBlur() {
    if (current === value) return;

    setPrevious(value);
    await onSave(current);
  }

  function undo() {
    if (previous === null) return;
    setCurrent(previous);
  }

  return (
    <Editable
      value={current}
      onChange={setCurrent}
      onBlur={handleBlur}
      onUndo={undo}
    />
  );
}
await prisma.theme.update({
  where: {
    id: itemId,
    transcript: { userId },
  },
  data: {
    title: value,
    editedAt: new Date(),
  },
});