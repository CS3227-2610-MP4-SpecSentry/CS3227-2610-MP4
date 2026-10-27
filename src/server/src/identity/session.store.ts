import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Store, type SessionData } from 'express-session';
import { DatabaseService } from '../database/database.service';

export const IDLE_MS = 30 * 60 * 1000;
export const ABSOLUTE_MS = 8 * 60 * 60 * 1000;
export const SESSION_COOKIE = 'specsentry.sid';
const digest = (id: string) => createHash('sha256').update(id).digest('hex');

@Injectable()
export class PostgresSessionStore extends Store {
  constructor(private readonly database: DatabaseService) { super(); }

  get(id: string, callback: (error: unknown, session?: SessionData | null) => void): void {
    void this.database.client.authSession.findUnique({ where: { id: digest(id) } }).then(async (row) => {
      if (!row) return callback(null, null);
      if (row.expiresAt.getTime() <= Date.now()) {
        await this.database.client.authSession.deleteMany({ where: { id: digest(id) } });
        return callback(null, null);
      }
      callback(null, JSON.parse(row.data) as SessionData);
    }).catch(callback);
  }

  set(id: string, data: SessionData, callback?: (error?: unknown) => void): void {
    const expiresAt = this.expiry(data);
    void this.database.client.authSession.upsert({
      where: { id: digest(id) },
      create: { id: digest(id), data: JSON.stringify(data), expiresAt },
      update: { data: JSON.stringify(data), expiresAt },
    }).then(() => callback?.()).catch((error: unknown) => callback?.(error));
  }

  touch(id: string, data: SessionData, callback?: (error?: unknown) => void): void {
    // Lock first: an UPDATE predicate bound before a row-lock wait can renew an
    // already expired session. This transaction acquires no account/root locks.
    void this.database.client.$transaction(async tx => {
      const key = digest(id);
      const rows = await tx.$queryRaw<{ expiresAt: Date }[]>`
        SELECT "expiresAt" FROM "AuthSession" WHERE "id"=${key} FOR UPDATE`;
      const now = Date.now();
      if (!rows[0] || rows[0].expiresAt.getTime() <= now || typeof data.issuedAt !== 'number' ||
          !Number.isFinite(data.issuedAt) || data.issuedAt > now || data.issuedAt + ABSOLUTE_MS <= now) return;
      await tx.authSession.updateMany({ where: { id: key }, data: { expiresAt: this.expiry(data) } });
    }, { maxWait: 5000, timeout: 10000 })
      .then(() => callback?.()).catch((error: unknown) => callback?.(error));
  }

  destroy(id: string, callback?: (error?: unknown) => void): void {
    void this.database.client.authSession.deleteMany({ where: { id: digest(id) } })
      .then(() => callback?.()).catch((error: unknown) => callback?.(error));
  }

  private expiry(data: SessionData): Date {
    return new Date(Math.min(Date.now() + IDLE_MS, (data.issuedAt ?? Date.now()) + ABSOLUTE_MS));
  }
}
