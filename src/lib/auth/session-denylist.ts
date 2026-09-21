/**
 * Server-side Session Deny-List
 * 
 * Enforces immediate session invalidation on account deletion (FR-30).
 * Active JWT sessions for deleted user IDs are rejected at the API middleware / route layer,
 * preventing deleted accounts from making authenticated calls prior to JWT expiry.
 */

const denylistedUserIds = new Set<string>();

export const sessionDenyList = {
  add(userId: string): void {
    denylistedUserIds.add(userId);
  },

  isDenyListed(userId: string): boolean {
    return denylistedUserIds.has(userId);
  },

  remove(userId: string): void {
    denylistedUserIds.delete(userId);
  },
};
