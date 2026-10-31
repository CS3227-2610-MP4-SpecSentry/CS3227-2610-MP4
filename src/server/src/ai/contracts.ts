// Server-only contracts. Never re-export from @specsentry/shared.
import type { AiErrorClass, AiOutcome, AiTokenUsage, PatchRiskAnalyzedScope, ReviewerRiskResult } from '@specsentry/shared';

export const PATCH_RISK_GATEWAY = Symbol('PATCH_RISK_GATEWAY');
export const AI_TRANSPORT = Symbol('AI_TRANSPORT');
export const VERIFIED_TOKEN_COUNTER = Symbol('VERIFIED_TOKEN_COUNTER');
export const AI_CLOCK = Symbol('AI_CLOCK');
export const AI_GATEWAY_OPTIONS = Symbol('AI_GATEWAY_OPTIONS');

// There is deliberately no live mode while OPEN-002 evidence is unavailable.
// Test bootstrap must supply these options and deterministic transport/counter
// providers in-process; configuration from an HTTP request cannot select them.
export type AiGatewayOptions = Readonly<{ mode: 'disabled' }> | Readonly<{
  mode: 'test';
  model: string;
  contextWindow: number;
  tokenCounterVerificationId: string;
}>;

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
    readonly beforeAttempt: () => Promise<void>;
  }): Promise<PatchRiskGatewayResult>;
}
export interface AiMessage { readonly role: 'system' | 'user'; readonly content: string }
export interface AiTransportRequest {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly model: string;
  readonly messages: readonly AiMessage[];
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
export interface VerifiedTokenCounter {
  // Exact alias and verification evidence must match the enabled live configuration.
  readonly model: string;
  readonly verificationId: string;
  countInput(messages: readonly AiMessage[]): number;
}
export interface AiSafeFailure {
  readonly requestId: string;
  readonly outcome: AiOutcome;
  readonly errorClass: AiErrorClass;
  readonly retryAfterSeconds?: number;
}
