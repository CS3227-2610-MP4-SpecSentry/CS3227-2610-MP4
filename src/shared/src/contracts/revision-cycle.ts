import { z } from 'zod';
import { normalizeReviewerText, reviewerCodePointLength, reviewerIdSchema as id, reviewerVersionSchema as version,
  reviewerTimestampSchema as timestamp, proposalStateSchema, reviewIdempotencyKeySchema } from './reviewer';

const text = (max: number, required = false) => z.string().transform(normalizeReviewerText)
  .refine(v => reviewerCodePointLength(v) <= max, `Maximum ${max} characters`)
  .refine(v => !required || v.trim().length > 0, 'Must not be empty');
export const workingContentSchema = z.object({
  title: text(200, true), summary: text(500), problem: text(10000, true), constraints: text(10000),
  expectedBehavior: text(10000, true), diffText: text(100000),
  criteria: z.array(z.object({ stableKey: id.optional(), statement: text(2000, true), required: z.boolean().default(true) }).strict()).max(50),
  evidence: z.array(z.object({ id: id.optional(), text: text(50000, true) }).strict()).max(50000),
}).strict().superRefine((v, ctx) => {
  if (v.evidence.reduce((sum, e) => sum + reviewerCodePointLength(e.text), 0) > 50000)
    ctx.addIssue({ code: 'custom', path: ['evidence'], message: 'Total evidence exceeds limit' });
  const keys = v.criteria.flatMap(c => c.stableKey ? [c.stableKey] : []);
  if (new Set(keys).size !== keys.length) ctx.addIssue({ code: 'custom', path: ['criteria'], message: 'Duplicate criterion keys' });
  const ids = v.evidence.flatMap(e => e.id ? [e.id] : []);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', path: ['evidence'], message: 'Duplicate evidence IDs' });
});
export const createProposalRequestSchema = workingContentSchema;
export const saveDraftRequestSchema = z.object({ expectedVersion: version, content: workingContentSchema }).strict();
export const submitProposalRequestSchema = z.object({ expectedVersion: version, workingRevisionId: id }).strict();
export const withdrawProposalRequestSchema = z.object({ expectedVersion: version, confirmed: z.literal(true), reason: text(2000, true) }).strict();
export const reopenProposalRequestSchema = z.object({ expectedVersion: version }).strict();
export const proposalLifecycleResponseSchema = z.object({ proposalId: id, revisionId: id.nullable(),
  workingRevisionId: id.nullable(), assignmentId: id.nullable(), assignmentVersion: version.nullable(),
  version, state: proposalStateSchema }).strict();
export const draftResponseSchema = z.object({ proposalId: id, workingRevisionId: id, version,
  state: proposalStateSchema, content: workingContentSchema }).strict();
const pageInt = z.preprocess(v => typeof v === 'string' && /^[1-9][0-9]*$/.test(v) ? Number(v) : v, z.number().int().min(1).max(100));
export const notificationsQuerySchema = z.object({ limit: pageInt.default(20), cursor: z.string().min(1).max(2048).optional() }).strict();
const noticeBase = { id, proposalId: id, createdAt: timestamp, readAt: timestamp.nullable() };
export const notificationSchema = z.discriminatedUnion('kind', [
  z.object({ ...noticeBase, kind: z.literal('NEW_REVISION'), revisionId: id }).strict(),
  z.object({ ...noticeBase, kind: z.literal('WITHDRAWN') }).strict(),
]);
export const notificationsResponseSchema = z.object({ items: z.array(notificationSchema).max(100), nextCursor: z.string().nullable() }).strict();
export const acknowledgeNotificationRequestSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('NEW_REVISION'), revisionId: id, assignmentId: id, expectedAssignmentVersion: version }).strict(),
  z.object({ kind: z.literal('WITHDRAWN') }).strict(),
]);
export const acknowledgeNotificationResponseSchema = z.object({ id, readAt: timestamp }).strict();
export { reviewIdempotencyKeySchema as submissionIdempotencyKeySchema };
export type WorkingContent = z.infer<typeof workingContentSchema>;
export type SaveDraftRequest = z.infer<typeof saveDraftRequestSchema>;
export type SubmitProposalRequest = z.infer<typeof submitProposalRequestSchema>;
export type WithdrawProposalRequest = z.infer<typeof withdrawProposalRequestSchema>;
export type ReopenProposalRequest = z.infer<typeof reopenProposalRequestSchema>;
export type ProposalLifecycleResponse = z.infer<typeof proposalLifecycleResponseSchema>;
export type NotificationsQuery = z.infer<typeof notificationsQuerySchema>;
export type AcknowledgeNotificationRequest = z.infer<typeof acknowledgeNotificationRequestSchema>;
export type NotificationItem = z.infer<typeof notificationSchema>;
