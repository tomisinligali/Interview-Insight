---
trigger: always_on
---

# Git Conventions

## Purpose

Keep changes traceable, reviewable, and safe to integrate.

## Rules

1. Make each commit represent one coherent change.
2. Do not mix unrelated features, refactors, formatting changes, or dependency changes in the same commit.
3. Use clear commit messages that describe the actual change.
4. Keep commits small enough to review and revert safely.
5. Do not commit secrets, `.env` files, credentials, API keys, tokens, or generated sensitive data.
6. Do not rewrite shared branch history unless explicitly required.
7. Do not commit broken builds, failing tests, or known incomplete migrations.
8. Database migrations must be committed with the code that requires them.
9. Dependency changes must be intentional and visible in the commit.
10. Before considering work complete, verify the relevant tests, type checks, and lint checks pass.
11. Do not use Git history as a substitute for proper application versioning or user-facing edit history.

## Done

A Git change is acceptable when another engineer can understand what changed, why it changed, and safely revert it if necessary.