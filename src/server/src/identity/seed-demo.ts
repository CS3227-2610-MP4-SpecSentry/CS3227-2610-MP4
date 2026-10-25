import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnvironment } from 'dotenv';
import type { AccountRole } from '@specsentry/shared';
import { readConfig, type ServerConfig } from '../config';
import { DatabaseService } from '../database/database.service';
import { hashPassword } from './identity.service';

const roles: AccountRole[] = ['CONTRIBUTOR', 'REVIEWER', 'RELEASE_MAINTAINER'];

export async function seedDemoAccounts(database: DatabaseService, environment: ServerConfig['NODE_ENV']) {
  if (environment === 'production') throw new Error('Demo accounts are for development and test environments.');
  const accounts: { id: string; username: string; role: AccountRole; passwordHash: string }[] = [];
  for (const role of roles) {
    for (const number of [1, 2]) {
      accounts.push({ id: randomUUID(), username: `${role.toLowerCase()}${number}`, role,
        passwordHash: await hashPassword('Password123!') });
    }
  }
  return database.client.$transaction(async (tx) => {
    const result = await tx.userAccount.createMany({ data: accounts, skipDuplicates: true });
    // Only newly inserted IDs receive creation events; reruns preserve existing accounts.
    const created = await tx.userAccount.findMany({ where: { id: { in: accounts.map((account) => account.id) } }, select: { id: true } });
    if (created.length) await tx.securityEvent.createMany({ data: created.map(({ id }) => ({
      actorId: id, action: 'ACCOUNT_CREATED', target: id, outcome: 'success',
    })) });
    return { created: result.count, skipped: accounts.length - result.count };
  });
}

async function main(): Promise<void> {
  loadEnvironment({ path: resolve(__dirname, '../../../../.env'), quiet: true });
  const config = readConfig(process.env);
  const database = new DatabaseService(config);
  try {
    const result = await seedDemoAccounts(database, config.NODE_ENV);
    console.info(`Demo accounts: ${result.created} created, ${result.skipped} already present.`);
  } finally { await database.onModuleDestroy(); }
}

if (require.main === module) void main().catch(() => {
  console.error('Demo seed failed. Use development/test configuration and a migrated database.');
  process.exitCode = 1;
});
