/** Prisma `select` projections shared across route handlers. */

/** Public user projection — password hashes are never returned. */
export const userPublicSelect = {
  id: true,
  email: true,
  googleId: true,
  createdAt: true,
  deletedAt: true,
  subscriptionTier: true,
  stripeCustomerId: true,
  organizationId: true,
} as const;