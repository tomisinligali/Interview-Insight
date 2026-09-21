
### `.agents/skills/billing-entitlement-lifecycle/skill.md`

```markdown
---
name: billing-entitlement-lifecycle
description: Load for Flutterwave payments, subscriptions, webhooks, plan changes, free tier, paid tier, quotas, usage records, transcript limits, payment verification, or billing state.
---

# Billing Entitlement Lifecycle

This skill teaches the ordered billing and usage workflow. Its laws live in `money-billing.md` and `database-schema.md`.

## Procedure

1. Resolve the authenticated user server-side.

2. Read the user's current billing state from the database.

3. Determine the applicable monthly transcript limit.
   - Free: 3.
   - Paid: 50.

4. For transcript creation:
   - Start the database transaction.
   - Read the current usage record.
   - Check the tier cap.
   - Reject creation when the cap is reached.
   - Create the transcript.
   - Increment `transcriptsUsed`.
   - Enqueue processing as part of the approved creation flow.

5. Do not increment usage again when a processing job is retried.

6. For Flutterwave payment events:
   - Receive the webhook.
   - Verify the webhook.
   - Identify the billing event.
   - Apply the state change idempotently.
   - Update the user's subscription state.

7. Never use client-provided payment or subscription state to grant entitlement.

8. For plan changes:
   - Update billing state server-side.
   - Recalculate the user's entitlement from persisted state.

9. Keep the usage counter visible through the usage API.

10. When the tier cap is reached:
    - Block new transcript creation.
    - Return the upgrade state.
    - Do not start partial processing.

11. Keep billing-provider code behind the Flutterwave billing adapter.

## Code Skeleton

```ts
await prisma.$transaction(async (tx) => {
  const user = await tx.user.findUniqueOrThrow({
    where: { id: userId },
  });

  const limit = getTranscriptLimit(user.subscriptionTier);

  const usage = await getCurrentUsage(tx, userId);

  if (usage.transcriptsUsed >= limit) {
    throw new UsageLimitError();
  }

  const transcript = await tx.transcript.create({
    data: transcriptData,
  });

  await incrementUsage(tx, usage.id);

  await createProcessingJob(tx, transcript.id);
});
// Provider-specific billing code
async function handleFlutterwaveWebhook(request: Request) {
  await verifyFlutterwaveWebhook(request);

  const event = await parseBillingEvent(request);

  await applyBillingEventIdempotently(event);
}