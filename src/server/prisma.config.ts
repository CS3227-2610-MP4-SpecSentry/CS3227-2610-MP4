import { resolve } from 'node:path';
import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

config({
  path: [resolve(__dirname, '../../.env.local'), resolve(__dirname, '../../.env')],
  quiet: true,
});

function normalizeNeonUrl(value: string): string {
  if (!value) return value;
  const url = new URL(value);
  if (url.hostname.endsWith('.neon.tech') && url.searchParams.get('sslmode') === 'require') {
    url.searchParams.set('sslmode', 'verify-full');
  }
  return url.toString();
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'node -r ts-node/register src/identity/seed-demo.ts' },
  // Generate/validate remain usable without live credentials. Database commands
  // fail closed when no explicit direct URL is supplied.
  datasource: {
    url: normalizeNeonUrl(process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED ?? ''),
  },
});
