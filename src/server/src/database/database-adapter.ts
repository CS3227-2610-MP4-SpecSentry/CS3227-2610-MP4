import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaPg } from '@prisma/adapter-pg';

export function usesNeonWebSocket(connectionString: string): boolean {
  return new URL(connectionString).hostname.endsWith('.neon.tech');
}

export function createDatabaseAdapter(connectionString: string, maxConnections: number) {
  const poolConfig = {
    connectionString,
    max: maxConnections,
    connectionTimeoutMillis: 10_000,
    query_timeout: 3_000,
    statement_timeout: 3_000,
  };
  return usesNeonWebSocket(connectionString)
    ? new PrismaNeon(poolConfig)
    : new PrismaPg(poolConfig);
}
