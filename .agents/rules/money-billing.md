---
trigger: glob
---

# Money and Billing Rules

## Purpose

Keep subscription state, usage limits, payments, and entitlements correct.

## Rules

1. Flutterwave is the billing provider for this project.
2. Never introduce Stripe billing logic unless the product requirements explicitly change the billing provider.
3. Keep Flutterwave-specific API calls, webhook handling, and identifiers behind a billing service/adapter.
4. Never trust the client to determine subscription status, plan, price, quota, payment status, or entitlement.
5. Server-side billing state is the source of truth for application entitlements.
6. Verify Flutterwave webhook authenticity before processing billing events.
7. Billing webhook handling must be idempotent; receiving the same event twice must not duplicate state changes.
8. Never grant paid entitlements before the required payment confirmation is verified.
9. Never remove paid entitlements solely because a client request says payment failed.
10. Usage counters must be updated transactionally.
11. Retrying a failed transcript job must not consume another transcript allowance.
12. A transcript counts once at successful transcript creation according to the approved usage transaction.
13. Check the applicable quota before starting expensive AI processing.
14. Do not call an AI provider after the quota has already been exceeded.
15. Keep billing calculations and entitlement checks centralized rather than duplicating them across routes.
16. Never hard-code production prices or plan limits in multiple files.
17. Changes to plan limits, quotas, or billing rules must be explicit and migration-safe where existing records are affected.
18. Log safe billing identifiers and state transitions for debugging without logging payment credentials or sensitive payment data.

## Done

A billing change is not complete if it can double-charge, double-count usage, grant incorrect access, lose paid access incorrectly, or rely on client-controlled billing state.