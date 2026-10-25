import { ConflictException, ForbiddenException, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import { z } from 'zod';
import { REVIEWER_LIMITS, reviewerIdSchema, reviewerTimestampSchema } from '@specsentry/shared';
import type { Prisma } from '../generated/prisma/client';

export type ReviewTransaction = Prisma.TransactionClient;
export interface ReviewerActor { accountId: string; accountVersion: number; correlationId?: string }

export function validate<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new UnprocessableEntityException();
  return result.data;
}

export async function lockReviewer(tx: ReviewTransaction, actor: ReviewerActor): Promise<void> {
  const accounts = await tx.$queryRaw<{ enabled: boolean; version: number; role: string }[]>`
    SELECT "enabled", "version", "role" FROM "UserAccount" WHERE "id" = ${actor.accountId} FOR UPDATE`;
  const account = accounts[0];
  if (!account?.enabled || account.version !== actor.accountVersion) throw new UnauthorizedException();
  if (account.role !== 'REVIEWER') throw new ForbiddenException();
}

const cursorData = z.object({ v: z.literal(1), scope: z.string().max(800), id: reviewerIdSchema,
  timestamp: reviewerTimestampSchema.optional(), number: z.number().int().min(1).max(REVIEWER_LIMITS.version).optional(),
}).strict();
export type CursorPosition = { id: string; timestamp?: string; number?: number };

export function decodeCursor(value: string | undefined, scope: string, kind: 'timestamp' | 'number'): CursorPosition | undefined {
  if (value === undefined) return;
  try {
    if (value.length > REVIEWER_LIMITS.cursor || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error();
    const bytes = Buffer.from(value, 'base64url');
    if (bytes.length > REVIEWER_LIMITS.decodedCursorBytes || bytes.toString('base64url') !== value) throw new Error();
    const data = cursorData.parse(JSON.parse(bytes.toString('utf8')));
    if (data.scope !== scope || (kind === 'timestamp' ? data.timestamp === undefined || data.number !== undefined : data.number === undefined || data.timestamp !== undefined)) throw new Error();
    return data;
  } catch { throw new UnprocessableEntityException(); }
}

export function encodeCursor(scope: string, position: CursorPosition): string {
  return Buffer.from(JSON.stringify({ v: 1, scope, ...position })).toString('base64url');
}

export function nextVersion(version: number): number {
  if (version >= REVIEWER_LIMITS.version) throw new ConflictException();
  return version + 1;
}
