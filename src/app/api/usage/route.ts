import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/db/prisma';
import { SubscriptionTier } from '@prisma/client';

/**
 * GET /api/usage
 * Returns current calendar month usage count and quota limit for the user.
 */
export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id') || 'user_alex_pm';

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const usageRecord = await prisma.usageRecord.findUnique({
      where: {
        userId_periodStart: {
          userId: user.id,
          periodStart,
        },
      },
    });

    const maxLimit = user.subscriptionTier === SubscriptionTier.PAID ? 50 : 3;
    const used = usageRecord ? usageRecord.transcriptsUsed : 0;

    return NextResponse.json({
      subscriptionTier: user.subscriptionTier,
      transcriptsUsed: used,
      monthlyLimit: maxLimit,
      remaining: Math.max(0, maxLimit - used),
      periodStart: periodStart.toISOString(),
    });
  } catch (error: any) {
    console.error('Error in GET /api/usage:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
