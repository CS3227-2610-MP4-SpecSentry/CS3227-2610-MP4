import { cloneLatestRequestSchema, findingResponseRequestSchema, ownProposalsQuerySchema, ownProposalsResponseSchema } from '@specsentry/shared';

describe('Contributor lifecycle discovery, cloning and response contracts', () => {
  it('requires explicit version-bound clone confirmation and rejects forged scope', () => {
    const body = { expectedVersion: 0, revisionId: 'revision', confirmed: true };
    expect(cloneLatestRequestSchema.parse(body)).toEqual(body);
    for (const bad of [{ ...body, confirmed: false }, { ...body, ownerId: 'other' }, { ...body, expectedVersion: -1 },
      { expectedVersion: 0, confirmed: true }]) expect(cloneLatestRequestSchema.safeParse(bad).success).toBe(false);
  });
  it('normalizes bounded nonempty plain-text responses without accepting transition/actor fields', () => {
    const body = { expectedVersion: 1, revisionId: 'revision', text: '<script>not executable</script>\r\nReply' };
    expect(findingResponseRequestSchema.parse(body).text).toBe('<script>not executable</script>\nReply');
    expect(findingResponseRequestSchema.safeParse({ ...body, text: '😀'.repeat(2000) }).success).toBe(true);
    for (const bad of [{ ...body, text: '' }, { ...body, text: ' \n ' }, { ...body, text: '😀'.repeat(2001) },
      { ...body, status: 'RESOLVED' }, { ...body, actorId: 'other' }]) expect(findingResponseRequestSchema.safeParse(bad).success).toBe(false);
  });
  it('supports lifecycle rows without requiring private working copies and keeps list ownership server-owned', () => {
    expect(ownProposalsQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(ownProposalsQuerySchema.safeParse({ ownerId: 'other' }).success).toBe(false);
    const row = { proposalId: 'proposal', title: 'Saved title', workingRevisionId: null, state: 'WITHDRAWN', version: 2,
      createdAt: '2026-11-01T00:00:00.000Z', latestRevision: { id: 'revision', number: 1, submittedAt: '2026-11-01T00:00:00.000Z' } };
    expect(ownProposalsResponseSchema.parse({ items: [row], nextCursor: null }).items[0]).toEqual(row);
  });
});
