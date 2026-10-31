import { NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { nextVersion } from '../reviews/reviewer-context';
import { ReviewsService } from '../reviews/reviews.service';

// Administrative CLI boundary: no public route, caller must already have operator access.
export class AccountAdministrationService {
  constructor(private readonly database: DatabaseService, private readonly reviews: ReviewsService) {}
  disable(username: string) {
    return this.database.client.$transaction(async (tx) => {
      const accounts = await tx.$queryRaw<{ id: string; version: number }[]>`
        SELECT "id", "version" FROM "UserAccount" WHERE "username" = ${username} FOR UPDATE`;
      const account = accounts[0];
      if (!account) throw new NotFoundException();
      await tx.userAccount.update({ where: { id: account.id }, data: { enabled: false, version: nextVersion(account.version) } });
      const released = await this.reviews.releaseDisabledAssignments(tx, account.id);
      await tx.securityEvent.create({ data: { action: 'ACCOUNT_DISABLED', target: account.id, outcome: 'success' } });
      return { released };
    }, { maxWait: 5000, timeout: 10000 });
  }
}
