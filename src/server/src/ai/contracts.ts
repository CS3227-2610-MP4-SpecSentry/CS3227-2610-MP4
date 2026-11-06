// Server-only contracts. Never re-export from @specsentry/shared.
import type { AiErrorClass, AiOutcome, AiTokenUsage, ContributorDraftRequest, ContributorDraftResult,
  MaintainerGateAnalyzedScope, MaintainerGateResult, PatchRiskAnalyzedScope, ReviewerRiskResult } from '@specsentry/shared';
import type { Prisma } from '../generated/prisma/client';

export const PATCH_RISK_GATEWAY = Symbol('PATCH_RISK_GATEWAY');
export const CONTRIBUTOR_DRAFT_GATEWAY = Symbol('CONTRIBUTOR_DRAFT_GATEWAY');
export const MAINTAINER_GATEWAY = Symbol('MAINTAINER_GATEWAY');
export const AI_TRANSPORT = Symbol('AI_TRANSPORT');
export const INPUT_BUDGET_COUNTER = Symbol('INPUT_BUDGET_COUNTER');
export const AI_CLOCK = Symbol('AI_CLOCK');
export const AI_GATEWAY_OPTIONS = Symbol('AI_GATEWAY_OPTIONS');

// Live credentials remain server-only; test options cannot select native transport.
type EnabledAiOptions = Readonly<{ model: string; contextWindow: number; inputBudgetMethodId: string }>;
export type AiGatewayOptions = Readonly<{ mode: 'disabled' }>
  | (EnabledAiOptions & Readonly<{ mode: 'test' }>)
  | (EnabledAiOptions & Readonly<{ mode: 'live'; apiKey: string }>);

export interface AiDeadline {
  readonly signal: AbortSignal;
  remainingMs(): number;
  assertRemaining(): void;
}
export interface AiClock {
  now(): Date;
  monotonicMs(): number;
  sleep(milliseconds: number, signal: AbortSignal): Promise<void>;
}
export interface PatchRiskScope extends Readonly<PatchRiskAnalyzedScope> {
  readonly accessGenerationId: string;
}
export interface PatchRiskContext {
  readonly scope: PatchRiskScope;
  readonly selectedCriterionIds: readonly string[];
  readonly summary: string;
  readonly problem: string;
  readonly constraints: string;
  readonly expectedBehavior: string;
  readonly diffText: string;
  readonly criteria: readonly Readonly<{ id: string; stableKey: string; statement: string; required: boolean }>[];
  readonly evidence: readonly Readonly<{ id: string; text: string }>[];
  readonly criterionEvidenceLinks: readonly Readonly<{ criterionId: string; evidenceId: string }>[];
}
export interface AiSafeMetadata {
  readonly requestId: string;
  readonly templateVersion: string;
  readonly contextHash: string;
  readonly latencyMs: number;
  readonly attemptCount: number;
  readonly usage: AiTokenUsage;
}
export interface PatchRiskGatewayResult { readonly result: ReviewerRiskResult; readonly metadata: AiSafeMetadata }
export interface PatchRiskGateway {
  analyze(context: PatchRiskContext, options: {
    readonly actorId: string;
    readonly deadline: AiDeadline;
    // Fresh authorization after queue wait and before each dispatch/retry.
    readonly beforeAttempt: (tx: Prisma.TransactionClient) => Promise<void>;
  }): Promise<PatchRiskGatewayResult>;
}
export interface ContributorDraftContext {
  readonly scope: ContributorDraftRequest & { proposalId: string };
  readonly draft: { title: string; summary: string; problem: string; constraints: string; expectedBehavior: string;
    criteria: readonly Readonly<{ statement: string; required: boolean }>[] };
}
export interface ContributorDraftGateway {
  analyze(context: ContributorDraftContext, options: {
    readonly actorId: string; readonly deadline: AiDeadline; readonly beforeAttempt: (tx: Prisma.TransactionClient) => Promise<void>;
  }): Promise<{ readonly result: ContributorDraftResult; readonly metadata: AiSafeMetadata }>;
}
export type MaintainerGateCode = 'EMPTY' | 'VERSION' | 'ROLLBACK' | 'SMOKE' | 'REVISION' | 'APPROVAL' | 'COVERAGE' | 'FINDING';
export interface MaintainerGateContext {
  readonly scope: Readonly<MaintainerGateAnalyzedScope>;
  readonly candidate: Readonly<{
    versionLabel: string;
    rollbackNote: string;
    dependencyNotes: string;
    blockerCodes: readonly MaintainerGateCode[];
  }>;
  readonly items: readonly Readonly<{
    itemId: string;
    title: string;
    revisionNumber: number;
    submittedSummary: string;
    gateStatuses: Readonly<{
      currentRevision: 'PASS' | 'FAIL';
      approval: 'PASS' | 'FAIL';
      requiredCoverage: 'PASS' | 'FAIL';
      highCriticalFindings: 'PASS' | 'FAIL';
    }>;
  }>[];
}
export interface MaintainerGateGateway {
  analyze(context: MaintainerGateContext, options: {
    readonly actorId: string; readonly deadline: AiDeadline;
    readonly beforeAttempt: (tx: Prisma.TransactionClient) => Promise<void>;
  }): Promise<{ readonly result: MaintainerGateResult; readonly metadata: AiSafeMetadata }>;
}
export interface AiMessage { readonly role: 'system' | 'user'; readonly content: string }
export interface AiResponseFormat {
  readonly type: 'json_schema';
  readonly json_schema: Readonly<{ name: string; strict: true; schema: Readonly<Record<string, unknown>> }>;
}
export interface AiTransportRequest {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly model: string;
  readonly messages: readonly AiMessage[];
  readonly responseFormat?: AiResponseFormat;
  readonly maxTokens: 800;
  readonly reasoningEffort: 'none';
  readonly stream: false;
  readonly maxResponseBytes: 65_536;
  readonly deadline: AiDeadline;
}
export interface AiTransportResponse {
  readonly status: number;
  readonly body: string;
  readonly retryAfter: string | null;
}
export interface AiTransport { complete(request: AiTransportRequest): Promise<AiTransportResponse> }
export interface InputBudgetCounter {
  // Admission units are a policy heuristic, never provider-reported token usage.
  readonly model: string;
  readonly methodId: string;
  countUnits(messages: readonly AiMessage[]): number;
}
export interface AiSafeFailure {
  readonly requestId: string;
  readonly outcome: AiOutcome;
  readonly errorClass: AiErrorClass;
  readonly retryAfterSeconds?: number;
}
