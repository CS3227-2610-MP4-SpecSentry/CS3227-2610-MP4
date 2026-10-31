import { assignedReviewsQuerySchema, claimProposalRequestSchema, dropProposalRequestSchema, proposalActivityQuerySchema,
  reviewPoolQuerySchema, reviewerIdSchema, reviewerVersionSchema, reviewerTitleSchema, submittedRevisionSchema,
} from '@specsentry/shared';
import { decodeCursor, encodeCursor } from '../src/reviews/reviewer-context';
import { reviewerFixtureRevision } from '../src/reviews/seed-reviewer';

describe('Reviewer strict boundary contracts (INT-02/03/07/11)', () => {
  it('rejects impersonation, extra fields, overflow and stale-form shape omissions', () => {
    expect(claimProposalRequestSchema.safeParse({ expectedVersion: 0, reviewerId: 'other' }).success).toBe(false);
    expect(dropProposalRequestSchema.safeParse({ expectedVersion: 0, revisionId: 'r', assignmentId: 'a' }).success).toBe(false);
    for (const version of [-1, 1.5, 2147483648, Infinity, '1']) expect(reviewerVersionSchema.safeParse(version).success).toBe(false);
    expect(reviewerVersionSchema.parse(2147483647)).toBe(2147483647);
    expect(reviewerIdSchema.parse(' preserved id ')).toBe(' preserved id ');
    for (const id of ['', 'a'.repeat(129), 'a\nb', 'é']) expect(reviewerIdSchema.safeParse(id).success).toBe(false);
  });
  it('bounds and scopes queue filters and rejects numeric coercion tricks/unknown queries', () => {
    expect(reviewPoolQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(assignedReviewsQuerySchema.parse({ state: 'RELEASED', limit: '100' }).limit).toBe(100);
    for (const input of [{ state: 'IN_REVIEW' }, { limit: '1e2' }, { limit: '01' }, { limit: '' }, { limit: ['2'] },
      { minAgeDays: '2', maxAgeDays: '1' }, { maxAgeDays: '365001' }, { limit: '101' }, { limit: '0' }]) {
      expect(reviewPoolQuerySchema.safeParse(input).success).toBe(false);
    }
    expect(proposalActivityQuerySchema.safeParse({ limit: '100' }).success).toBe(false);
  });
  it('enforces cursor byte/shape/scope/ordering bounds without relying on an anchor record', () => {
    const scope = '["pool"]';
    const position = { id: 'opaque', timestamp: '2026-10-25T00:00:00.000Z' };
    expect(decodeCursor(encodeCursor(scope, position), scope, 'timestamp')).toMatchObject(position);
    const raw = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    for (const cursor of ['!', 'a'.repeat(2049), raw({ v: 2, scope, ...position }),
      raw({ v: 1, scope, ...position, secret: 'ignored?' }), raw({ v: 1, scope, ...position, timestamp: 'yesterday' }),
      raw({ v: 1, scope, ...position, id: 'x'.repeat(129) }), raw({ v: 1, scope, ...position, number: 1 }),
      raw({ v: 1, scope, number: 2147483648, id: 'x' }), raw({ v: 1, scope: 'x'.repeat(1600), ...position })]) {
      expect(() => decodeCursor(cursor, scope, 'timestamp')).toThrow();
    }
    expect(() => decodeCursor(encodeCursor(scope, position), '["assigned"]', 'timestamp')).toThrow();
  });
  it('normalizes newlines and counts Unicode code points; validates evidence links and aggregate limits', () => {
    expect(reviewerTitleSchema.parse('😀'.repeat(200))).toBe('😀'.repeat(200));
    expect(reviewerTitleSchema.safeParse('😀'.repeat(201)).success).toBe(false);
    const revision = reviewerFixtureRevision('test', 1, new Date());
    expect(submittedRevisionSchema.parse({ ...revision, diffText: 'a\r\nb\rc' }).diffText).toBe('a\nb\nc');
    expect(submittedRevisionSchema.safeParse({ ...revision, diffText: '😀'.repeat(100001) }).success).toBe(false);
    expect(submittedRevisionSchema.safeParse({ ...revision, criteria: revision.criteria.map((criterion) => ({ ...criterion, required: false })) }).success).toBe(false);
    expect(submittedRevisionSchema.safeParse({ ...revision, criterionEvidenceLinks: [{ criterionId: 'foreign', evidenceId: revision.evidence[0]!.id }] }).success).toBe(false);
    expect(submittedRevisionSchema.safeParse({ ...revision, criterionEvidenceLinks: [...revision.criterionEvidenceLinks, ...revision.criterionEvidenceLinks] }).success).toBe(false);
    expect(submittedRevisionSchema.safeParse({ ...revision, evidence: [
      { ...revision.evidence[0], id: 'a', text: 'x'.repeat(25001) }, { ...revision.evidence[0], id: 'b', text: 'y'.repeat(25000) },
    ], criterionEvidenceLinks: [] }).success).toBe(false);
    expect(submittedRevisionSchema.safeParse({ ...revision, criteria: [...revision.criteria, ...revision.criteria] }).success).toBe(false);
    expect(reviewerFixtureRevision('large', 1, new Date(), true).diffText.length).toBeGreaterThan(90000);
  });
});
