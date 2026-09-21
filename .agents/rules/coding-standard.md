---
trigger: always_on
---

# Coding Standard

## Purpose

Keep the codebase predictable, maintainable, type-safe, and easy for another agent or engineer to modify.

## Rules

1. Use TypeScript throughout the application.
2. Prefer strict typing over `any`, implicit coercion, or unchecked casts.
3. Keep business logic out of UI components and route handlers when it can be isolated into services or domain modules.
4. Keep API validation at the boundary before business logic runs.
5. Reuse existing utilities and services before creating duplicates.
6. Keep functions focused on one responsibility.
7. Prefer small, readable modules over large multi-purpose files.
8. Use descriptive names; do not shorten names when doing so harms clarity.
9. Do not silently swallow errors.
10. Return structured errors from backend operations and handle them explicitly in the UI.
11. Do not expose secrets, provider keys, database credentials, or internal error details to the client.
12. Use Prisma for database access; do not introduce a second ORM.
13. Follow the project's existing formatting, linting, and type-checking configuration.
14. Do not introduce a new dependency when existing project dependencies already solve the problem.
15. Do not change architecture, frameworks, or core infrastructure without a documented product or engineering requirement.
16. Code must remain compatible with the project's supported LTS/runtime versions.
17. Tests should cover business-critical behavior, especially authentication, billing, transcript processing, AI validation, deletion, and job handling.

## Done

A change is not complete if it only works locally but introduces type errors, lint failures, broken tests, duplicated business logic, or bypasses established application boundaries.