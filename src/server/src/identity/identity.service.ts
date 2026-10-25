import { createHmac, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { DatabaseService } from '../database/database.service';
import { SERVER_CONFIG, type ServerConfig } from '../config';

const WINDOW_MS = 15 * 60 * 1000;
export const hashPassword = (password: string) => argon2.hash(password, {
  type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1,
});

@Injectable()
export class IdentityService {
  private readonly dummyHash = hashPassword(randomBytes(32).toString('hex'));
  constructor(private readonly database: DatabaseService, @Inject(SERVER_CONFIG) private readonly config: ServerConfig) {}

  async authenticate(username: string, password: string, ip: string, correlationId?: string) {
    const key = (kind: string, value: string) => `${kind}:${createHmac('sha256', this.config.SESSION_SECRET).update(value).digest('hex')}`;
    const accountKey = key('account', username);
    const limits = [{ key: accountKey, limit: 5 }, { key: key('ip', ip), limit: 30 }].sort((a, b) => a.key.localeCompare(b.key));
    const dummyHash = await this.dummyHash;
    return this.database.client.$transaction(async (tx) => {
      // Serialize counters across processes; fixed ordering prevents deadlocks.
      for (const entry of limits) await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${entry.key}))::text`;
      const now = new Date();
      const counters = await tx.loginThrottle.findMany({ where: { key: { in: limits.map((entry) => entry.key) } } });
      const blocked = counters.some((counter) => counter.blockedUntil && counter.blockedUntil > now);
      if (blocked) {
        await tx.securityEvent.create({ data: { action: 'LOGIN_THROTTLED', target: 'authentication', outcome: 'rejected', correlationId } });
        return { status: 'throttled' as const };
      }
      const account = await tx.userAccount.findUnique({ where: { username } });
      const valid = await argon2.verify(account?.passwordHash ?? dummyHash, password);
      if (!account?.enabled || !valid) {
        for (const entry of limits) {
          const previous = counters.find((counter) => counter.key === entry.key);
          const failuresAt = [...(previous?.failuresAt ?? []).filter((time) => now.getTime() - time.getTime() < WINDOW_MS), now];
          const data = { failuresAt, blockedUntil: failuresAt.length >= entry.limit ? new Date(now.getTime() + WINDOW_MS) : null };
          await tx.loginThrottle.upsert({ where: { key: entry.key }, create: { key: entry.key, ...data }, update: data });
        }
        await tx.securityEvent.create({ data: { actorId: account?.id, action: 'LOGIN_FAILED', target: 'authentication', outcome: 'rejected', correlationId } });
        return { status: 'invalid' as const };
      }
      await tx.loginThrottle.deleteMany({ where: { key: accountKey } });
      await tx.securityEvent.create({ data: { actorId: account.id, action: 'LOGIN', target: 'authentication', outcome: 'success', correlationId } });
      return { status: 'success' as const, account };
    }, { timeout: 10000 });
  }
}
