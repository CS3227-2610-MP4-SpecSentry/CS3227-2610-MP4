import { randomUUID, createHash } from 'node:crypto';
import { Pool } from 'pg';
import * as argon2 from 'argon2';

/** This fixture requires an explicitly configured disposable database. */
export async function createReviewerIntakeFixture() {
  if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL must identify a disposable migrated test database');
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const prefix = `intake-${randomUUID()}`;
  const password = 'synthetic-intake-browser-password';
  const users = { author: randomUUID(), a: randomUUID(), b: randomUUID(), contributor: randomUUID() };
  const proposal = randomUUID(); const revision = randomUUID();
  const title = `${prefix} awaiting revision`;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const hash = await argon2.hash(password, { type: argon2.argon2id });
    for (const [name, id] of Object.entries(users)) await client.query('INSERT INTO "UserAccount" (id, username, "passwordHash", role) VALUES ($1,$2,$3,$4)', [id, `${prefix}-${name}`, hash, ['a', 'b'].includes(name) ? 'REVIEWER' : 'CONTRIBUTOR']);
    await client.query('INSERT INTO "ChangeProposal" (id,"ownerId",title,state,"firstSubmittedAt") VALUES ($1,$2,$3,\'CHANGES_REQUESTED\',now() - interval \'10 days\')', [proposal, users.author, title]);
    for (const [index, id] of [randomUUID(), revision].entries()) {
      await client.query('INSERT INTO "ProposalRevision" (id,"proposalId",number,summary,problem,constraints,"expectedBehavior","diffText","submittedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now() - ($9::int * interval \'1 day\'))', [id, proposal, index + 1, `Submitted summary ${index + 1}`, '<script>window.intakeInjected=true</script>', 'Synthetic constraint', 'Expected immutable behavior', '<img src=x onerror="window.intakeInjected=true">', index === 0 ? 10 : 2]);
      const criterion = randomUUID(); const evidence = randomUUID(); const text = 'Synthetic test passed <script>not executable</script>';
      await client.query('INSERT INTO "AcceptanceCriterion" (id,"revisionId","stableKey",statement,required) VALUES ($1,$2,$3,$4,true)', [criterion, id, 'AC-1', 'The change preserves immutable submitted content.']);
      await client.query('INSERT INTO "TestEvidence" (id,"revisionId",text,"evidenceHash") VALUES ($1,$2,$3,$4)', [evidence, id, text, createHash('sha256').update(text).digest('hex')]);
      await client.query('INSERT INTO "CriterionEvidenceLink" ("revisionId","criterionId","evidenceId") VALUES ($1,$2,$3)', [id, criterion, evidence]);
      await client.query('INSERT INTO "ProposalActivity" (id,"proposalId","revisionId","actorId",action,summary) VALUES ($1,$2,$3,$4,$5,$6)', [randomUUID(), proposal, id, users.author, index === 0 ? 'SUBMITTED' : 'RESUBMITTED', `Submitted revision ${index + 1}`]);
    }
    await client.query('UPDATE "ChangeProposal" SET "currentRevisionId"=$2 WHERE id=$1', [proposal, revision]);
    await client.query('COMMIT');
  } catch (cause) { await client.query('ROLLBACK'); throw cause; }
  finally { client.release(); }
  return { prefix, password, users, proposal, revision, title, async dispose() {
    // Submitted row deletion is forbidden; only the disposable business tables are truncated.
    await pool.query('TRUNCATE "CriterionEvidenceLink", "ProposalActivity", "ReviewAssignment", "AcceptanceCriterion", "TestEvidence", "ChangeProposal", "ProposalRevision" CASCADE');
    await pool.query(`DELETE FROM "AuthSession" WHERE data::jsonb->>'userId' = ANY($1::text[])`, [Object.values(users)]);
    await pool.query('DELETE FROM "SecurityEvent" WHERE "actorId" = ANY($1::text[])', [Object.values(users)]);
    await pool.query('DELETE FROM "UserAccount" WHERE id = ANY($1::text[])', [Object.values(users)]);
    await pool.end();
  } };
}
