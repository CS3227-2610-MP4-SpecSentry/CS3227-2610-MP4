import { randomUUID } from 'node:crypto';
import { createPatchRiskFixture } from './reviewer-patch-risk';

export async function createReviewerUsageFixture() {
  const fixture = await createPatchRiskFixture();
  const requestIds: string[] = [];
  async function seed(actorId: string, feature: 'REVIEWER' | 'CONTRIBUTOR', tokens: number) {
    const id = randomUUID(); requestIds.push(id);
    // Prisma timestamp columns store UTC without a zone; database-local now() is not a UTC fixture clock.
    const timestamp = new Date().toISOString();
    await fixture.pool.query(`INSERT INTO "AiRequest" (id,"correlationId","actorId",feature,"proposalId","revisionId","assignmentId","accessGenerationId","workingRevisionId","expectedVersion","expectedAssignmentVersion","selectedCriterionCount","templateVersion",outcome,"requestedAt")
      VALUES($1,'synthetic',$2,$3,$4,$5,$6,$7,$8,0,$9,$10,'private-template','SUCCESS',$11)`,
    [id, actorId, feature, fixture.proposal, feature === 'REVIEWER' ? fixture.revision : null, feature === 'REVIEWER' ? 'private-assignment' : null,
      feature === 'REVIEWER' ? 'private-generation' : null, feature === 'CONTRIBUTOR' ? 'private-working' : null, feature === 'REVIEWER' ? 0 : null, feature === 'REVIEWER' ? 1 : null, timestamp]);
    await fixture.pool.query(`INSERT INTO "AiOutboundAttempt" (id,"requestId","actorId",ordinal,"dispatchedAt","completedAt",outcome,"promptTokens","completionTokens","totalTokens","cachedTokens")
      VALUES($1,$2,$3,1,$5,$5,'SUCCESS',$4,0,$4,0)`, [randomUUID(), id, actorId, tokens, timestamp]);
  }
  try {
    await seed(fixture.reviewer, 'REVIEWER', 120); await seed(fixture.reviewer, 'CONTRIBUTOR', 777); await seed(fixture.owner, 'REVIEWER', 999);
    return { ...fixture, async dispose() {
      await fixture.pool.query('DELETE FROM "AiRequest" WHERE id=ANY($1::text[])', [requestIds]); await fixture.dispose();
    } };
  } catch (error) {
    await fixture.pool.query('DELETE FROM "AiRequest" WHERE id=ANY($1::text[])', [requestIds]); await fixture.dispose(); throw error;
  }
}
