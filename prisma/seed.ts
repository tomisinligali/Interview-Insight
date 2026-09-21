import { PrismaClient, SubscriptionTier, TranscriptSourceType, JobStatus, JobFailureType, Severity, Sentiment, ExportFormat, ExportJobStatus } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Helper for deterministic pseudo-random selection
function pseudoRandom(seed: number) {
  let value = seed;
  return function () {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

async function main() {
  console.log('🌱 Starting idempotent database seed...');

  const rand = pseudoRandom(42);
  const passwordHash = await bcrypt.hash('Password123!', 10);

  // 1. Seed Organizations
  const org1 = await prisma.organization.upsert({
    where: { id: 'org_acme_corp' },
    update: {},
    create: {
      id: 'org_acme_corp',
      name: 'Acme Research Labs',
      createdAt: new Date('2026-01-15T00:00:00Z'),
    },
  });

  const org2 = await prisma.organization.upsert({
    where: { id: 'org_globex' },
    update: {},
    create: {
      id: 'org_globex',
      name: 'Globex Product Team',
      createdAt: new Date('2026-02-01T00:00:00Z'),
    },
  });

  // 2. Seed Users
  const userSeeds = [
    { id: 'user_alex_pm', email: 'alex.pm@example.com', tier: SubscriptionTier.PAID, orgId: org1.id },
    { id: 'user_sam_uxr', email: 'sam.uxr@example.com', tier: SubscriptionTier.PAID, orgId: org1.id },
    { id: 'user_taylor_cs', email: 'taylor.cs@example.com', tier: SubscriptionTier.FREE, orgId: org2.id },
    { id: 'user_jordan_sales', email: 'jordan.sales@example.com', tier: SubscriptionTier.FREE, orgId: org2.id },
    { id: 'user_morgan_lead', email: 'morgan.lead@example.com', tier: SubscriptionTier.PAID, orgId: org1.id },
    { id: 'user_casey_dev', email: 'casey.dev@example.com', tier: SubscriptionTier.FREE, orgId: null },
    { id: 'user_riley_ux', email: 'riley.ux@example.com', tier: SubscriptionTier.PAID, orgId: null },
    { id: 'user_devon_analyst', email: 'devon.analyst@example.com', tier: SubscriptionTier.FREE, orgId: null },
    { id: 'user_avery_prod', email: 'avery.prod@example.com', tier: SubscriptionTier.PAID, orgId: org1.id },
    { id: 'user_quinn_research', email: 'quinn.research@example.com', tier: SubscriptionTier.FREE, orgId: null },
  ];

  const users = [];
  for (const u of userSeeds) {
    const user = await prisma.user.upsert({
      where: { id: u.id },
      update: {
        subscriptionTier: u.tier,
      },
      create: {
        id: u.id,
        email: u.email,
        passwordHash,
        subscriptionTier: u.tier,
        organizationId: u.orgId,
      },
    });
    users.push(user);
  }

  // 3. Seed Usage Records
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  for (const user of users) {
    await prisma.usageRecord.upsert({
      where: {
        userId_periodStart: {
          userId: user.id,
          periodStart: currentMonthStart,
        },
      },
      update: {},
      create: {
        id: `usage_${user.id}_${currentMonthStart.toISOString().slice(0, 7)}`,
        userId: user.id,
        periodStart: currentMonthStart,
        periodEnd: currentMonthEnd,
        transcriptsUsed: user.subscriptionTier === SubscriptionTier.PAID ? 12 : 2,
      },
    });
  }

  // 4. Sample Domain Templates for Transcripts
  const interviewTopics = [
    { title: 'Onboarding Flow Usability Study', tag: 'Onboarding', sourceType: TranscriptSourceType.DOCX },
    { title: 'Enterprise Billing & Pricing Feedback', tag: 'Billing', sourceType: TranscriptSourceType.TXT },
    { title: 'Customer Success Quarterly Review Call', tag: 'CS Call', sourceType: TranscriptSourceType.PASTE },
    { title: 'Mobile App Navigation Testing Session', tag: 'Mobile UX', sourceType: TranscriptSourceType.SRT },
    { title: 'API Integration Pain Points Interview', tag: 'Integrations', sourceType: TranscriptSourceType.VTT },
  ];

  const sampleInterviewees = [
    'Sarah Jenkins (Lead Designer at TechCorp)',
    'David Miller (VP Engineering at DataFlow)',
    'Elena Rostova (Senior Operations Manager)',
    'Marcus Vance (Head of Growth at SaaSify)',
    'Chloe Bennett (Product Specialist)',
  ];

  const sampleSummaries = [
    "The participant highlighted significant friction during the initial user onboarding flow, specifically around workspace invitation setup and role permissions. While overall sentiment toward the platform's core dashboard remains positive, confusion surrounding team configuration resulted in delayed deployment for their 50-person team.",
    "During this pricing review session, the customer expressed strong satisfaction with the automated report generation capability but voiced concern regarding tier boundary limits. They requested clearer word-count visibility and self-serve tier upgrade pathways before enterprise renewal next month.",
    "The discussion centered on export capabilities and data retention compliance. The participant emphasized that PDF formatting precision is critical for executive stakeholder briefings, whereas Markdown export is preferred for internal Notion engineering documentation.",
    "Participant tested the new mobile navigation navigation flows. Navigation was intuitive overall, but finding historical transcript exports took longer than expected due to nested menu placement under account settings rather than dashboard workspace tabs.",
    "Interview focused on developer experience during REST API integration. The participant praised detailed schema validation error messages but noted that webhook retry delay times lacked explicit documentation in the setup guide."
  ];

  const sampleThemeTemplates = [
    { title: 'Friction in Multi-Step Onboarding', sentiment: Sentiment.NEGATIVE, reason: 'Users experience confusion during workspace role assignments.' },
    { title: 'High Satisfaction with Automated Insights', sentiment: Sentiment.POSITIVE, reason: 'Automated synthesis saves 3+ hours per research cohort.' },
    { title: 'Demand for Flexible PDF Export Customization', sentiment: Sentiment.MIXED, reason: 'Markdown export works well, but PDF layout needs brand customization.' },
    { title: 'Clarification Needed on Subscription Tier Limits', sentiment: Sentiment.NEUTRAL, reason: 'Users want real-time visibility into transcript monthly quotas.' },
  ];

  let transcriptCount = 0;
  let themeCount = 0;
  let painPointCount = 0;
  let quoteCount = 0;
  let actionItemCount = 0;

  // Generate 5 transcripts per user = 50 total transcripts
  for (let uIdx = 0; uIdx < users.length; uIdx++) {
    const user = users[uIdx];

    for (let tIdx = 0; tIdx < 5; tIdx++) {
      transcriptCount++;
      const topic = interviewTopics[(uIdx + tIdx) % interviewTopics.length];
      const interviewee = sampleInterviewees[(uIdx + tIdx) % sampleInterviewees.length];
      const tId = `trx_${user.id}_${tIdx + 1}`;

      const transcriptText = `SPEAKER_01: Welcome to our interview session today. We appreciate your time.\nSPEAKER_02: Happy to be here. Overall, the experience with your product has been great, but we ran into friction during onboarding.\nSPEAKER_01: Can you elaborate on what happened during onboarding?\nSPEAKER_02: When setting up team permissions, three team members were locked out because the confirmation emails were delayed. It took us two days to resolve this with support.\nSPEAKER_01: How did that impact your timeline?\nSPEAKER_02: It delayed our project kick-off by almost a week. However, once we started using the automated insight synthesis feature, it saved us hours of manual transcript tagging.\nSPEAKER_01: That is very helpful feedback. What export formats does your team rely on most?\nSPEAKER_02: We use Markdown for Notion docs and PDF for sharing with executive leadership. We would love more control over PDF styling.`;

      const transcript = await prisma.transcript.upsert({
        where: { id: tId },
        update: {},
        create: {
          id: tId,
          userId: user.id,
          title: `${topic.title} - Session ${tIdx + 1}`,
          interviewDate: new Date(2026, 8, 10 + tIdx),
          interviewee,
          tags: [topic.tag, 'Research 2026', 'v1-Cohort'],
          sourceType: topic.sourceType,
          originalFileKey: topic.sourceType === TranscriptSourceType.PASTE ? null : `transcripts/${user.id}/${tId}/original.${topic.sourceType.toLowerCase()}`,
          extractedText: transcriptText,
          wordCount: 1450 + Math.floor(rand() * 2000),
          detectedLanguage: 'en',
          isNonEnglish: false,
          isLowConfidence: false,
          createdAt: new Date(2026, 8, 10 + tIdx),
        },
      });

      // 5. Seed Summary (1 per transcript)
      await prisma.summary.upsert({
        where: { transcriptId: transcript.id },
        update: {},
        create: {
          id: `sum_${transcript.id}`,
          transcriptId: transcript.id,
          content: sampleSummaries[(uIdx + tIdx) % sampleSummaries.length],
        },
      });

      // 6. Seed ProcessingJob (1 per transcript)
      await prisma.processingJob.upsert({
        where: { id: `proc_${transcript.id}` },
        update: {},
        create: {
          id: `proc_${transcript.id}`,
          transcriptId: transcript.id,
          status: JobStatus.COMPLETE,
          attemptCount: 1,
          lastFailureType: null,
          chunkCount: 1,
          failedChunks: 0,
          claimedAt: new Date(2026, 8, 10 + tIdx, 10, 0, 0),
          createdAt: new Date(2026, 8, 10 + tIdx, 9, 59, 0),
          startedAt: new Date(2026, 8, 10 + tIdx, 10, 0, 0),
          completedAt: new Date(2026, 8, 10 + tIdx, 10, 2, 30),
        },
      });

      // 7. Seed ExportJob (for some transcripts)
      if (tIdx % 2 === 0) {
        await prisma.exportJob.upsert({
          where: { id: `exp_${transcript.id}` },
          update: {},
          create: {
            id: `exp_${transcript.id}`,
            transcriptId: transcript.id,
            userId: user.id,
            format: tIdx % 4 === 0 ? ExportFormat.PDF : ExportFormat.MARKDOWN,
            status: ExportJobStatus.COMPLETE,
            resultFileKey: `exports/${user.id}/${transcript.id}/report.${tIdx % 4 === 0 ? 'pdf' : 'md'}`,
            createdAt: new Date(2026, 8, 11 + tIdx),
            completedAt: new Date(2026, 8, 11 + tIdx),
          },
        });
      }

      // 8. Seed Themes (3 per transcript)
      const createdThemes = [];
      for (let thIdx = 0; thIdx < 3; thIdx++) {
        themeCount++;
        const tmpl = sampleThemeTemplates[(thIdx + uIdx + tIdx) % sampleThemeTemplates.length];
        const themeId = `thm_${transcript.id}_${thIdx + 1}`;

        const theme = await prisma.theme.upsert({
          where: { id: themeId },
          update: {},
          create: {
            id: themeId,
            transcriptId: transcript.id,
            title: tmpl.title,
            description: tmpl.reason,
            sentiment: tmpl.sentiment,
            sentimentReason: tmpl.reason,
          },
        });
        createdThemes.push(theme);
      }

      // 9. Seed Quotes (4 per transcript, linked to themes)
      const quoteTexts = [
        { text: 'When setting up team permissions, three team members were locked out.', speaker: 'SPEAKER_02', start: 145, end: 221 },
        { text: 'It delayed our project kick-off by almost a week.', speaker: 'SPEAKER_02', start: 300, end: 350 },
        { text: 'Once we started using automated insight synthesis, it saved us hours.', speaker: 'SPEAKER_02', start: 380, end: 450 },
        { text: 'We use Markdown for Notion docs and PDF for sharing with executive leadership.', speaker: 'SPEAKER_02', start: 500, end: 580 },
      ];

      for (let qIdx = 0; qIdx < quoteTexts.length; qIdx++) {
        quoteCount++;
        const qData = quoteTexts[qIdx];
        const themeLink = createdThemes[qIdx % createdThemes.length];

        await prisma.quote.upsert({
          where: { id: `q_${transcript.id}_${qIdx + 1}` },
          update: {},
          create: {
            id: `q_${transcript.id}_${qIdx + 1}`,
            transcriptId: transcript.id,
            themeId: themeLink ? themeLink.id : null,
            text: qData.text,
            speakerLabel: qData.speaker,
            sourceOffsetStart: qData.start,
            sourceOffsetEnd: qData.end,
            wasTruncated: false,
          },
        });
      }

      // 10. Seed PainPoints (3 per transcript)
      const painPointData = [
        { title: 'Delayed Onboarding Invites', desc: 'Confirmation emails for new team invites experienced significant latency.', severity: Severity.HIGH },
        { title: 'Quota Visibility Uncertainty', desc: 'Users lacked real-time visibility into monthly remaining transcript quota.', severity: Severity.MEDIUM },
        { title: 'PDF Export Layout Customization', desc: 'Default PDF exports lack custom header branding options.', severity: Severity.LOW },
      ];

      for (let pIdx = 0; pIdx < painPointData.length; pIdx++) {
        painPointCount++;
        const pp = painPointData[pIdx];
        const themeLink = createdThemes[pIdx % createdThemes.length];

        await prisma.painPoint.upsert({
          where: { id: `pp_${transcript.id}_${pIdx + 1}` },
          update: {},
          create: {
            id: `pp_${transcript.id}_${pIdx + 1}`,
            transcriptId: transcript.id,
            themeId: themeLink ? themeLink.id : null,
            title: pp.title,
            description: pp.desc,
            severity: pp.severity,
          },
        });
      }

      // 11. Seed Action Items (3 per transcript)
      const actionItemData = [
        'Investigate email delivery service queue delays during peak onboarding hours.',
        'Add real-time usage progress indicator banner on user dashboard header.',
        'Implement PDF export template styling options for executive reports.',
      ];

      for (let aIdx = 0; aIdx < actionItemData.length; aIdx++) {
        actionItemCount++;
        const aiDesc = actionItemData[aIdx];
        const themeLink = createdThemes[aIdx % createdThemes.length];

        await prisma.actionItem.upsert({
          where: { id: `act_${transcript.id}_${aIdx + 1}` },
          update: {},
          create: {
            id: `act_${transcript.id}_${aIdx + 1}`,
            transcriptId: transcript.id,
            themeId: themeLink ? themeLink.id : null,
            description: aiDesc,
          },
        });
      }
    }
  }

  console.log(' Seeding completed successfully!');
  console.log(` Summary of generated seed records:`);
  console.log(`   - Organizations: ${await prisma.organization.count()}`);
  console.log(`   - Users: ${await prisma.user.count()}`);
  console.log(`   - Usage Records: ${await prisma.usageRecord.count()}`);
  console.log(`   - Transcripts: ${await prisma.transcript.count()}`);
  console.log(`   - Summaries: ${await prisma.summary.count()}`);
  console.log(`   - Processing Jobs: ${await prisma.processingJob.count()}`);
  console.log(`   - Export Jobs: ${await prisma.exportJob.count()}`);
  console.log(`   - Themes: ${await prisma.theme.count()}`);
  console.log(`   - Quotes: ${await prisma.quote.count()}`);
  console.log(`   - Pain Points: ${await prisma.painPoint.count()}`);
  console.log(`   - Action Items: ${await prisma.actionItem.count()}`);
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
