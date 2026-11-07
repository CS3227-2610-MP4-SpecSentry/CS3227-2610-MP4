import * as argon2 from 'argon2';
import type { AccountRole } from '@specsentry/shared';
import { DatabaseService } from '../database/database.service';
import { hashPassword } from './identity.service';

interface AccountProvisioningInput {
  username: string;
  role: AccountRole;
  password: string;
}

export async function ensureAccount(
  database: DatabaseService,
  input: AccountProvisioningInput,
): Promise<{ created: boolean }> {
  const existing = await database.client.userAccount.findUnique({
    where: { username: input.username },
    select: { id: true, role: true, enabled: true, passwordHash: true },
  });
  if (existing) {
    const passwordMatches = await argon2.verify(existing.passwordHash, input.password);
    if (!existing.enabled || existing.role !== input.role || !passwordMatches) {
      throw new Error('Existing account does not match the requested provisioning identity');
    }
    return { created: false };
  }

  const passwordHash = await hashPassword(input.password);
  await database.client.$transaction(async (tx) => {
    const account = await tx.userAccount.create({
      data: { username: input.username, role: input.role, passwordHash },
    });
    await tx.securityEvent.create({
      data: {
        actorId: account.id,
        action: 'ACCOUNT_CREATED',
        target: account.id,
        outcome: 'success',
      },
    });
  });
  return { created: true };
}
