import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PrismaClient } from '../src/generated/prisma/client';
import { createPatchRiskGateway, parseStrictJson, PrismaAiAccounting, SafeAiError, SocLlmHttpsTransport, SystemAiClock } from '../src/ai/gateway';
import type { AiClock, AiDeadline, AiTransport, PatchRiskContext } from '../src/ai/contracts';
import { aiTestOptions, patchRiskContextFixture, reviewerRiskResultFixture } from './ai-fixtures';

const corpus = JSON.parse(readFileSync(resolve(__dirname, '../../../workflow/tests/ai/reviewer/v1.json'), 'utf8')) as {
  injections: string[]; invalidJson: string[]; highConfidenceSecrets: string[]; redactableTokens: string[];
};
const envelope = (value: unknown = reviewerRiskResultFixture(), extra: object = {}) => JSON.stringify({
  choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(value) } }], ...extra,
});
const contextWithText = (field: string, text: string): PatchRiskContext => {
  const context = patchRiskContextFixture();
  if (field === 'criterion') return { ...context, criteria: [{ ...context.criteria[0]!, statement: text }] };
  if (field === 'evidence') return { ...context, evidence: [{ id: 'evidence-1', text }] };
  return { ...context, [field]: text };
};
const contextTextFields = ['summary', 'problem', 'constraints', 'expectedBehavior', 'diffText', 'criterion', 'evidence'];
function harness() {
  let time = Date.parse('2026-10-26T04:00:00Z');
  const clock: AiClock = { now: () => new Date(time), monotonicMs: () => time,
    sleep: async ms => { time += ms; } };
  const end = time + 20_000;
  const deadline: AiDeadline = { signal: new AbortController().signal, remainingMs: () => Math.max(0, end-time),
    assertRemaining: () => { if (time >= end) throw new SafeAiError('DEADLINE'); } };
  const request = { create: jest.fn(async () => ({})), update: jest.fn(async () => ({})), deleteMany: jest.fn(async () => ({ count: 0 })) };
  const attempt = { create: jest.fn(async () => ({ id: 'attempt' })), update: jest.fn(async () => ({})),
    updateMany: jest.fn(async () => ({ count: 0 })), count: jest.fn(async (query: object) => { void query; return 0; }), findFirst: jest.fn(async () => null) };
  const queue = { create: jest.fn(async () => ({})), deleteMany: jest.fn(async () => ({ count: 0 })), count: jest.fn(async () => 0) };
  const tx = { aiRequest: request, aiOutboundAttempt: attempt, aiQueueLease: queue,
    $queryRaw: jest.fn(async () => []), $queryRawUnsafe: jest.fn(async () => [{ id: 'reviewer-patch-risk' }]) };
  const prisma = { ...tx, $transaction: async <T>(work: (value: typeof tx) => Promise<T>) => work(tx) } as unknown as PrismaClient;
  const transport: AiTransport = { complete: jest.fn(async () => ({ status: 200, body: envelope(), retryAfter: null })) };
  const counter = { model: 'synthetic-reviewer-model', verificationId: 'synthetic-counter-v1', countInput: jest.fn(() => 100) };
  const beforeAttempt = jest.fn(async () => undefined);
  const gateway = createPatchRiskGateway({ prisma, options: aiTestOptions, transport, counter, clock });
  return { prisma, clock, deadline, request, attempt, queue, transport, counter, beforeAttempt, gateway,
    call: (context: PatchRiskContext = patchRiskContextFixture()) => gateway.analyze(context, { actorId: 'actor', deadline, beforeAttempt }),
    advance: (ms: number) => { time += ms; } };
}

describe('Reviewer gateway v1 synthetic evaluations', () => {
  it('ai-output-rejection: normal result and invalid JSON/schema/envelopes fail without repair or retry', async () => {
    for (const raw of corpus.invalidJson) expect(() => parseStrictJson(raw)).toThrow();
    expect(() => parseStrictJson('['.repeat(34)+'0'+']'.repeat(34))).toThrow();
    expect(() => parseStrictJson(JSON.stringify('😀'.repeat(20000)))).toThrow();
    expect(parseStrictJson('{"a":[true,null,-1.5e2]}')).toEqual({ a: [true,null,-150] });
    const good = harness(); expect((await good.call()).result).toEqual(reviewerRiskResultFixture());
    const result = reviewerRiskResultFixture();
    const invalid = [
      ...corpus.invalidJson.map(raw => JSON.stringify({choices:[{finish_reason:'stop',message:{role:'assistant',content:raw}}]})),
      envelope({...result,unknown:true}), envelope({...result,confidence:'CERTAIN'}),
      envelope({...result,coverage:[]}), envelope({...result,coverage:[result.coverage[0],result.coverage[0]]}),
      envelope({...result,risks:[{criterionIds:['other'],severity:'HIGH',description:'Unknown grounding'}]}),
      envelope({...result,questions:['😀'.repeat(101)]}), envelope({...result,questions:Array(4).fill('Q')}),
      JSON.stringify({choices:[{finish_reason:'length',message:{role:'assistant',content:JSON.stringify(result)}}]}),
      JSON.stringify({choices:[{finish_reason:'stop',message:{role:'assistant',content:JSON.stringify(result),refusal:'No'}}]}),
      JSON.stringify({choices:[{finish_reason:'stop',message:{role:'assistant',content:JSON.stringify(result),tool_calls:[]}}]}),
      JSON.stringify({choices:[]}), envelope(result,{usage:{completion_tokens:801}}),
      envelope(result,{usage:{prompt_tokens:-1}}), envelope(result,{usage:{prompt_tokens_details:{cached_tokens:'3'}}}),
      'x'.repeat(65537),
    ];
    for (const body of invalid) {
      const h=harness();jest.mocked(h.transport.complete).mockResolvedValue({status:200,body,retryAfter:null});
      await expect(h.call()).rejects.toMatchObject({errorClass:'INVALID_OUTPUT'});
      expect(h.transport.complete).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(h.request.update.mock.calls)).not.toContain('Missing boundary evidence');
    }
  });

  it('ai-secret-injection: all context stays data, secrets screen before calls and privacy metadata has no raw output', async () => {
    for (const payload of corpus.injections) {
      const h=harness();await h.call(patchRiskContextFixture({ summary:payload, evidence:[{id:'e',text:payload}] }));
      const sent=jest.mocked(h.transport.complete).mock.calls[0]![0];
      expect(sent.messages).toHaveLength(2);expect(sent.messages[0]!.role).toBe('system');
      expect(sent.messages[1]!.content).not.toContain('<system>');
      expect(sent.messages[1]!.content).not.toContain('accessGenerationId');
      expect(JSON.stringify(h.request.create.mock.calls)).not.toContain(payload);
      expect(JSON.stringify(h.request.update.mock.calls)).not.toContain('Boundary behavior needs checking');
    }
    for (const key of ['summary','problem','constraints','expectedBehavior','diffText'] as const) {
      const h=harness();await expect(h.call(patchRiskContextFixture({[key]:'Authorization: Bearer synthetic-secret'}))).rejects.toMatchObject({errorClass:'SECRET_DETECTED'});
      expect(h.transport.complete).not.toHaveBeenCalled();expect(h.attempt.create).not.toHaveBeenCalled();
    }
    for (const context of [patchRiskContextFixture({criteria:[{id:'criterion-1',stableKey:'k',statement:'api_key=synthetic-secret',required:true}]}),
      patchRiskContextFixture({evidence:[{id:'e',text:'-----BEGIN PRIVATE KEY-----'}]})]) {
      const h=harness();await expect(h.call(context)).rejects.toMatchObject({errorClass:'SECRET_DETECTED'});expect(h.transport.complete).not.toHaveBeenCalled();
    }
    const h=harness();await h.call(patchRiskContextFixture({summary:'ghp_'+'a'.repeat(24)}));
    expect(jest.mocked(h.transport.complete).mock.calls[0]![0].messages[1]!.content).toContain('[REDACTED_TOKEN]');
    const invalid=harness();await expect(invalid.call(patchRiskContextFixture({summary:'bad\u0000text'}))).rejects.toMatchObject({errorClass:'UNSUPPORTED_INPUT'});
  });

  it('ai-secret-variants: quoted credentials and encrypted keys reject before reservations across every narrative field', async () => {
    for (const field of contextTextFields) for (const secret of corpus.highConfidenceSecrets) {
      const h = harness();
      await expect(h.call(contextWithText(field, secret))).rejects.toMatchObject({ errorClass: 'SECRET_DETECTED' });
      expect(h.transport.complete).not.toHaveBeenCalled();
      expect(h.attempt.create).not.toHaveBeenCalled();
      expect(JSON.stringify([h.request.create.mock.calls, h.request.update.mock.calls])).not.toContain(secret);
    }
  });

  it('ai-token-normalization: compatibility tokens redact across narrative fields without changing grounding identifiers', async () => {
    for (const field of contextTextFields) for (const token of corpus.redactableTokens) {
      const h = harness();
      const narrative = contextWithText(field, `Before ${token} after`);
      const context: PatchRiskContext = { ...narrative,
        evidence: [...narrative.evidence, { id: 'evidence-reference', text: 'Normal evidence.' }],
        criterionEvidenceLinks: [{ criterionId: 'criterion-1', evidenceId: 'evidence-reference' }] };
      const snapshot = JSON.stringify(context);
      await h.call(context);
      const sent = jest.mocked(h.transport.complete).mock.calls[0]![0].messages[1]!.content;
      expect(sent).toContain('Before [REDACTED_TOKEN] after');
      expect(sent).not.toContain(token);
      expect(sent).not.toContain(token.normalize('NFKC'));
      expect(sent).toContain('"selectedCriterionIds":["criterion-1"]');
      expect(sent).toContain('"criterionEvidenceLinks":[{"criterionId":"criterion-1","evidenceId":"evidence-reference"}]');
      expect(JSON.stringify(context)).toBe(snapshot);
    }
    // A token-shaped identifier must fail safely, never turn into a different ID.
    for (const token of corpus.redactableTokens) {
      const h = harness();
      const context = patchRiskContextFixture({ selectedCriterionIds: [token],
        criteria: [{ ...patchRiskContextFixture().criteria[0]!, id: token }] });
      await expect(h.call(context)).rejects.toMatchObject({ errorClass: 'SECRET_DETECTED' });
      expect(h.transport.complete).not.toHaveBeenCalled();
    }
  });

  it('ai-rejected-usage: independently valid usage survives malformed content, refusal, truncation and schema rejection', async () => {
    const usage = { prompt_tokens: 321, completion_tokens: 123, total_tokens: 444, prompt_tokens_details: { cached_tokens: 12 } };
    const expected = { promptTokens: 321, completionTokens: 123, totalTokens: 444, cachedTokens: 12 };
    const content = JSON.stringify(reviewerRiskResultFixture());
    const choices = [
      [{ finish_reason: 'stop', message: { role: 'assistant', content: '{malformed' } }],
      [{ finish_reason: 'stop', message: { role: 'assistant', content, refusal: 'Synthetic refusal' } }],
      [{ finish_reason: 'length', message: { role: 'assistant', content } }],
      [{ finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify({ invalid: 'schema' }) } }],
      [],
    ];
    for (const choice of choices) {
      const h = harness();
      jest.mocked(h.transport.complete).mockResolvedValue({ status: 200, body: JSON.stringify({ choices: choice, usage }), retryAfter: null });
      await expect(h.call()).rejects.toMatchObject({ errorClass: 'INVALID_OUTPUT' });
      expect(h.attempt.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
        outcome: 'FAILED', errorClass: 'INVALID_OUTPUT', ...expected,
      }) }));
      expect(h.transport.complete).toHaveBeenCalledTimes(1);
      const recorded = JSON.stringify([h.attempt.update.mock.calls, h.request.update.mock.calls]);
      expect(recorded).not.toContain('malformed');
      expect(recorded).not.toContain('Synthetic refusal');
      expect(recorded).not.toContain('Missing boundary evidence');
    }
    const over = harness();
    jest.mocked(over.transport.complete).mockResolvedValue({ status: 200,
      body: envelope(undefined, { usage: { ...usage, completion_tokens: 801 } }), retryAfter: null });
    await expect(over.call()).rejects.toMatchObject({ errorClass: 'INVALID_OUTPUT' });
    expect(over.attempt.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ completionTokens: 801 }) }));
  });

  it('ai-attempt-usage: missing/invalid usage remains unknown and retries never borrow earlier usage', async () => {
    const unknown = { promptTokens: null, completionTokens: null, totalTokens: null, cachedTokens: null };
    for (const usage of [undefined, null, {}, { prompt_tokens: -1 }, { completion_tokens: '3' }, { total_tokens: 1.5 },
      { prompt_tokens: 321, prompt_tokens_details: { cached_tokens: '12' } }]) {
      const h = harness();
      const body = JSON.stringify({ usage, choices: [] });
      jest.mocked(h.transport.complete).mockResolvedValue({ status: 200, body, retryAfter: null });
      await expect(h.call()).rejects.toMatchObject({ errorClass: 'INVALID_OUTPUT' });
      expect(h.attempt.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining(unknown) }));
    }
    const h = harness();
    jest.mocked(h.transport.complete)
      .mockResolvedValueOnce({ status: 503, body: JSON.stringify({ usage: { prompt_tokens: 321, completion_tokens: 123, total_tokens: 444,
        prompt_tokens_details: { cached_tokens: 12 } } }), retryAfter: null })
      .mockResolvedValueOnce({ status: 200, body: envelope(), retryAfter: null });
    const result = await h.call();
    expect(h.attempt.update).toHaveBeenNthCalledWith(1, expect.objectContaining({ data: expect.objectContaining({ outcome: 'FAILED', promptTokens: 321, completionTokens: 123, totalTokens: 444, cachedTokens: 12 }) }));
    expect(h.attempt.update).toHaveBeenNthCalledWith(2, expect.objectContaining({ data: expect.objectContaining({ outcome: 'SUCCESS', ...unknown }) }));
    expect(result.metadata.usage).toEqual(unknown);
    const partial = harness();
    jest.mocked(partial.transport.complete).mockResolvedValue({ status: 200, body: envelope(undefined, { usage: { prompt_tokens: 321 } }), retryAfter: null });
    expect((await partial.call()).metadata.usage).toEqual({ ...unknown, promptTokens: 321 });
  });

  it('ai-budget-retry: exact caps, atomic reservation interface, retry count, reset windows and whole deadline', async () => {
    const h=harness();jest.mocked(h.transport.complete).mockResolvedValueOnce({status:503,body:'untrusted error',retryAfter:'1'});
    const answer=await h.call();expect(answer.metadata.attemptCount).toBe(2);expect(h.beforeAttempt).toHaveBeenCalledTimes(2);
    expect(h.attempt.create).toHaveBeenCalledTimes(2);expect(answer.metadata.usage.promptTokens).toBeNull();
    for(const tokens of [10001,Number.NaN,-1]) {const bad=harness();bad.counter.countInput.mockReturnValue(tokens);
      await expect(bad.call()).rejects.toMatchObject({errorClass:'INPUT_LIMIT'});expect(bad.transport.complete).not.toHaveBeenCalled();}
    const large=harness();await expect(large.call(patchRiskContextFixture({diffText:'x'.repeat(20001)}))).rejects.toMatchObject({errorClass:'INPUT_LIMIT'});
    for(const status of [400,401,403,429]) {const bad=harness();jest.mocked(bad.transport.complete).mockResolvedValue({status,body:'ambiguous',retryAfter:null});
      await expect(bad.call()).rejects.toBeInstanceOf(SafeAiError);expect(bad.attempt.create).toHaveBeenCalledTimes(1);}
    const slow=harness();jest.mocked(slow.transport.complete).mockImplementation(async()=>{slow.advance(20001);return{status:200,body:envelope(),retryAfter:null};});
    await expect(slow.call()).rejects.toMatchObject({errorClass:'DEADLINE'});
    const rate=harness();rate.attempt.count.mockResolvedValue(10);await expect(rate.call()).rejects.toMatchObject({errorClass:'RATE_LIMIT'});expect(rate.transport.complete).not.toHaveBeenCalled();
    const queue=harness();queue.queue.count.mockResolvedValue(10);await expect(queue.call()).rejects.toMatchObject({errorClass:'QUEUE_FULL'});
    const daily=harness();const a=new PrismaAiAccounting(daily.prisma,daily.clock);await a.reserveAttempt({requestId:'r',actorId:'actor',ordinal:1,deadline:daily.deadline});
    expect(daily.attempt.count.mock.calls[1]![0]).toMatchObject({where:{dispatchedAt:{gte:new Date('2026-10-25T16:00:00Z')}}});
  });

  it('ai-live-disabled: unverified config cannot dispatch, endpoint and HTTPS transport are bounded', async () => {
    const h=harness();const disabled=createPatchRiskGateway({prisma:h.prisma,options:{mode:'disabled'},transport:h.transport,counter:h.counter,clock:h.clock});
    await expect(disabled.analyze(patchRiskContextFixture(),{actorId:'actor',deadline:h.deadline,beforeAttempt:h.beforeAttempt})).rejects.toMatchObject({errorClass:'DISABLED'});
    expect(h.transport.complete).not.toHaveBeenCalled();expect(h.attempt.create).not.toHaveBeenCalled();
    const mismatch=harness();mismatch.counter.verificationId='wrong';await expect(mismatch.call()).rejects.toMatchObject({errorClass:'CONFIGURATION'});
    const native=new SocLlmHttpsTransport();const request={baseUrl:'https://evil.invalid/v1',apiKey:'synthetic',model:'synthetic',messages:[],maxTokens:800 as const,reasoningEffort:'none' as const,stream:false as const,maxResponseBytes:65536 as const,deadline:h.deadline};
    await expect(native.complete(request)).rejects.toMatchObject({errorClass:'CONFIGURATION'});
    const fetchSpy=jest.spyOn(globalThis,'fetch').mockResolvedValue(new Response('x'.repeat(65537),{status:200}));
    try {
      await expect(native.complete({...request,baseUrl:'https://soclaas-api.comp.nus.edu.sg/v1'})).rejects.toMatchObject({errorClass:'INVALID_OUTPUT'});
      expect(fetchSpy.mock.calls[0]![1]).toMatchObject({redirect:'error'});
      fetchSpy.mockResolvedValueOnce(new Response(new Uint8Array([0xff,0xfe]),{status:200}));
      await expect(native.complete({...request,baseUrl:'https://soclaas-api.comp.nus.edu.sg/v1'})).rejects.toMatchObject({errorClass:'INVALID_OUTPUT'});
    } finally {fetchSpy.mockRestore();}
    expect(new SystemAiClock().monotonicMs()).toBeGreaterThan(0);
  });

  it('ai-transport-success: complete UTF-8 split across reads succeeds and releases the reader', async () => {
    const cancel = jest.fn();
    const body = new ReadableStream<Uint8Array>({ start(controller) {
      controller.enqueue(new Uint8Array([0xf0, 0x9f]));
      controller.enqueue(new Uint8Array([0x98, 0x80]));
      controller.close();
    }, cancel });
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(body));
    try {
      const h = harness();
      await expect(new SocLlmHttpsTransport().complete({ baseUrl: 'https://soclaas-api.comp.nus.edu.sg/v1', apiKey: 'synthetic',
        model: 'synthetic', messages: [], maxTokens: 800, reasoningEffort: 'none', stream: false, maxResponseBytes: 65536, deadline: h.deadline }))
        .resolves.toEqual({ status: 200, body: '😀', retryAfter: null });
      expect(cancel).not.toHaveBeenCalled();
      expect((fetchSpy.mock.calls[0]![1]!.signal as AbortSignal).aborted).toBe(false);
      expect(body.locked).toBe(false);
    } finally { fetchSpy.mockRestore(); }
  });

  it.each(['advertised overflow', 'actual overflow'] as const)('ai-transport-cleanup: %s aborts and cancels an open body without waiting for cancellation', async kind => {
    const cancel = jest.fn(() => new Promise<void>(() => undefined));
    const body = new ReadableStream<Uint8Array>({ start(controller) {
      if (kind === 'actual overflow') controller.enqueue(new Uint8Array(65_537));
    }, cancel });
    const response = new Response(body, { headers: kind === 'advertised overflow' ? { 'content-length': '65537' } : {} });
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(response);
    try {
      const h = harness();
      await expect(new SocLlmHttpsTransport().complete({ baseUrl: 'https://soclaas-api.comp.nus.edu.sg/v1', apiKey: 'synthetic',
        model: 'synthetic', messages: [], maxTokens: 800, reasoningEffort: 'none', stream: false, maxResponseBytes: 65536, deadline: h.deadline }))
        .rejects.toMatchObject({ errorClass: 'INVALID_OUTPUT' });
      expect(cancel).toHaveBeenCalledTimes(1);
      expect((fetchSpy.mock.calls[0]![1]!.signal as AbortSignal).aborted).toBe(true);
      expect(body.locked).toBe(false);
    } finally { fetchSpy.mockRestore(); }
  });

  it.each(['invalid UTF-8', 'read failure', 'missing body'] as const)('ai-transport-cleanup: %s leaves transport aborted and body unlocked', async kind => {
    const body = kind === 'missing body' ? null : new ReadableStream<Uint8Array>({ start(controller) {
      if (kind === 'read failure') controller.error(new Error('Synthetic stream failure'));
      else { controller.enqueue(new Uint8Array([0xff, 0xfe])); controller.close(); }
    } });
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(body));
    try {
      const h = harness();
      await expect(new SocLlmHttpsTransport().complete({ baseUrl: 'https://soclaas-api.comp.nus.edu.sg/v1', apiKey: 'synthetic',
        model: 'synthetic', messages: [], maxTokens: 800, reasoningEffort: 'none', stream: false, maxResponseBytes: 65536, deadline: h.deadline }))
        .rejects.toMatchObject({ errorClass: kind === 'invalid UTF-8' ? 'INVALID_OUTPUT' : 'TRANSPORT' });
      expect((fetchSpy.mock.calls[0]![1]!.signal as AbortSignal).aborted).toBe(true);
      expect(body?.locked ?? false).toBe(false);
    } finally { fetchSpy.mockRestore(); }
  });

  it.each(['signal', 'timer'] as const)('ai-transport-deadline: %s cancels a pending read even when cancellation never settles', async source => {
    jest.useFakeTimers();
    const cancel = jest.fn(() => new Promise<void>(() => undefined));
    const body = new ReadableStream<Uint8Array>({ cancel });
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(body));
    const controller = new AbortController();
    const deadline: AiDeadline = { signal: controller.signal, remainingMs: () => 20, assertRemaining: () => undefined };
    try {
      const pending = new SocLlmHttpsTransport().complete({ baseUrl: 'https://soclaas-api.comp.nus.edu.sg/v1', apiKey: 'synthetic',
        model: 'synthetic', messages: [], maxTokens: 800, reasoningEffort: 'none', stream: false, maxResponseBytes: 65536, deadline });
      const rejected = expect(pending).rejects.toMatchObject({ errorClass: 'DEADLINE' });
      for (let i = 0; i < 8; i++) await Promise.resolve();
      expect(body.locked).toBe(true);
      if (source === 'signal') controller.abort();
      else jest.advanceTimersByTime(20);
      await rejected;
      expect(cancel).toHaveBeenCalledTimes(1);
      expect((fetchSpy.mock.calls[0]![1]!.signal as AbortSignal).aborted).toBe(true);
      expect(body.locked).toBe(false);
      expect(jest.getTimerCount()).toBe(0);
    } finally { fetchSpy.mockRestore(); jest.useRealTimers(); }
  });
});
