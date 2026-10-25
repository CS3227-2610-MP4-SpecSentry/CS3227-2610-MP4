import { DatabaseService } from '../src/database/database.service';
import { readConfig } from '../src/config';

// Explicit opt-in. Never silently run integration checks against the runtime DB.
describe('PostgreSQL connectivity (read-only)', () => {
  it('runs SELECT 1 through the generated Prisma client', async () => {
    if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL must point to a disposable test database');
    const database = new DatabaseService(readConfig({ SESSION_SECRET: 'synthetic-test-session-secret-32-chars', NODE_ENV: 'test', DATABASE_URL: process.env.TEST_DATABASE_URL }));
    try { await database.checkConnection(); } finally { await database.onModuleDestroy(); }
  }, 15000);
});
