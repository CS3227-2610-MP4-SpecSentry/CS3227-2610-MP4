import * as argon2 from 'argon2';
import { readConfig } from '../src/config';
import { DatabaseService } from '../src/database/database.service';
import { hashPassword } from '../src/identity/identity.service';
import { seedDemoAccounts } from '../src/identity/seed-demo';

describe('demo account seed', () => {
  let database: DatabaseService;
  let ownsFixtures = false;
  const usernames = ['contributor1', 'contributor2', 'reviewer1', 'reviewer2', 'release_maintainer1', 'release_maintainer2'];

  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL must point to a disposable migrated database');
    database = new DatabaseService(readConfig({ NODE_ENV: 'test', DATABASE_URL: process.env.TEST_DATABASE_URL,
      SESSION_SECRET: 'demo-seed-test-secret-at-least-32-characters' }));
    if (await database.client.userAccount.count({ where: { username: { in: usernames } } })) {
      throw new Error('Seed test requires a database without existing demo usernames');
    }
    ownsFixtures = true;
  });
  afterAll(async () => {
    if (!database) return;
    if (ownsFixtures) {
      const accounts = await database.client.userAccount.findMany({ where: { username: { in: usernames } }, select: { id: true } });
      await database.client.securityEvent.deleteMany({ where: { actorId: { in: accounts.map(({ id }) => id) } } });
      await database.client.userAccount.deleteMany({ where: { username: { in: usernames } } });
    }
    await database.onModuleDestroy();
  });

  it('creates two enabled accounts per role with verified password hashes and creation events', async () => {
    expect(await seedDemoAccounts(database, 'test')).toEqual({ created: 6, skipped: 0 });
    const accounts = await database.client.userAccount.findMany({ where: { username: { in: usernames } } });
    expect(accounts).toHaveLength(6);
    for (const account of accounts) {
      expect(account.username).toMatch(new RegExp(`^${account.role.toLowerCase()}[12]$`));
      expect(account.enabled).toBe(true);
      expect(account.version).toBe(1);
      expect(account.passwordHash).toMatch(/^\$argon2id\$/);
      expect(await argon2.verify(account.passwordHash, 'Password123!')).toBe(true);
    }
    expect(new Set(accounts.map(({ passwordHash }) => passwordHash)).size).toBe(6);
    expect(await database.client.securityEvent.count({ where: { actorId: { in: accounts.map(({ id }) => id) }, action: 'ACCOUNT_CREATED' } })).toBe(6);
  });
  it('preserves existing credentials, roles, disablement and versions on reruns', async () => {
    const changed = await database.client.userAccount.update({ where: { username: 'contributor1' }, data: {
      passwordHash: await hashPassword('different-test-password'), role: 'REVIEWER', enabled: false, version: 2,
    } });
    expect(await seedDemoAccounts(database, 'test')).toEqual({ created: 0, skipped: 6 });
    expect(await database.client.userAccount.findUnique({ where: { id: changed.id } })).toEqual(changed);
    expect(await database.client.securityEvent.count({ where: { actorId: changed.id, action: 'ACCOUNT_CREATED' } })).toBe(1);
  });
  it('refuses production seeding without changing accounts', async () => {
    await expect(seedDemoAccounts(database, 'production')).rejects.toThrow('development and test');
  });
});
