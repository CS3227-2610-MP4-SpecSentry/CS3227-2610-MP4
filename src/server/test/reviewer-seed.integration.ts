import { readConfig } from '../src/config';
import { DatabaseService } from '../src/database/database.service';
import { hashPassword } from '../src/identity/identity.service';
import { REVIEWER_FIXTURE_IDS, seedReviewerFixtures } from '../src/reviews/seed-reviewer';

describe('Reviewer development/test fixtures (INT-11)', () => {
  let database: DatabaseService;
  const ownedAccounts: string[] = [];
  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL) throw new Error('Explicit disposable TEST_DATABASE_URL is required');
    database = new DatabaseService(readConfig({ NODE_ENV: 'test', DATABASE_URL: process.env.TEST_DATABASE_URL,
      SESSION_SECRET: 'reviewer-seed-test-secret-at-least-32' }));
    await database.client.$executeRawUnsafe('TRUNCATE "ReleasePublicationSnapshot", "ReleaseSmokeTest", "ReleaseCandidateMember", "Notification", "ApprovalInvalidation", "ReleaseCandidate", "WorkingRevision", "CoverageEvidence", "CoverageAssessment", "FindingEvent", "ReviewFinding", "ReviewDecision", "ReviewIdempotency", "CriterionEvidenceLink", "ProposalActivity", "ReviewAssignment", "AcceptanceCriterion", "TestEvidence", "ProposalRevision", "ChangeProposal"');
    for (const [username, role] of [['contributor1', 'CONTRIBUTOR'], ['reviewer1', 'REVIEWER']] as const) {
      if (!await database.client.userAccount.findUnique({ where: { username } })) {
        const account = await database.client.userAccount.create({ data: { username, role, passwordHash: await hashPassword('synthetic-fixture-test-password') } });
        ownedAccounts.push(account.id);
      }
    }
  });
  afterAll(async () => {
    if (!database) return;
    await database.client.$executeRawUnsafe('TRUNCATE "ReleasePublicationSnapshot", "ReleaseSmokeTest", "ReleaseCandidateMember", "Notification", "ApprovalInvalidation", "ReleaseCandidate", "WorkingRevision", "CoverageEvidence", "CoverageAssessment", "FindingEvent", "ReviewFinding", "ReviewDecision", "ReviewIdempotency", "CriterionEvidenceLink", "ProposalActivity", "ReviewAssignment", "AcceptanceCriterion", "TestEvidence", "ProposalRevision", "ChangeProposal"');
    await database.client.userAccount.deleteMany({ where: { id: { in: ownedAccounts } } });
    await database.onModuleDestroy();
  });
  it('creates atomic synthetic submitted graphs with history, optional evidence, ages and frozen-state fixtures', async () => {
    expect(await seedReviewerFixtures(database, 'test')).toEqual({ created: 6, skipped: 0 });
    expect(await database.client.changeProposal.count({ where: { id: { in: Object.values(REVIEWER_FIXTURE_IDS) } } })).toBe(6);
    expect(await database.client.proposalRevision.count()).toBe(8);
    expect(await database.client.acceptanceCriterion.count({ where: { required: true } })).toBe(8);
    expect(await database.client.criterionEvidenceLink.count()).toBe(8);
    expect(await database.client.changeProposal.findUnique({ where: { id: REVIEWER_FIXTURE_IDS.frozen } })).toMatchObject({ state: 'APPROVED' });
  });
  it('concurrent reruns preserve changed roots and immutable snapshots exactly', async () => {
    const original = await database.client.proposalRevision.findMany({ orderBy: { id: 'asc' } });
    await database.client.changeProposal.update({ where: { id: REVIEWER_FIXTURE_IDS.pool }, data: { title: 'Human-modified fixture title', version: 5 } });
    const results = await Promise.all([seedReviewerFixtures(database, 'test'), seedReviewerFixtures(database, 'development')]);
    expect(results).toEqual([{ created: 0, skipped: 6 }, { created: 0, skipped: 6 }]);
    expect(await database.client.changeProposal.findUnique({ where: { id: REVIEWER_FIXTURE_IDS.pool } })).toMatchObject({ title: 'Human-modified fixture title', version: 5 });
    expect(await database.client.proposalRevision.findMany({ orderBy: { id: 'asc' } })).toEqual(original);
  });
  it('refuses production before any database read or mutation', async () => {
    const transaction = jest.spyOn(database.client, '$transaction');
    await expect(seedReviewerFixtures(database, 'production')).rejects.toThrow('development or test');
    expect(transaction).not.toHaveBeenCalled(); transaction.mockRestore();
  });
});
