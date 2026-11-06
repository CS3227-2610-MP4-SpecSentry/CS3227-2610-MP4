import type { PrismaClient } from '../src/generated/prisma/client';
import type { AiClock, AiDeadline } from '../src/ai/contracts';
import { PrismaAiAccounting, SafeAiError } from '../src/ai/gateway/accounting';
import { cleanupAiRecords } from '../src/ai/cleanup-ai-records';
import { AiRequestDeadline } from '../src/ai/deadline';

const disconnect = jest.fn(async () => undefined);
jest.mock('../src/generated/prisma/client', () => ({ PrismaClient: jest.fn(() => ({ $disconnect: disconnect })) }));

function harness() {
  let time = Date.parse('2026-11-04T12:00:00Z');
  const clock: AiClock = { now: jest.fn(() => new Date(time)), monotonicMs: () => time, sleep: async () => undefined };
  const deadline: AiDeadline = { signal: new AbortController().signal, remainingMs: () => 1000, assertRemaining: jest.fn() };
  const tx = { $queryRaw: jest.fn(async () => []), $queryRawUnsafe: jest.fn(async () => [{ id: 'reviewer-patch-risk' }]),
    $executeRaw: jest.fn<Promise<number>, unknown[]>(async () => 0), aiQueueLease: { deleteMany: jest.fn(async () => ({ count: 0 })) } };
  const transaction = jest.fn(async <T>(work: (value: typeof tx) => Promise<T>) => work(tx));
  return { tx, transaction, clock, deadline, advance: (ms: number) => { time += ms; },
    accounting: new PrismaAiAccounting({ $transaction: transaction } as unknown as PrismaClient, clock) };
}

describe('AI retention authority', () => {
  afterEach(() => jest.restoreAllMocks());

  it('uses one bounded coordinator transaction and captures its cutoff only after obtaining the lock', async () => {
    const h = harness();
    h.tx.$queryRawUnsafe.mockImplementation(async () => { h.advance(500); return [{ id: 'reviewer-patch-risk' }]; });
    await h.accounting.cleanup(h.deadline);
    expect(h.transaction).toHaveBeenCalledTimes(1);
    expect(h.transaction).toHaveBeenCalledWith(expect.any(Function), { maxWait: 1000, timeout: 1000 });
    expect(h.clock.now).toHaveBeenCalledTimes(1);
    const now = new Date('2026-11-04T12:00:00.500Z'); const cutoff = new Date(now.getTime() - 86_400_000);
    expect(h.tx.aiQueueLease.deleteMany).toHaveBeenCalledWith({ where: { expiresAt: { lte: now } } });
    const [query, ...values] = h.tx.$executeRaw.mock.calls[0]!;
    expect(values).toEqual([now, cutoff, cutoff, now, cutoff, cutoff]);
    expect((query as TemplateStringsArray).join('?')).toContain('NOT EXISTS');
    expect(h.tx.$queryRawUnsafe.mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(h.clock.now).mock.invocationCallOrder[0]!);
  });

  it('fails closed without deleting anything when the coordinator is missing', async () => {
    const h = harness(); h.tx.$queryRawUnsafe.mockResolvedValue([]);
    await expect(h.accounting.cleanup(h.deadline)).rejects.toMatchObject({ errorClass: 'INTERNAL' });
    expect(h.clock.now).not.toHaveBeenCalled(); expect(h.tx.aiQueueLease.deleteMany).not.toHaveBeenCalled();
    expect(h.tx.$executeRaw).not.toHaveBeenCalled();
  });

  it('checks the deadline before acquiring and after obtaining the lock', async () => {
    for (const call of [1, 3]) {
      const h = harness(); let checks = 0;
      jest.mocked(h.deadline.assertRemaining).mockImplementation(() => { if (++checks === call) throw new SafeAiError('DEADLINE'); });
      await expect(h.accounting.cleanup(h.deadline)).rejects.toMatchObject({ errorClass: 'DEADLINE' });
      expect(h.tx.aiQueueLease.deleteMany).not.toHaveBeenCalled(); expect(h.tx.$executeRaw).not.toHaveBeenCalled();
    }
  });

  it('maps SQL cancellation and lock timeout to safe deadline errors', async () => {
    for (const code of ['57014', '55P03']) {
      const h = harness(); h.tx.$executeRaw.mockRejectedValue({ code: 'P2010', meta: { code } });
      await expect(h.accounting.cleanup(h.deadline)).rejects.toMatchObject({ errorClass: 'DEADLINE' });
    }
  });

  it('does not initialize a database for absent, malformed, or non-PostgreSQL configuration', async () => {
    for (const DATABASE_URL of [undefined, 'bad', 'https://invalid.example/test']) {
      await expect(cleanupAiRecords({ DATABASE_URL })).rejects.toThrow('Invalid AI retention database configuration');
    }
    expect(disconnect).not.toHaveBeenCalled();
  });

  it.each([false, true])('the explicit command closes its deadline and disconnects on failure=%s', async failure => {
    const cleanup = jest.spyOn(PrismaAiAccounting.prototype, 'cleanup').mockImplementation(async () => {
      if (failure) throw new Error('synthetic database failure');
    });
    const close = jest.spyOn(AiRequestDeadline.prototype, 'close');
    const pending = cleanupAiRecords({ DATABASE_URL: 'postgresql://synthetic@127.0.0.1/test' });
    if (failure) await expect(pending).rejects.toThrow('synthetic database failure'); else await pending;
    expect(cleanup).toHaveBeenCalledWith(expect.any(AiRequestDeadline));
    expect(close).toHaveBeenCalledTimes(1); expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
