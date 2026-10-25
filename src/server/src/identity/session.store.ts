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
    // updateMany deliberately cannot resurrect a logged-out session.
    void this.database.client.authSession.updateMany({ where: { id: digest(id) }, data: { expiresAt: this.expiry(data) } })
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
