import { createDatabaseAdapter, usesNeonWebSocket } from '../src/database/database-adapter';

describe('database adapter selection', () => {
  it('uses the Neon WebSocket adapter only for Neon endpoints', () => {
    const neonUrl = 'postgresql://user:pass@ep-test-pooler.example.neon.tech/app?sslmode=verify-full';
    const localUrl = 'postgresql://user:pass@127.0.0.1:5432/app';

    expect(usesNeonWebSocket(neonUrl)).toBe(true);
    expect(usesNeonWebSocket(localUrl)).toBe(false);
    expect(createDatabaseAdapter(neonUrl, 2).adapterName).toBe('@prisma/adapter-neon');
    expect(createDatabaseAdapter(localUrl, 2).adapterName).toBe('@prisma/adapter-pg');
  });
});
