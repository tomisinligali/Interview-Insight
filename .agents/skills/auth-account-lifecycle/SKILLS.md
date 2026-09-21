---
name: auth-account-lifecycle
description: Load for signup, email/password authentication, Google OAuth, password reset, session handling, account deletion, JWT sessions, bcrypt, Auth.js, or NextAuth work.
---

# Auth Account Lifecycle

This skill teaches the ordered account lifecycle. Its laws live in `security.md` and `database-schema.md`.

## Procedure

1. Identify the account operation.
   - Signup
   - Login
   - Google OAuth
   - Password reset
   - Authenticated request
   - Account deletion

2. Validate the request at the server boundary.

3. For password signup or login:
   - Read the user by email.
   - Hash new passwords with bcrypt.
   - Compare passwords with bcrypt.
   - Never persist plaintext passwords.

4. For Google OAuth:
   - Use Auth.js/NextAuth.
   - Use the Prisma adapter.
   - Link the account to the correct user record.

5. Configure JWT sessions through Auth.js/NextAuth.

6. For every protected API request:
   - Read the authenticated session.
   - Resolve the user.
   - Check the server-side session deny-list.
   - Check resource ownership before continuing.

7. For password reset:
   - Verify the reset flow server-side.
   - Update the password through the same bcrypt path.
   - Do not expose credentials or reset secrets.

8. For account deletion:
   - Mark the account for deletion according to the product lifecycle.
   - Immediately add the user to the session deny-list.
   - Remove the user's transcripts and derived data according to database cascade behavior.
   - Remove associated stored transcript objects.

9. Return only safe client-facing results.

## Code Skeleton

```ts
// Server-side protected request
const session = await auth();

if (!session?.user?.id) {
  return unauthorized();
}

const userId = session.user.id;

if (await isSessionDenied(userId)) {
  return unauthorized();
}

const resource = await prisma.transcript.findUnique({
  where: { id: transcriptId },
});

if (!resource || resource.userId !== userId) {
  return notFound();
}
// Password creation
const passwordHash = await bcrypt.hash(password, saltRounds);

await prisma.user.create({
  data: {
    email,
    passwordHash,
  },
});
// Account deletion
await addUserToSessionDenyList(userId);

await prisma.user.update({
  where: { id: userId },
  data: { deletedAt: new Date() },
});

// Follow the approved transcript/object deletion workflow.