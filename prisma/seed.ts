import { createHash, randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { faker } from '@faker-js/faker';

import {
  PrismaClient,
  SubscriptionTier,
  JobStatus,
  JobFailureType,
  Severity,
  Sentiment,
  TranscriptSourceType,
  ExportFormat,
  ExportJobStatus,
} from '@prisma/client';

/**
 * =============================================================================
 * Step 2 — Get Your Data
 * =============================================================================
 * Populate the dev database with a realistic dataset, several hundred records
 * per resource, using Faker. The script is PART OF THE SOURCE CODE and is safe
 * to run repeatedly:
 *
 *  1. IDEMPOTENT — every seed row is assigned an opaque, generated id with the
 *     stable `seed_` prefix. Before inserting, all rows with that prefix are
 *     removed in dependency order, so re-runs never accumulate duplicates and
 *     always converge to the exact same row counts.
 *  2. NON-SEQUENTIAL IDENTIFIERS — ids are SHA-256 digests of stable seed
 *     keys, not sequential integers (see README "Identifiers").
 *  3. VALID RELATIONSHIPS — rows are built bottom-up, each referencing only
 *     ids created in the same run. A relationship integrity check runs last
 *     and fails the script if any orphan is found.
 *  4. NO SCHEMA CHANGES — uses the existing `prisma/schema.prisma` models.
 *
 * Usage:
 *   npm run prisma:seed
 * =============================================================================
 */

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Volumes and knobs
// ---------------------------------------------------------------------------
const SEED_ORG_COUNT = 250;
const SEED_USER_COUNT = 400;
const SEED_TRANSCRIPT_COUNT = 600; // each transcript also yields Summary + ProcessingJob
const FAKER_SEED = 42;
const SEED_PASSWORD = 'Password123!'; // demo/dev only; never used in production auth
const SEED_PREFIX = 'seed_'; // stable id prefix identifying rows owned by this script

const BATCH_SIZE = 500;

// ---------------------------------------------------------------------------
// Deterministic, opaque, non-sequential identifiers
// ---------------------------------------------------------------------------

/**
 * Generate a stable, opaque id for a seed row.
 * Never sequential: enumeration by counting is impossible. Deterministic in
 * the seed key so re-runs recreate the same ids (idempotency) and rows are
 * easy to identify/clean by the `seed_` prefix.
 */
function seedId(resource: string, key: string): string {
  const digest = createHash('sha256').update(`${resource}:${key}`).digest('hex').slice(0, 24);
  return `${SEED_PREFIX}${digest}`;
}

/**
 * Weighted pick: returns `true` ~`chance`% of the time (deterministic per call
 * order thanks to the seeded faker).
 */
function weighted(chance: number): boolean {
  return faker.number.float({ min: 0, max: 1 }) < chance;
}

// ---------------------------------------------------------------------------
// Realistic content pools
// ---------------------------------------------------------------------------
const TRANSCRIPT_TOPICS = [
  'Onboarding Flow Usability Study',
  'Enterprise Billing & Pricing Feedback',
  'Customer Success Quarterly Review',
  'Mobile App Navigation Testing',
  'API Integration Pain Points Interview',
  'Dashboard Analytics Usability',
  'Notification Preferences Deep Dive',
  'Export & Reporting Workflow Review',
  'Account Security Perception Study',
  'Team Collaboration Habits Interview',
  'Mobile Notifications Tuning Session',
  'Data Migration Experience Review',
] as const;

const TAG_POOL = [
  'Onboarding',
  'Billing',
  'CS Call',
  'Mobile UX',
  'Integrations',
  'Dashboard',
  'Analytics',
  'Notifications',
  'Exports',
  'Security',
  'Collaboration',
  'Migration',
  'Research 2026',
  'v1-Cohort',
  'Follow-up',
] as const;

const INTERVIEW_OPENERS = [
  'Welcome to our interview. We appreciate your time.',
  'Thanks for joining today. Let us dive straight in.',
  'Good to have you. We are here to hear about your experience.',
] as const;

const THEME_TOPICS = [
  { title: 'Friction in Multi-Step Onboarding', sentiment: Sentiment.NEGATIVE },
  { title: 'High Satisfaction with Automated Insights', sentiment: Sentiment.POSITIVE },
  { title: 'Demand for Flexible Export Customization', sentiment: Sentiment.MIXED },
  { title: 'Confusion About Permission Configuration', sentiment: Sentiment.NEGATIVE },
  { title: 'Positive Response to Faster Loading Times', sentiment: Sentiment.POSITIVE },
  { title: 'Ambivalence Around Notification Volume', sentiment: Sentiment.NEUTRAL },
  { title: 'Concern Over Billing Boundary Limits', sentiment: Sentiment.MIXED },
  { title: 'Excitement About New Analytics Weeklies', sentiment: Sentiment.POSITIVE },
] as const;

const PAIN_POINTS = [
  { title: 'Delayed Onboarding Invites', severity: Severity.HIGH },
  { title: 'Quota Visibility Uncertainty', severity: Severity.MEDIUM },
  { title: 'PDF Export Layout Customization', severity: Severity.LOW },
  { title: 'Permission Role Confusion', severity: Severity.HIGH },
  { title: 'Slow Sync After Large Uploads', severity: Severity.MEDIUM },
  { title: 'Missing Bulk Actions', severity: Severity.LOW },
] as const;

const ACTION_ITEMS = [
  'Investigate email delivery delays during peak onboarding hours.',
  'Add a real-time usage progress indicator to the dashboard.',
  'Implement PDF export template styling options.',
  'Clarify role permission copy in the invite flow.',
  'Add resumable uploads for large transcript files.',
  'Ship a bulk-select action toolbar for transcripts.',
] as const;

// ---------------------------------------------------------------------------
// Seed construction
// ---------------------------------------------------------------------------

async function main() {
  faker.seed(FAKER_SEED);
  const startedAt = Date.now();

  console.log(`🌱 Step 2 seed: ${SEED_ORG_COUNT} orgs, ${SEED_USER_COUNT} users, ${SEED_TRANSCRIPT_COUNT} transcripts …`);

  // 0. Clear any previous seed rows (dependency order: children first) so the
  //    dataset converges to exactly the planned counts on every run.
  const clearSteps = [
    ['exportJob', () => prisma.exportJob.deleteMany({ where: { id: { startsWith: SEED_PREFIX } } })],
    ['processingJob', () => prisma.processingJob.deleteMany({ where: { id: { startsWith: SEED_PREFIX } } })],
    ['actionItem', () => prisma.actionItem.deleteMany({ where: { id: { startsWith: SEED_PREFIX } } })],
    ['quote', () => prisma.quote.deleteMany({ where: { id: { startsWith: SEED_PREFIX } } })],
    ['painPoint', () => prisma.painPoint.deleteMany({ where: { id: { startsWith: SEED_PREFIX } } })],
    ['theme', () => prisma.theme.deleteMany({ where: { id: { startsWith: SEED_PREFIX } } })],
    ['summary', () => prisma.summary.deleteMany({ where: { id: { startsWith: SEED_PREFIX } } })],
    ['usageRecord', () => prisma.usageRecord.deleteMany({ where: { id: { startsWith: SEED_PREFIX } } })],
    ['transcript', () => prisma.transcript.deleteMany({ where: { id: { startsWith: SEED_PREFIX } } })],
    ['user', () => prisma.user.deleteMany({ where: { id: { startsWith: SEED_PREFIX } } })],
    ['organization', () => prisma.organization.deleteMany({ where: { id: { startsWith: SEED_PREFIX } } })],
  ] as const;

  for (const [model, clear] of clearSteps) {
    await clear();
  }

  // 1. Organizations
  const organizations = Array.from({ length: SEED_ORG_COUNT }, (_, i) => ({
    id: seedId('org', `org:${i}`),
    name: faker.company.name(),
    createdAt: faker.date.between({ from: '2024-01-01', to: '2025-06-30' }),
  }));
  await chunked((batch) => prisma.organization.createMany({ data: batch }), organizations, 'organization');

  // 2. Users (single bcrypt hash reused across seed users)
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
  const usedEmails = new Set<string>();
  const users = Array.from({ length: SEED_USER_COUNT }, (_, i) => {
    let email = '';
    do {
      email = faker.internet.email({ firstName: faker.person.firstName(), lastName: faker.person.lastName() }).toLowerCase();
    } while (usedEmails.has(email));
    usedEmails.add(email);

    const tier = weighted(0.3) ? SubscriptionTier.PAID : SubscriptionTier.FREE;
    return {
      id: seedId('user', `user:${i}`),
      email,
      passwordHash,
      googleId: weighted(0.2) ? `google_${randomUUID()}` : null,
      subscriptionTier: tier,
      stripeCustomerId: tier === SubscriptionTier.PAID && weighted(0.8) ? `cus_seed_${i}` : null,
      organizationId: weighted(0.5) ? organizations[Math.floor(faker.number.int({ min: 0, max: SEED_ORG_COUNT - 1 }))].id : null,
      createdAt: faker.date.between({ from: '2025-01-01', to: '2026-07-31' }),
      deletedAt: weighted(0.05) ? faker.date.between({ from: '2026-06-01', to: '2026-08-31' }) : null,
    };
  });
  await chunked((batch) => prisma.user.createMany({ data: batch }), users, 'user');

  // 3. Transcripts — exactly SEED_TRANSCRIPT_COUNT distributed round-robin so
  //    every transcript points at an existing user.
  const transcripts: Array<{
    id: string;
    userId: string;
    title: string;
    interviewDate: Date;
    interviewee: string;
    tags: string[];
    sourceType: TranscriptSourceType;
    originalFileKey: string | null;
    extractedText: string;
    wordCount: number;
    detectedLanguage: string | null;
    isNonEnglish: boolean;
    isLowConfidence: boolean;
    createdAt: Date;
    deletedAt: Date | null;
  }> = [];

  const sourceTypes = Object.values(TranscriptSourceType);
  for (let i = 0; i < SEED_TRANSCRIPT_COUNT; i++) {
    const user = users[i % users.length];
    const perUserIndex = Math.floor(i / users.length);
    const topic = TRANSCRIPT_TOPICS[i % TRANSCRIPT_TOPICS.length];
    const sourceType = sourceTypes[faker.number.int({ min: 0, max: sourceTypes.length - 1 })];

    // Realistic multi-turn interview text.
    const turns = Array.from({ length: faker.number.int({ min: 5, max: 10 }) }, (_, t) => {
      const speaker = t % 2 === 0 ? 'SPEAKER_01' : 'SPEAKER_02';
      const sentence = faker.lorem.sentence({ min: 8, max: 22 });
      return `${speaker}: ${sentence}`;
    });
    const extractedText = [faker.helpers.arrayElement(INTERVIEW_OPENERS), ...turns].join('\n');

    transcripts.push({
      id: seedId('trx', `trx:${user.id}:${perUserIndex}`),
      userId: user.id,
      title: `${topic} - Session ${perUserIndex + 1}`,
      interviewDate: faker.date.between({ from: '2026-01-01', to: '2026-08-31' }),
      interviewee: faker.person.fullName(),
      tags: Array.from(new Set(faker.helpers.arrayElements(TAG_POOL as unknown as string[], faker.number.int({ min: 2, max: 4 })))),
      sourceType,
      originalFileKey:
        sourceType !== TranscriptSourceType.PASTE
          ? `transcripts/${user.id}/${seedId('trx', `trx:${user.id}:${perUserIndex}`)}/original.${sourceType.toLowerCase()}`
          : null,
      extractedText,
      wordCount: faker.number.int({ min: 1000, max: 5000 }),
      detectedLanguage: 'en',
      isNonEnglish: false,
      isLowConfidence: weighted(0.05),
      createdAt: faker.date.between({ from: '2026-01-01', to: '2026-08-31' }),
      deletedAt: weighted(0.05) ? faker.date.between({ from: '2026-07-01', to: '2026-09-30' }) : null,
    });
  }
  await chunked((batch) => prisma.transcript.createMany({ data: batch }), transcripts, 'transcript');

  // 4. Summary — exactly one per transcript (1:1).
  const summaries = transcripts.map((t) => ({
    id: seedId('sum', `sum:${t.id}`),
    transcriptId: t.id,
    content: faker.lorem.paragraphs({ min: 2, max: 3 }),
    editedAt: weighted(0.3) ? faker.date.recent({ days: 90 }) : null,
  }));
  await chunked((batch) => prisma.summary.createMany({ data: batch }), summaries, 'summary');

  // 5. Themes — 3 per transcript, each linked to its own transcript.
  const themes: Array<{ id: string; transcriptId: string; title: string; description: string; sentiment: Sentiment; sentimentReason: string; editedAt: Date | null }> = [];
  for (const t of transcripts) {
    for (let k = 0; k < 3; k++) {
      const topic = THEME_TOPICS[faker.number.int({ min: 0, max: THEME_TOPICS.length - 1 })];
      themes.push({
        id: seedId('thm', `thm:${t.id}:${k}`),
        transcriptId: t.id,
        title: topic.title,
        description: faker.lorem.sentence({ min: 6, max: 14 }),
        sentiment: topic.sentiment,
        sentimentReason: faker.lorem.sentence({ min: 5, max: 12 }),
        editedAt: weighted(0.3) ? faker.date.recent({ days: 90 }) : null,
      });
    }
  }
  await chunked((batch) => prisma.theme.createMany({ data: batch }), themes, 'theme');

  // 6. Pain Points — 3 per transcript, linked to transcript + (mostly) a theme.
  const painPoints: Array<{ id: string; transcriptId: string; themeId: string | null; title: string; description: string; severity: Severity; editedAt: Date | null }> = [];
  for (const t of transcripts) {
    const transcriptThemes = themes.filter(th => th.transcriptId === t.id);
    for (let k = 0; k < 3; k++) {
      const template = PAIN_POINTS[faker.number.int({ min: 0, max: PAIN_POINTS.length - 1 })];
      painPoints.push({
        id: seedId('pp', `pp:${t.id}:${k}`),
        transcriptId: t.id,
        themeId: weighted(0.9) ? transcriptThemes[k % transcriptThemes.length].id : null,
        title: template.title,
        description: faker.lorem.sentence({ min: 6, max: 16 }),
        severity: template.severity,
        editedAt: weighted(0.2) ? faker.date.recent({ days: 90 }) : null,
      });
    }
  }
  await chunked((batch) => prisma.painPoint.createMany({ data: batch }), painPoints, 'painPoint');

  // 7. Quotes — 4 per transcript, ≤ 50 words each.
  const quotes: Array<{ id: string; transcriptId: string; themeId: string | null; text: string; speakerLabel: string | null; sourceOffsetStart: number | null; sourceOffsetEnd: number | null; wasTruncated: boolean; editedAt: Date | null }> = [];
  for (const t of transcripts) {
    const transcriptThemes = themes.filter(th => th.transcriptId === t.id);
    for (let k = 0; k < 4; k++) {
      const text = `${faker.lorem.words(faker.number.int({ min: 8, max: 18 }))}.`;
      const start = faker.number.int({ min: 0, max: 4000 });
      const end = start + text.length;
      quotes.push({
        id: seedId('q', `q:${t.id}:${k}`),
        transcriptId: t.id,
        themeId: weighted(0.9) ? transcriptThemes[k % transcriptThemes.length].id : null,
        text,
        speakerLabel: faker.helpers.arrayElement(['SPEAKER_01', 'SPEAKER_02']),
        sourceOffsetStart: start,
        sourceOffsetEnd: end,
        wasTruncated: weighted(0.1),
        editedAt: weighted(0.2) ? faker.date.recent({ days: 90 }) : null,
      });
    }
  }
  await chunked((batch) => prisma.quote.createMany({ data: batch }), quotes, 'quote');

  // 8. Action Items — 3 per transcript.
  const actionItems: Array<{ id: string; transcriptId: string; themeId: string | null; description: string; editedAt: Date | null }> = [];
  for (const t of transcripts) {
    const transcriptThemes = themes.filter(th => th.transcriptId === t.id);
    for (let k = 0; k < 3; k++) {
      actionItems.push({
        id: seedId('ai', `ai:${t.id}:${k}`),
        transcriptId: t.id,
        themeId: weighted(0.9) ? transcriptThemes[k % transcriptThemes.length].id : null,
        description: ACTION_ITEMS[faker.number.int({ min: 0, max: ACTION_ITEMS.length - 1 })],
        editedAt: weighted(0.2) ? faker.date.recent({ days: 90 }) : null,
      });
    }
  }
  await chunked((batch) => prisma.actionItem.createMany({ data: batch }), actionItems, 'actionItem');

  // 9. Processing Jobs — 1 per transcript.
  const processingJobs: Array<{
    id: string; transcriptId: string; status: JobStatus; attemptCount: number; lastError: string | null;
    lastFailureType: JobFailureType | null; chunkCount: number | null; failedChunks: number;
    claimedAt: Date | null; createdAt: Date; startedAt: Date | null; completedAt: Date | null;
  }> = [];
  for (const t of transcripts) {
    const roll = faker.number.float({ min: 0, max: 1 });
    const status = roll < 0.85 ? JobStatus.COMPLETE : roll < 0.9 ? JobStatus.PROCESSING : roll < 0.95 ? JobStatus.QUEUED : JobStatus.FAILED;
    const createdAt = faker.date.between({ from: '2026-01-01', to: '2026-08-31' });
    processingJobs.push({
      id: seedId('proc', `proc:${t.id}`),
      transcriptId: t.id,
      status,
      attemptCount: status === JobStatus.FAILED ? 2 : 1,
      lastError: status === JobStatus.FAILED ? 'Chunk validation failed (seed scenario)' : null,
      lastFailureType: status === JobStatus.FAILED ? faker.helpers.arrayElement([JobFailureType.TRANSIENT, JobFailureType.DETERMINISTIC]) : null,
      chunkCount: status === JobStatus.QUEUED ? null : faker.number.int({ min: 1, max: 8 }),
      failedChunks: status === JobStatus.FAILED ? faker.number.int({ min: 1, max: 3 }) : 0,
      claimedAt: status === JobStatus.QUEUED ? null : new Date(createdAt.getTime() + 60000),
      createdAt,
      startedAt: status === JobStatus.QUEUED ? null : new Date(createdAt.getTime() + 60000),
      completedAt: status === JobStatus.COMPLETE || status === JobStatus.FAILED ? new Date(createdAt.getTime() + 150000) : null,
    });
  }
  await chunked((batch) => prisma.processingJob.createMany({ data: batch }), processingJobs, 'processingJob');

  // 10. Export Jobs — ~2/3 of transcripts, referencing transcript + owning user.
  const exportJobs: Array<{ id: string; transcriptId: string; userId: string; format: ExportFormat; status: ExportJobStatus; resultFileKey: string | null; createdAt: Date; completedAt: Date | null }> = [];
  for (const t of transcripts) {
    if (!weighted(0.66)) continue;
    const format = weighted(0.5) ? ExportFormat.PDF : ExportFormat.MARKDOWN;
    const status = weighted(0.9) ? ExportJobStatus.COMPLETE : ExportJobStatus.QUEUED;
    const createdAt = faker.date.between({ from: '2026-01-01', to: '2026-08-31' });
    exportJobs.push({
      id: seedId('exp', `exp:${t.id}`),
      transcriptId: t.id,
      userId: t.userId,
      format,
      status,
      resultFileKey:
        status === ExportJobStatus.COMPLETE
          ? `exports/${t.userId}/${t.id}/report.${format === ExportFormat.PDF ? 'pdf' : 'md'}`
          : null,
      createdAt,
      completedAt: status === ExportJobStatus.COMPLETE ? new Date(createdAt.getTime() + 20000) : null,
    });
  }
  await chunked((batch) => prisma.exportJob.createMany({ data: batch }), exportJobs, 'exportJob');

  // 11. Usage Records — one per user for the current month, within tier limits.
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const usageRecords = users.map((u) => ({
    id: seedId('usage', `usage:${u.id}`),
    userId: u.id,
    periodStart,
    periodEnd,
    transcriptsUsed: u.subscriptionTier === SubscriptionTier.PAID
      ? faker.number.int({ min: 0, max: 50 })
      : faker.number.int({ min: 0, max: 3 }),
  }));
  await chunked((batch) => prisma.usageRecord.createMany({ data: batch }), usageRecords, 'usageRecord');

  // -------------------------------------------------------------------------
  // 12. Relationship integrity check — no orphans allowed.
  // -------------------------------------------------------------------------
  const orphanQueries: Array<[string, string]> = [
    ['User', 'SELECT count(*)::int FROM "User" child LEFT JOIN "Organization" parent ON parent.id = child."organizationId" WHERE child."organizationId" IS NOT NULL AND parent.id IS NULL'],
    ['Transcript', 'SELECT count(*)::int FROM "Transcript" child LEFT JOIN "User" parent ON parent.id = child."userId" WHERE parent.id IS NULL'],
    ['Summary', 'SELECT count(*)::int FROM "Summary" child LEFT JOIN "Transcript" parent ON parent.id = child."transcriptId" WHERE parent.id IS NULL'],
    ['Theme', 'SELECT count(*)::int FROM "Theme" child LEFT JOIN "Transcript" parent ON parent.id = child."transcriptId" WHERE parent.id IS NULL'],
    ['PainPoint (transcript)', 'SELECT count(*)::int FROM "PainPoint" child LEFT JOIN "Transcript" parent ON parent.id = child."transcriptId" WHERE parent.id IS NULL'],
    ['PainPoint (theme)', 'SELECT count(*)::int FROM "PainPoint" child LEFT JOIN "Theme" parent ON parent.id = child."themeId" WHERE child."themeId" IS NOT NULL AND parent.id IS NULL'],
    ['Quote (transcript)', 'SELECT count(*)::int FROM "Quote" child LEFT JOIN "Transcript" parent ON parent.id = child."transcriptId" WHERE parent.id IS NULL'],
    ['Quote (theme)', 'SELECT count(*)::int FROM "Quote" child LEFT JOIN "Theme" parent ON parent.id = child."themeId" WHERE child."themeId" IS NOT NULL AND parent.id IS NULL'],
    ['ActionItem (transcript)', 'SELECT count(*)::int FROM "ActionItem" child LEFT JOIN "Transcript" parent ON parent.id = child."transcriptId" WHERE parent.id IS NULL'],
    ['ActionItem (theme)', 'SELECT count(*)::int FROM "ActionItem" child LEFT JOIN "Theme" parent ON parent.id = child."themeId" WHERE child."themeId" IS NOT NULL AND parent.id IS NULL'],
    ['ProcessingJob', 'SELECT count(*)::int FROM "ProcessingJob" child LEFT JOIN "Transcript" parent ON parent.id = child."transcriptId" WHERE parent.id IS NULL'],
    ['ExportJob (transcript)', 'SELECT count(*)::int FROM "ExportJob" child LEFT JOIN "Transcript" parent ON parent.id = child."transcriptId" WHERE parent.id IS NULL'],
    ['ExportJob (user)', 'SELECT count(*)::int FROM "ExportJob" child LEFT JOIN "User" parent ON parent.id = child."userId" WHERE parent.id IS NULL'],
    ['UsageRecord', 'SELECT count(*)::int FROM "UsageRecord" child LEFT JOIN "User" parent ON parent.id = child."userId" WHERE parent.id IS NULL'],
  ];

  let orphans = 0;
  for (const [label, sql] of orphanQueries) {
    const [row] = await prisma.$queryRawUnsafe<Array<{ count: number }>>(sql);
    if (row.count !== 0) {
      orphans += row.count;
      console.error(`  ✗ Orphaned ${label}: ${row.count} row(s).`);
    }
  }
  if (orphans > 0) {
    throw new Error(`Seed produced ${orphans} orphaned records; aborting.`);
  }

  // -------------------------------------------------------------------------
  // 13. Report
  // -------------------------------------------------------------------------
  const countSteps = [
    ['organization', () => prisma.organization.count({ where: { id: { startsWith: SEED_PREFIX } } }), () => prisma.organization.count()],
    ['user', () => prisma.user.count({ where: { id: { startsWith: SEED_PREFIX } } }), () => prisma.user.count()],
    ['transcript', () => prisma.transcript.count({ where: { id: { startsWith: SEED_PREFIX } } }), () => prisma.transcript.count()],
    ['summary', () => prisma.summary.count({ where: { id: { startsWith: SEED_PREFIX } } }), () => prisma.summary.count()],
    ['theme', () => prisma.theme.count({ where: { id: { startsWith: SEED_PREFIX } } }), () => prisma.theme.count()],
    ['painPoint', () => prisma.painPoint.count({ where: { id: { startsWith: SEED_PREFIX } } }), () => prisma.painPoint.count()],
    ['quote', () => prisma.quote.count({ where: { id: { startsWith: SEED_PREFIX } } }), () => prisma.quote.count()],
    ['actionItem', () => prisma.actionItem.count({ where: { id: { startsWith: SEED_PREFIX } } }), () => prisma.actionItem.count()],
    ['processingJob', () => prisma.processingJob.count({ where: { id: { startsWith: SEED_PREFIX } } }), () => prisma.processingJob.count()],
    ['exportJob', () => prisma.exportJob.count({ where: { id: { startsWith: SEED_PREFIX } } }), () => prisma.exportJob.count()],
    ['usageRecord', () => prisma.usageRecord.count({ where: { id: { startsWith: SEED_PREFIX } } }), () => prisma.usageRecord.count()],
  ] as const;

  const counts = [];
  for (const [model, seedCount, totalCount] of countSteps) {
    counts.push({
      model,
      seedCount: await seedCount(),
      totalCount: await totalCount(),
    });
  }

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\n✅ Seed completed in ${elapsedSec}s — ${counts.reduce((sum, c) => sum + c.seedCount, 0).toLocaleString()} seed rows, 0 orphans.`);
  console.table(counts.map(c => ({ Resource: c.model, 'Seed rows': c.seedCount, 'Total rows': c.totalCount })));
}

/**
 * Run createMany in bounded batches so a single statement never exceeds
 * Postgres parameter limits.
 */
async function chunked<T>(run: (batch: T[]) => Promise<unknown>, rows: T[], label: string): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    await run(rows.slice(i, i + BATCH_SIZE));
  }
  console.log(`  ✓ ${label.padEnd(14)} ${rows.length.toLocaleString()} rows`);
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });