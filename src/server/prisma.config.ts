import { resolve } from 'node:path';
import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

config({ path: resolve(__dirname, '../../.env'), quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Generate/validate remain usable without live credentials. Database commands
  // fail closed when no explicit direct URL is supplied.
  datasource: { url: process.env.DIRECT_DATABASE_URL ?? '' },
});
