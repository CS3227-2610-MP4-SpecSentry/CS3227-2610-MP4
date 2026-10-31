import { resolve } from 'node:path';
import { config as loadEnvironment } from 'dotenv';
import { accountRoleSchema, usernameSchema } from '@specsentry/shared';
import { readConfig } from '../config';
import { DatabaseService } from '../database/database.service';
import { hashPassword } from './identity.service';
import { AccountAdministrationService } from './account-administration.service';
import { ReviewsService } from '../reviews/reviews.service';
import { ApprovalRevocationService } from '../reviews/approval-revocation.service';
import { ProposalsService } from '../proposals/proposals.service';
import { ActivityService } from '../activity/activity.service';
import { NotificationsService } from '../notifications/notifications.service';

async function main(): Promise<void> {
  loadEnvironment({ path: resolve(__dirname, '../../../../.env'), quiet: true });
  const database = new DatabaseService(readConfig(process.env));
  try {
    const action = process.argv[2];
    if (action === 'create') {
      const username = usernameSchema.parse(process.env.ACCOUNT_USERNAME);
      const role = accountRoleSchema.parse(process.env.ACCOUNT_ROLE);
      const password = process.env.ACCOUNT_PASSWORD;
      if (!password || password.length < 12 || password.length > 256) throw new Error('Invalid password');
      const passwordHash = await hashPassword(password);
      await database.client.$transaction(async (tx) => {
        const account = await tx.userAccount.create({ data: { username, role, passwordHash } });
        await tx.securityEvent.create({ data: { actorId: account.id, action: 'ACCOUNT_CREATED', target: account.id, outcome: 'success' } });
      });
    } else if (action === 'disable') {
      const username = usernameSchema.parse(process.env.ACCOUNT_USERNAME);
      const proposals = new ProposalsService();
      const activity = new ActivityService();
      const notifications = new NotificationsService(database, proposals, activity);
      const revocation = new ApprovalRevocationService(database, proposals, activity, notifications);
      await new AccountAdministrationService(database,
        new ReviewsService(database, proposals, activity, revocation)).disable(username);
    } else if (action === 'prune') {
      const now = new Date();
      await database.client.$transaction([
        database.client.authSession.deleteMany({ where: { expiresAt: { lte: now } } }),
        database.client.loginThrottle.deleteMany({ where: { updatedAt: { lt: new Date(now.getTime() - 30 * 60 * 1000) }, OR: [{ blockedUntil: null }, { blockedUntil: { lte: now } }] } }),
        database.client.securityEvent.deleteMany({ where: { timestamp: { lt: new Date(now.getTime() - 90 * 86400000) } } }),
      ]);
    } else throw new Error('Unknown command');
    console.info('Account administration completed.');
  } finally { delete process.env.ACCOUNT_PASSWORD; await database.onModuleDestroy(); }
}

void main().catch(() => {
  console.error('Account administration failed. Check command, configuration, account uniqueness, and input requirements.');
  process.exitCode = 1;
});
