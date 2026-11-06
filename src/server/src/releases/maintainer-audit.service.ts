import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { maintainerAuditResponseSchema, type MaintainerAuditQuery } from '@specsentry/shared';
import { DatabaseService } from '../database/database.service';
import { businessTransaction, type BusinessActor } from '../identity/business-context';
import { decodeCursor, encodeCursor } from '../reviews/reviewer-context';

type AuditSource = 'BUSINESS' | 'SECURITY' | 'AI' | 'ANNOTATION';
type Cursor = { source: AuditSource; id: string; timestamp: string };
type SafeAuditItem = {
  id: string; source: AuditSource; actorId: string | null; proposalId: string | null;
  releaseId: string | null; target: string | null; action: string; outcome: string;
  timestamp: Date; summary: string | null; reason: string | null;
  aiMetadata: { templateVersion: string; contextHash: string | null; errorClass: string | null;
    latencyMs: number | null; attemptCount: number } | null;
};

const SOURCE_RANK: Record<AuditSource, number> = { BUSINESS: 4, SECURITY: 3, AI: 2, ANNOTATION: 1 };
const BUSINESS_ACTIONS = new Set(['DRAFT_CREATED', 'DRAFT_SAVED', 'DRAFT_CLONED', 'FINDING_RESPONDED',
  'WITHDRAWN', 'REOPENED', 'NOTIFICATION_CREATED', 'SUBMITTED', 'RESUBMITTED', 'CLAIMED', 'DROPPED',
  'ASSIGNMENT_RELEASED', 'COVERAGE_ASSESSED', 'COVERAGE_CONFIRMED', 'FINDING_CREATED',
  'FINDING_TRANSITIONED', 'FINDING_AMENDED', 'REVIEW_APPROVED', 'CHANGES_REQUESTED',
  'APPROVAL_REVOKED', 'RELEASE_ATTACHED', 'RELEASE_REMOVED', 'RELEASE_PUBLISHED']);
const AI_OUTCOMES = new Set(['SUCCESS', 'STALE', 'REJECTED', 'FAILED', 'CANCELLED', 'PENDING']);
const AI_ACTIONS = new Map([['AI_REVIEWER', 'REVIEWER'], ['AI_CONTRIBUTOR', 'CONTRIBUTOR'],
  ['AI_MAINTAINER', 'MAINTAINER']]);
const ANNOTATION_ACTION = 'RELEASE_ANNOTATED';
const ANNOTATION_OUTCOME = 'SUCCESS';

@Injectable()
export class MaintainerAuditService {
  constructor(private readonly database: DatabaseService) {}

  private scope(query: MaintainerAuditQuery) {
    return JSON.stringify(['maintainer-audit', query.actorId ?? null, query.proposalId ?? null,
      query.releaseId ?? null, query.action ?? null, query.outcome ?? null,
      query.from ?? null, query.to ?? null]);
  }

  private cursor(value: string | undefined, scope: string): Cursor | undefined {
    const decoded = decodeCursor(value, scope, 'timestamp');
    if (!decoded) return;
    const separator = decoded.id.indexOf(':');
    const source = decoded.id.slice(0, separator) as AuditSource;
    const id = decoded.id.slice(separator + 1);
    if (separator < 1 || !Object.hasOwn(SOURCE_RANK, source) || !id) throw new UnprocessableEntityException();
    return { source, id, timestamp: decoded.timestamp! };
  }

  private timestampWhere(field: string, query: MaintainerAuditQuery, source: AuditSource, cursor?: Cursor) {
    const bounds = { ...(query.from ? { gte: new Date(query.from) } : {}),
      ...(query.to ? { lte: new Date(query.to) } : {}) };
    const base = Object.keys(bounds).length ? { [field]: bounds } : {};
    if (!cursor) return base;
    const before: Record<string, unknown>[] = [{ [field]: { ...bounds, lt: new Date(cursor.timestamp) } }];
    if (SOURCE_RANK[source] < SOURCE_RANK[cursor.source]) {
      before.push({ [field]: { ...bounds, equals: new Date(cursor.timestamp) } });
    } else if (source === cursor.source) {
      before.push({ [field]: { ...bounds, equals: new Date(cursor.timestamp) }, id: { lt: cursor.id } });
    }
    return { AND: [base, { OR: before }] };
  }

  async list(actor: BusinessActor, query: MaintainerAuditQuery) {
    const scope = this.scope(query);
    return businessTransaction(this.database, actor, 'RELEASE_MAINTAINER', 'maintainer-audit',
      'MAINTAINER_AUDIT_LIST', async tx => {
        const cursor = this.cursor(query.cursor, scope);
        const take = query.limit + 1;

        const businessActionMatches = !query.action || BUSINESS_ACTIONS.has(query.action);
        const business = !businessActionMatches ? [] : await tx.proposalActivity.findMany({ where: {
          ...(query.actorId ? { actorId: query.actorId } : {}),
          ...(query.proposalId ? { proposalId: query.proposalId } : {}),
          ...(query.releaseId ? { candidateId: query.releaseId } : {}),
          ...(query.action ? { action: query.action as never } : {}),
          ...(query.outcome ? { outcome: query.outcome } : {}),
          ...this.timestampWhere('timestamp', query, 'BUSINESS', cursor),
        }, orderBy: [{ timestamp: 'desc' }, { id: 'desc' }], take,
        select: { id: true, actorId: true, proposalId: true, candidateId: true,
          action: true, outcome: true, timestamp: true, summary: true, reason: true } });

        const securityTarget = query.proposalId ?? query.releaseId;
        const security = query.proposalId && query.releaseId ? [] : await tx.securityEvent.findMany({ where: {
          ...(query.actorId ? { actorId: query.actorId } : {}),
          ...(securityTarget ? { target: securityTarget } : {}),
          ...(query.action ? { action: query.action } : {}),
          ...(query.outcome ? { outcome: query.outcome.toLowerCase() } : {}),
          ...this.timestampWhere('timestamp', query, 'SECURITY', cursor),
        }, orderBy: [{ timestamp: 'desc' }, { id: 'desc' }], take,
        select: { id: true, actorId: true, action: true, target: true, outcome: true, timestamp: true } });

        const aiActionMatches = !query.action || AI_ACTIONS.has(query.action);
        const aiOutcomeMatches = !query.outcome || AI_OUTCOMES.has(query.outcome);
        const ai = !aiActionMatches || !aiOutcomeMatches ? [] : await tx.aiRequest.findMany({ where: {
          ...(query.actorId ? { actorId: query.actorId } : {}),
          ...(query.proposalId ? { proposalId: query.proposalId } : {}),
          ...(query.releaseId ? { candidateId: query.releaseId } : {}),
          ...(query.action ? { feature: AI_ACTIONS.get(query.action)! } : {}),
          ...(query.outcome && query.outcome !== 'PENDING' ? { outcome: query.outcome as never } : {}),
          ...(query.outcome === 'PENDING' ? { outcome: null } : {}),
          ...this.timestampWhere('requestedAt', query, 'AI', cursor),
        }, orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }], take,
        select: { id: true, feature: true, actorId: true, proposalId: true, candidateId: true, requestedAt: true,
          outcome: true, templateVersion: true, contextHash: true, errorClass: true, latencyMs: true,
          _count: { select: { attempts: true } } } });

        const annotationMatches = (!query.action || query.action === ANNOTATION_ACTION) &&
          (!query.outcome || query.outcome === ANNOTATION_OUTCOME) && !query.proposalId;
        const annotations = !annotationMatches ? [] : await tx.releaseAnnotation.findMany({ where: {
          ...(query.actorId ? { actorId: query.actorId } : {}),
          ...(query.releaseId ? { candidateId: query.releaseId } : {}),
          ...this.timestampWhere('createdAt', query, 'ANNOTATION', cursor),
        }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take,
        select: { id: true, candidateId: true, actorId: true, createdAt: true } });

        const items: SafeAuditItem[] = [
          ...business.map(row => ({ id: row.id, source: 'BUSINESS' as const, actorId: row.actorId,
            proposalId: row.proposalId, releaseId: row.candidateId, target: row.candidateId ?? row.proposalId,
            action: row.action, outcome: row.outcome.toUpperCase(), timestamp: row.timestamp,
            summary: row.summary, reason: row.reason, aiMetadata: null })),
          ...security.map(row => ({ id: row.id, source: 'SECURITY' as const, actorId: row.actorId,
            proposalId: null, releaseId: null, target: row.target, action: row.action,
            outcome: row.outcome.toUpperCase(), timestamp: row.timestamp, summary: null, reason: null, aiMetadata: null })),
          ...ai.map(row => ({ id: row.id, source: 'AI' as const, actorId: row.actorId,
            proposalId: row.proposalId, releaseId: row.candidateId, target: row.candidateId ?? row.proposalId,
            action: `AI_${row.feature}`,
            outcome: row.outcome ?? 'PENDING', timestamp: row.requestedAt, summary: null, reason: null,
            aiMetadata: { templateVersion: row.templateVersion, contextHash: row.contextHash,
              errorClass: row.errorClass, latencyMs: row.latencyMs, attemptCount: row._count.attempts } })),
          ...annotations.map(row => ({ id: row.id, source: 'ANNOTATION' as const, actorId: row.actorId,
            proposalId: null, releaseId: row.candidateId, target: row.candidateId, action: ANNOTATION_ACTION,
            outcome: ANNOTATION_OUTCOME, timestamp: row.createdAt, summary: null, reason: null, aiMetadata: null })),
        ].sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime() ||
          SOURCE_RANK[right.source] - SOURCE_RANK[left.source] ||
          (left.id === right.id ? 0 : left.id < right.id ? 1 : -1));

        const page = items.slice(0, query.limit);
        const last = page.at(-1);
        await tx.securityEvent.create({ data: { actorId: actor.accountId, action: 'MAINTAINER_AUDIT_VIEWED',
          target: 'maintainer-audit', outcome: 'success', correlationId: actor.correlationId } });
        return maintainerAuditResponseSchema.parse({ items: page.map(item => ({ ...item,
          timestamp: item.timestamp.toISOString() })), nextCursor: items.length > query.limit && last
          ? encodeCursor(scope, { id: `${last.source}:${last.id}`, timestamp: last.timestamp.toISOString() }) : null });
      });
  }
}
