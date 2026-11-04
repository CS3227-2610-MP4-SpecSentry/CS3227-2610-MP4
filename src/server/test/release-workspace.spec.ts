import { UnprocessableEntityException } from '@nestjs/common';
import { releaseCandidatesQuerySchema, releaseCandidatesResponseSchema } from '@specsentry/shared';
import { ReleasesService } from '../src/releases/releases.service';
import { validate } from '../src/reviews/reviewer-context';
import { businessTransaction } from '../src/identity/business-context';

jest.mock('../src/identity/business-context', () => {
  const actual = jest.requireActual('../src/identity/business-context');
  return { ...actual, businessTransaction: jest.fn() };
});

const timestamp = new Date('2026-11-04T00:00:00.000Z');
const candidate = (id: string, versionLabel: string, createdAt = timestamp) => ({
  id, semanticVersion: versionLabel, status: 'OPEN' as const, createdById: 'maintainer',
  createdAt, publishedAt: null, version: 0, contentVersion: 0,
});

describe('Release Maintainer candidate list', () => {
  const actor = { accountId: 'maintainer', accountVersion: 1, role: 'RELEASE_MAINTAINER' };
  const findMany = jest.fn();
  const database = { client: {} };
  const service = new ReleasesService(database as never, {} as never);
  const transaction = businessTransaction as jest.MockedFunction<typeof businessTransaction>;

  beforeEach(() => {
    findMany.mockReset();
    transaction.mockReset();
    transaction.mockImplementation(async (_database, _actor, role, target, operation, work) => {
      expect(role).toBe('RELEASE_MAINTAINER');
      expect(target).toBe('release-candidates');
      expect(operation).toBe('RELEASE_LIST');
      return work({ releaseCandidate: { findMany } } as never, []);
    });
  });

  it('validates strict bounded queries and defaults', () => {
    expect(releaseCandidatesQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(releaseCandidatesQuerySchema.parse({ limit: '100', status: 'RELEASED' }))
      .toEqual({ limit: 100, status: 'RELEASED' });
    for (const query of [{ limit: '0' }, { limit: '101' }, { limit: '1.5' },
      { status: 'DRAFT' }, { cursor: '☃' }, { extra: 'field' }]) {
      expect(() => validate(releaseCandidatesQuerySchema, query)).toThrow(UnprocessableEntityException);
    }
  });

  it('returns a strict newest-first page and an opaque continuation cursor', async () => {
    findMany.mockResolvedValue([candidate('c', '3.0.0', new Date('2026-11-04T03:00:00Z')),
      candidate('b', '2.0.0', new Date('2026-11-04T02:00:00Z')),
      candidate('a', '1.0.0', new Date('2026-11-04T01:00:00Z'))]);
    const result = await service.list(actor, { limit: 2, status: 'OPEN' });
    expect(releaseCandidatesResponseSchema.parse(result).items.map(item => item.id)).toEqual(['c', 'b']);
    expect(result.nextCursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { projectKey: 'specsentry', status: 'OPEN' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 3,
    }));
  });

  it('binds cursors to the filter scope and applies the decoded position', async () => {
    findMany.mockResolvedValueOnce([candidate('b', '2.0.0'), candidate('a', '1.0.0')]);
    const first = await service.list(actor, { limit: 1, status: 'OPEN' });
    findMany.mockResolvedValueOnce([]);
    await service.list(actor, { limit: 1, status: 'OPEN', cursor: first.nextCursor! });
    expect(findMany.mock.calls[1]?.[0].where.OR).toEqual([
      { createdAt: { lt: timestamp } }, { createdAt: timestamp, id: { lt: 'b' } },
    ]);
    await expect(service.list(actor, { limit: 1, status: 'RELEASED', cursor: first.nextCursor! }))
      .rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});
