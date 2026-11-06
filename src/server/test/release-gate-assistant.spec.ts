import { ForbiddenException } from '@nestjs/common';
import type { MaintainerGateResult } from '@specsentry/shared';
import type { AiDeadline, MaintainerGateContext, MaintainerGateGateway } from '../src/ai/contracts';
import { SystemAiClock } from '../src/ai/gateway';
import type { DatabaseService } from '../src/database/database.service';
import type { BusinessActor } from '../src/identity/business-context';
import { ReleaseGateAssistantService } from '../src/releases/release-gate-assistant.service';

const actor: BusinessActor = { accountId: 'maintainer', accountVersion: 1, correlationId: 'safe-correlation',
  session: { digest: 'digest', issuedAt: Date.now(), csrfToken: 'a'.repeat(64) } };
const input = { expectedVersion: 4, expectedContentVersion: 2 };
const result: MaintainerGateResult = { blockers: [], dependencies: [], releaseNotes: ['Validation update.'],
  rollbackConsiderations: ['Restore the prior image.'], readinessRecommendation: 'READY', confidence: 'MEDIUM' };

function fixture(candidateVersions: number[] = [4, 4, 4], creator = actor.accountId) {
  let candidateRead = 0;
  const account = { id: actor.accountId, role: 'RELEASE_MAINTAINER', enabled: true, version: 1 };
  const session = { data: JSON.stringify({ userId: actor.accountId, accountVersion: 1, ...actor.session }),
    expiresAt: new Date(Date.now() + 60_000) };
  const candidate = () => ({ id: 'candidate', createdById: creator, status: 'OPEN',
    version: candidateVersions[Math.min(candidateRead++, candidateVersions.length - 1)]!, contentVersion: 2 });
  const member = { id: 'item-1', proposalId: 'proposal-1', revisionId: 'revision-1', assignmentId: 'assignment-1',
    approvalId: 'approval-private', proposal: { title: 'Validation change', state: 'IN_RELEASE',
      currentRevisionId: 'revision-1', currentAssignmentId: 'assignment-1', releaseAttachmentRef: 'candidate' },
    revision: { number: 3, summary: 'Validate a synthetic input.' }, approval: { decision: 'APPROVE' } };
  const tx = {
    $queryRaw: jest.fn(async (query: TemplateStringsArray) => {
      const text = query.join('');
      if (text.includes('UserAccount')) return [account];
      if (text.includes('AuthSession')) return [session];
      if (text.includes('ReleaseCandidate')) return [candidate()];
      return [];
    }),
    releaseCandidate: { findUniqueOrThrow: jest.fn(async () => ({ semanticVersion: '1.2.3',
      rollbackPlan: 'Restore the prior image.', dependencyNotes: 'Requires service A.' })) },
    releaseCandidateMember: { findMany: jest.fn(async () => [member]), count: jest.fn(async () => 1) },
    acceptanceCriterion: { findMany: jest.fn(async () => [{ id: 'criterion-1', revisionId: 'revision-1' }]) },
    coverageAssessment: { findMany: jest.fn(async () => [{ proposalId: 'proposal-1', revisionId: 'revision-1',
      assignmentId: 'assignment-1', criterionId: 'criterion-1', status: 'COVERED' }]) },
    reviewFinding: { findMany: jest.fn(async () => []) },
    approvalInvalidation: { findMany: jest.fn(async () => []) },
    releaseSmokeTest: { findFirst: jest.fn(async () => ({ outcome: 'PASS' })) },
    aiRequest: { updateMany: jest.fn(async () => ({ count: 1 })) },
    aiOutboundAttempt: { count: jest.fn(async () => 0) },
    securityEvent: { create: jest.fn(async () => ({})) },
  };
  const client = { ...tx, $transaction: jest.fn(async <T>(work: (value: typeof tx) => Promise<T>) => work(tx)) };
  let captured: MaintainerGateContext | undefined;
  const gateway: MaintainerGateGateway = { analyze: jest.fn(async (context, options) => {
    captured = context; await options.beforeAttempt(tx as never);
    return { result, metadata: { requestId: 'request-1', templateVersion: 'maintainer-release-gate-v1',
      contextHash: 'a'.repeat(64), latencyMs: 1, attemptCount: 1,
      usage: { promptTokens: null, completionTokens: null, totalTokens: null, cachedTokens: null } } };
  }) };
  const clock = new SystemAiClock();
  const service = new ReleaseGateAssistantService({ client } as unknown as DatabaseService, gateway, clock);
  const deadline: AiDeadline = { signal: new AbortController().signal, remainingMs: () => 20_000,
    assertRemaining: () => undefined };
  return { tx, client, gateway, service, deadline, captured: () => captured };
}

describe('Release Gate Assistant service', () => {
  it('authorizes before protected retrieval and sends only approved release summaries and gate statuses', async () => {
    const h = fixture();
    await expect(h.service.readiness(actor, 'candidate', input, h.deadline)).resolves.toMatchObject({
      status: 'CURRENT', staleReason: null, analyzedScope: { candidateId: 'candidate',
        expectedVersion: 4, expectedContentVersion: 2, candidateItemCount: 1 }, result,
    });
    const context = h.captured()!;
    expect(context).toEqual({ scope: { candidateId: 'candidate', expectedVersion: 4,
      expectedContentVersion: 2, candidateItemCount: 1 }, candidate: { versionLabel: '1.2.3',
      rollbackNote: 'Restore the prior image.', dependencyNotes: 'Requires service A.', blockerCodes: [] },
    items: [{ itemId: 'item-1', title: 'Validation change', revisionNumber: 3,
      submittedSummary: 'Validate a synthetic input.', gateStatuses: { currentRevision: 'PASS',
        approval: 'PASS', requiredCoverage: 'PASS', highCriticalFindings: 'PASS' } }] });
    const serialized = JSON.stringify(context);
    for (const forbidden of ['approval-private', 'diffText', 'evidence', 'description', 'account', 'procedure', 'results'])
      expect(serialized).not.toContain(forbidden);
    expect(h.gateway.analyze).toHaveBeenCalledTimes(1);
    expect(h.tx.releaseCandidate).not.toHaveProperty('update');
    expect(h.tx.releaseCandidateMember).not.toHaveProperty('update');
  });

  it('denies a non-creator before reading protected candidate context or calling the model', async () => {
    const h = fixture([4], 'other-maintainer');
    await expect(h.service.readiness(actor, 'candidate', input, h.deadline)).rejects.toBeInstanceOf(ForbiddenException);
    expect(h.tx.releaseCandidate.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(h.tx.releaseCandidateMember.findMany).not.toHaveBeenCalled();
    expect(h.gateway.analyze).not.toHaveBeenCalled();
  });

  it('reauthorizes before delivery and returns a typed stale advisory when the candidate changes', async () => {
    const h = fixture([4, 4, 5]);
    await expect(h.service.readiness(actor, 'candidate', input, h.deadline)).resolves.toMatchObject({
      status: 'STALE', staleReason: 'CANDIDATE_CHANGED', analyzedScope: { expectedVersion: 4,
        expectedContentVersion: 2, candidateItemCount: 1 }, result,
    });
    expect(h.tx.aiRequest.updateMany).toHaveBeenCalledWith({ where: { id: 'request-1', actorId: 'maintainer',
      candidateId: 'candidate' }, data: { outcome: 'STALE' } });
  });
});
