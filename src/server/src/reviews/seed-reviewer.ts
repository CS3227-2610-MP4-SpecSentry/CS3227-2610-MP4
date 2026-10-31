import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnvironment } from 'dotenv';
import { reviewerTitleSchema, submittedRevisionSchema, type ProposalState, type SubmittedRevision } from '@specsentry/shared';
import { readConfig, type ServerConfig } from '../config';
import { DatabaseService } from '../database/database.service';

export const REVIEWER_FIXTURE_IDS = {
  pool: 'reviewer-fixture-pool', awaitingRevision: 'reviewer-fixture-awaiting-revision',
  assigned: 'reviewer-fixture-assigned', frozen: 'reviewer-fixture-frozen',
  multiRevision: 'reviewer-fixture-history', large: 'reviewer-fixture-large',
} as const;

export function reviewerFixtureRevision(proposalId: string, number: number, submittedAt: Date, large = false): SubmittedRevision {
  const id = `${proposalId}-r${number}`;
  const evidenceText = large ? 'Synthetic evidence.\n'.repeat(2400) : 'Synthetic plain-text evidence. <script> is inert text.';
  return submittedRevisionSchema.parse({ id, number, summary: `Synthetic submitted revision ${number}.`,
    problem: 'Demonstrate the manual Reviewer intake workflow.', constraints: 'Synthetic development/test data only.',
    expectedBehavior: 'Current assignees can inspect submitted evidence and return unfinished reviews to the pool.',
    diffText: large ? '+ Synthetic diff line\n'.repeat(4500) : '--- a/example.txt\n+++ b/example.txt\n@@ -1 +1 @@\n-old\n+new\n',
    submittedAt: submittedAt.toISOString(), criteria: [{ id: `${id}-criterion`, stableKey: 'intake-criterion',
      statement: 'The submitted content is manually reviewable.', required: true }],
    evidence: [{ id: `${id}-evidence`, text: evidenceText, evidenceHash: createHash('sha256').update(evidenceText).digest('hex') }],
    criterionEvidenceLinks: [{ criterionId: `${id}-criterion`, evidenceId: `${id}-evidence` }],
  });
}

export async function seedReviewerFixtures(database: DatabaseService, environment: ServerConfig['NODE_ENV']) {
  if (!['development', 'test'].includes(environment)) throw new Error('Reviewer fixtures require development or test configuration.');
  return database.client.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('specsentry-reviewer-fixtures-v1'))::text`;
    // Fixture creation participates in the same account-before-root ordering as
    // disable, so a concurrent administrative disable cannot gain new work.
    await tx.$queryRaw`SELECT "id" FROM "UserAccount" WHERE "username" = 'reviewer1' FOR UPDATE`;
    const owner = await tx.userAccount.findUnique({ where: { username: 'contributor1' } });
    const reviewer = await tx.userAccount.findUnique({ where: { username: 'reviewer1' } });
    if (!owner?.enabled || owner.role !== 'CONTRIBUTOR' || !reviewer?.enabled || reviewer.role !== 'REVIEWER') {
      throw new Error('Seed enabled demo Contributor/Reviewer accounts before Reviewer fixtures.');
    }
    const definitions: { id: string; state: ProposalState; assigned?: boolean; revisions?: number; large?: boolean; days: number }[] = [
      { id: REVIEWER_FIXTURE_IDS.pool, state: 'SUBMITTED', days: 30 },
      { id: REVIEWER_FIXTURE_IDS.awaitingRevision, state: 'CHANGES_REQUESTED', days: 20 },
      { id: REVIEWER_FIXTURE_IDS.assigned, state: 'IN_REVIEW', assigned: true, days: 10 },
      { id: REVIEWER_FIXTURE_IDS.frozen, state: 'APPROVED', assigned: true, days: 5 },
      { id: REVIEWER_FIXTURE_IDS.multiRevision, state: 'IN_REVIEW', assigned: true, revisions: 3, days: 40 },
      { id: REVIEWER_FIXTURE_IDS.large, state: 'SUBMITTED', large: true, days: 2 },
    ];
    let created = 0;
    for (const definition of definitions) {
      if (await tx.changeProposal.findUnique({ where: { id: definition.id }, select: { id: true } })) continue;
      const firstSubmittedAt = new Date(Date.now() - definition.days * 86400000);
      await tx.changeProposal.create({ data: { id: definition.id, ownerId: owner.id, title: reviewerTitleSchema.parse(`Synthetic ${definition.id}`),
        state: definition.state, firstSubmittedAt } });
      let latestId = '';
      for (let number = 1; number <= (definition.revisions ?? 1); number++) {
        const revision = reviewerFixtureRevision(definition.id, number, new Date(firstSubmittedAt.getTime() + (number - 1) * 86400000), definition.large);
        latestId = revision.id;
        const { criteria, evidence, criterionEvidenceLinks, submittedAt, ...fields } = revision;
        await tx.proposalRevision.create({ data: { ...fields, submittedAt: new Date(submittedAt), proposalId: definition.id,
          criteria: { create: criteria }, evidence: { create: evidence } } });
        await tx.criterionEvidenceLink.createMany({ data: criterionEvidenceLinks.map((link) => ({ ...link, revisionId: revision.id })) });
        await tx.proposalActivity.create({ data: { proposalId: definition.id, revisionId: revision.id, actorId: owner.id,
          action: number === 1 ? 'SUBMITTED' : 'RESUBMITTED', summary: 'Synthetic submitted snapshot.', timestamp: new Date(submittedAt) } });
      }
      await tx.changeProposal.update({ where: { id: definition.id }, data: { currentRevisionId: latestId } });
      if (definition.assigned) {
        const assignment = await tx.reviewAssignment.create({ data: { proposalId: definition.id, revisionId: latestId, reviewerId: reviewer.id } });
        await tx.changeProposal.update({ where: { id: definition.id }, data: { currentAssignmentId: assignment.id } });
        await tx.proposalActivity.create({ data: { proposalId: definition.id, revisionId: latestId, assignmentId: assignment.id,
          actorId: reviewer.id, action: 'CLAIMED', summary: 'Synthetic assigned review.' } });
      }
      created++;
    }
    return { created, skipped: definitions.length - created };
  }, { maxWait: 5000, timeout: 10000 });
}

async function main(): Promise<void> {
  loadEnvironment({ path: resolve(__dirname, '../../../../.env'), quiet: true });
  const config = readConfig(process.env);
  if (config.NODE_ENV === 'production') throw new Error('Reviewer fixtures are unavailable in production.');
  const database = new DatabaseService(config);
  try {
    const result = await seedReviewerFixtures(database, config.NODE_ENV);
    console.info(`Reviewer fixtures: ${result.created} created, ${result.skipped} already present.`);
  } finally { await database.onModuleDestroy(); }
}

if (require.main === module) void main().catch(() => {
  console.error('Reviewer fixture seed failed. Use development/test configuration and migrated demo accounts.');
  process.exitCode = 1;
});
