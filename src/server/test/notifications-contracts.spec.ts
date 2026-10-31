import { acknowledgeNotificationRequestSchema, acknowledgeNotificationResponseSchema, notificationSchema,
  notificationsQuerySchema, notificationsResponseSchema } from '@specsentry/shared';
import { decodeCursor, encodeCursor } from '../src/reviews/reviewer-context';

describe('Notification strict contracts (REQ-REV-008, SEC-I2-003/006)', () => {
  it('bounds pages and rejects impersonation, unknown filters and coercion tricks', () => {
    expect(notificationsQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(notificationsQuerySchema.parse({ limit: '100' })).toEqual({ limit: 100 });
    for (const query of [{ recipientId: 'other' }, { read: true }, { limit: '01' }, { limit: '1e2' },
      { limit: '0' }, { limit: 101 }, { limit: ['2'] }, { cursor: '' }, { cursor: 'x'.repeat(2049) }])
      expect(notificationsQuerySchema.safeParse(query).success).toBe(false);
  });
  it('requires exact revision and current assignment coordinates for new revision acknowledgement', () => {
    const body = { kind: 'NEW_REVISION', revisionId: 'revision-1', assignmentId: 'current-assignment', expectedAssignmentVersion: 3 };
    expect(acknowledgeNotificationRequestSchema.parse(body)).toEqual(body);
    for (const patch of [{ revisionId: undefined }, { assignmentId: undefined }, { expectedAssignmentVersion: undefined },
      { expectedAssignmentVersion: -1 }, { expectedAssignmentVersion: '3' }, { recipientId: 'other' }, { readAt: new Date().toISOString() }])
      expect(acknowledgeNotificationRequestSchema.safeParse({ ...body, ...patch }).success).toBe(false);
    expect(acknowledgeNotificationRequestSchema.parse({ kind: 'WITHDRAWN' })).toEqual({ kind: 'WITHDRAWN' });
    expect(acknowledgeNotificationRequestSchema.safeParse({ kind: 'WITHDRAWN', revisionId: 'r' }).success).toBe(false);
    expect(acknowledgeNotificationRequestSchema.safeParse({ kind: 'WITHDRAWN', assignmentId: 'a' }).success).toBe(false);
  });
  it('rejects withdrawn content, revision identifiers, reasons, identities and links in the safe DTO', () => {
    const safe = { id: 'notice', proposalId: 'proposal', kind: 'WITHDRAWN', createdAt: '2026-10-26T00:00:00.000Z', readAt: null };
    expect(notificationSchema.parse(safe)).toEqual(safe);
    for (const field of ['title', 'summary', 'diffText', 'reason', 'author', 'recipientId', 'revisionId', 'assignmentId', 'url'])
      expect(notificationSchema.safeParse({ ...safe, [field]: 'sensitive' }).success).toBe(false);
    expect(notificationsResponseSchema.safeParse({ items: Array(101).fill(safe), nextCursor: null }).success).toBe(false);
    expect(acknowledgeNotificationResponseSchema.safeParse({ id: 'notice', readAt: null }).success).toBe(false);
  });
  it('scopes stable notification cursors to recipient and rejects altered shapes', () => {
    const scope = JSON.stringify(['notifications', 'reviewer-a']);
    const position = { id: 'notice', timestamp: '2026-10-26T00:00:00.000Z' };
    const cursor = encodeCursor(scope, position);
    expect(decodeCursor(cursor, scope, 'timestamp')).toEqual(expect.objectContaining(position));
    expect(() => decodeCursor(cursor, JSON.stringify(['notifications', 'reviewer-b']), 'timestamp')).toThrow();
    for (const invalid of ['!', `${cursor}=`, encodeCursor(scope, { id: 'notice', number: 1 })])
      expect(() => decodeCursor(invalid, scope, 'timestamp')).toThrow();
  });
});
