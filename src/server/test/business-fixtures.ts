import { randomBytes, randomUUID } from 'node:crypto';
import type { DatabaseService } from '../src/database/database.service';
import type { BusinessActor } from '../src/identity/business-context';

// Direct-service tests use a real persisted session, never a production bypass.
export async function persistedTestActor(database: DatabaseService, accountId: string, correlationId = accountId): Promise<BusinessActor> {
  const account = await database.client.userAccount.findUniqueOrThrow({ where: { id: accountId } });
  const issuedAt = Date.now(); const csrfToken = randomBytes(32).toString('hex'); const digest = randomUUID();
  await database.client.authSession.create({ data: { id: digest,
    data: JSON.stringify({ userId: accountId, accountVersion: account.version, issuedAt, csrfToken }),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000) } });
  return { accountId, accountVersion: account.version, role: account.role, correlationId,
    session: { digest, issuedAt, csrfToken } };
}
