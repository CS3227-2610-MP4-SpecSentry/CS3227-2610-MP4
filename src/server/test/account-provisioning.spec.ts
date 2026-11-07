import { hashPassword } from '../src/identity/identity.service';
import { ensureAccount } from '../src/identity/account-provisioning';
import { DatabaseService } from '../src/database/database.service';

const input = {
  username: 'release_smoke',
  role: 'RELEASE_MAINTAINER' as const,
  password: 'synthetic-smoke-password',
};

describe('smoke account provisioning', () => {
  it('creates and audits a missing account', async () => {
    const tx = {
      userAccount: { create: jest.fn(async () => ({ id: 'account-1' })) },
      securityEvent: { create: jest.fn(async () => ({})) },
    };
    const client = {
      userAccount: { findUnique: jest.fn(async () => null) },
      $transaction: jest.fn(async (work: (value: typeof tx) => Promise<void>) => work(tx)),
    };

    await expect(ensureAccount({ client } as unknown as DatabaseService, input))
      .resolves.toEqual({ created: true });
    expect(tx.userAccount.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      username: input.username, role: input.role,
    }) });
    expect(tx.securityEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      actorId: 'account-1', action: 'ACCOUNT_CREATED', outcome: 'success',
    }) });
  });

  it('accepts an enabled existing account only when role and password match', async () => {
    const client = {
      userAccount: { findUnique: jest.fn(async () => ({
        id: 'account-1', enabled: true, role: input.role,
        passwordHash: await hashPassword(input.password),
      })) },
      $transaction: jest.fn(),
    };

    await expect(ensureAccount({ client } as unknown as DatabaseService, input))
      .resolves.toEqual({ created: false });
    expect(client.$transaction).not.toHaveBeenCalled();
  });

  it('fails closed when an existing account does not match', async () => {
    const client = {
      userAccount: { findUnique: jest.fn(async () => ({
        id: 'account-1', enabled: true, role: 'REVIEWER',
        passwordHash: await hashPassword(input.password),
      })) },
      $transaction: jest.fn(),
    };

    await expect(ensureAccount({ client } as unknown as DatabaseService, input))
      .rejects.toThrow('does not match');
    expect(client.$transaction).not.toHaveBeenCalled();
  });
});
