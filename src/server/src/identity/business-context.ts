import { ConflictException, ForbiddenException, HttpException, UnauthorizedException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { Prisma } from '../generated/prisma/client';
import type { DatabaseService } from '../database/database.service';
import type { AuthRequest } from './access';
import { ABSOLUTE_MS } from './session.store';

export interface BusinessActor {
  accountId: string; accountVersion: number; correlationId?: string;
  role?: string;
  session?: { digest: string; issuedAt: number; csrfToken: string };
}
export const businessActor = (request: AuthRequest): BusinessActor => ({ accountId: request.account!.id,
  role: request.account!.role,
  accountVersion: request.session.accountVersion!, correlationId: request.res?.getHeader('x-request-id')?.toString(),
  session: { digest: createHash('sha256').update(request.sessionID).digest('hex'),
    issuedAt: request.session.issuedAt!, csrfToken: request.session.csrfToken! } });
const persistedSession = z.object({ userId: z.string(), accountVersion: z.number().int(), issuedAt: z.number(), csrfToken: z.string() });
export async function lockBusinessContext(tx: Prisma.TransactionClient, actor: BusinessActor, role: string,
  additionalAccountIds: string[] = []) {
  const ids = [...new Set([actor.accountId, ...additionalAccountIds])].sort();
  const accounts = [];
  for (const id of ids) {
    const rows = await tx.$queryRaw<{ id: string; enabled: boolean; version: number; role: string }[]>`
      SELECT "id","enabled","version","role" FROM "UserAccount" WHERE "id"=${id} FOR UPDATE`;
    if (rows[0]) accounts.push(rows[0]);
  }
  const account = accounts.find(a => a.id === actor.accountId);
  if (!account?.enabled || account.version !== actor.accountVersion) throw new UnauthorizedException();
  if (account.role !== role) throw new ForbiddenException();
  if (!actor.session) throw new UnauthorizedException();
  const rows = await tx.$queryRaw<{ data: string; expiresAt: Date }[]>`
    SELECT "data","expiresAt" FROM "AuthSession" WHERE "id"=${actor.session.digest} FOR UPDATE`;
  let data: z.infer<typeof persistedSession>;
  try { data = persistedSession.parse(JSON.parse(rows[0]!.data)); } catch { throw new UnauthorizedException(); }
  const expected = actor.session.csrfToken;
  if (!/^[a-f0-9]{64}$/.test(expected) || !/^[a-f0-9]{64}$/.test(data.csrfToken) ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(data.csrfToken)) || data.userId !== actor.accountId ||
      data.accountVersion !== actor.accountVersion || data.issuedAt !== actor.session.issuedAt) throw new UnauthorizedException();
  const checkExpiry = () => {
    if (rows[0]!.expiresAt.getTime() <= Date.now() || data.issuedAt > Date.now() || data.issuedAt + ABSOLUTE_MS <= Date.now())
      throw new UnauthorizedException();
  };
  checkExpiry();
  return { accounts, checkExpiry };
}

export async function businessTransaction<T>(database: DatabaseService, actor: BusinessActor, role: string,
  target: string, operation: string, work: (tx: Prisma.TransactionClient, accounts: { id: string; enabled: boolean; role: string; version: number }[]) => Promise<T>,
  additionalAccountIds: string[] = []) {
  try {
    return await database.client.$transaction(async tx => {
      const context = await lockBusinessContext(tx, actor, role, additionalAccountIds);
      const result = await work(tx, context.accounts);
      context.checkExpiry();
      return result;
    }, { maxWait: 5000, timeout: 10000 });
  } catch (error) {
    await database.client.securityEvent.create({ data: { actorId: actor.accountId, action: `${operation}_REJECTED`,
      target, outcome: 'rejected', correlationId: actor.correlationId } });
    if (error instanceof HttpException) throw error;
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    if (['P2002','P2034','P2028'].includes(code)) throw new ConflictException();
    throw error;
  }
}
