import { z } from 'zod';
import { PrismaClient } from '../generated/prisma/client';
import { createDatabaseAdapter } from '../database/database-adapter';
import { loadRootEnvironment } from '../environment';
import { AiRequestDeadline } from './deadline';
import { PrismaAiAccounting } from './gateway/accounting';
import { SystemAiClock } from './gateway/transport';

export async function cleanupAiRecords(environment: NodeJS.ProcessEnv): Promise<void> {
  const parsed = z.string().url().refine(value => URL.canParse(value) && ['postgres:', 'postgresql:'].includes(new URL(value).protocol))
    .safeParse(environment.DATABASE_URL);
  if (!parsed.success) throw new Error('Invalid AI retention database configuration');
  const prisma = new PrismaClient({ adapter: createDatabaseAdapter(parsed.data, 1), log: [] });
  const clock = new SystemAiClock();
  const deadline = new AiRequestDeadline(clock);
  try {
    await new PrismaAiAccounting(prisma, clock).cleanup(deadline);
  } finally {
    deadline.close();
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  loadRootEnvironment();
  void cleanupAiRecords(process.env).then(() => {
    console.info('AI record cleanup completed.');
  }).catch(() => {
    console.error('AI record cleanup failed. Check database configuration, coordinator, and availability.');
    process.exitCode = 1;
  });
}
