const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { verifyReviewerLive } = require(resolve('src/server/dist/ai/reviewer-live-verification.js'));
const { readAiConfig } = require(resolve('src/server/dist/config.js'));
const config = readAiConfig({ AI_MODEL: 'synthetic-reviewer-model', AI_CONTEXT_WINDOW: '16384', AI_API_KEY: 'synthetic-key' });
async function probe(name, durations, options = {}) {
  let time = 0, calls = 0;
  const clock = { now: () => new Date(time), monotonicMs: () => time, sleep: async ms => { time += ms; } };
  const transport = { complete: async request => {
    time += durations[calls++];
    if (calls === options.failAt) return { status: 401, body: '{}', retryAfter: null };
    const context = JSON.parse(request.messages[1].content.match(/\n(.*)\n<\/submitted_context>/s)[1]);
    const result = { coverage: context.selectedCriterionIds.map(criterionId => ({ criterionId, status: 'COVERED', rationale: 'Synthetic check.' })), risks: [], questions: [], suggestedTests: [], confidence: 'LOW' };
    return { status: 200, retryAfter: null, body: JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(result) } }], usage: { prompt_tokens: 100, completion_tokens: 80, total_tokens: 180 } }) };
  } };
  const report = await verifyReviewerLive({ ...config, ...(options.contextWindow ? { AI_CONTEXT_WINDOW: options.contextWindow } : {}) }, { live: options.live !== false, transport, clock });
  console.log(JSON.stringify({ name, injectedTransportCalls: calls, providerCalls: 0, protocolPassed: report.protocolPassed, passed: report.passed, latency: report.latency }));
  assert.equal(calls, options.calls ?? 9);
  assert.equal(report.passed, options.passed ?? false);
  assert.equal(report.latency.status, options.status ?? 'FAIL');
  assert.equal(report.latency.medianMs, options.median);
  assert.equal(report.latency.p95Ms, options.p95);
  assert.equal(report.latency.sampleCount, calls);
  assert.equal(report.latency.expectedSampleCount, options.expected ?? 9);
  assert.equal(report.latency.complete, options.complete ?? true);
  assert.equal(report.protocolPassed, options.protocol ?? true);
}
(async () => {
  await probe('original-nine-19s', Array(9).fill(19000), { median: 19000, p95: 19000 });
  await probe('fast-unsorted', [900,100,800,200,700,300,600,400,500], { median: 500, p95: 900, passed: true, status: 'PASS' });
  await probe('median-exact-8000', Array(9).fill(8000), { median: 8000, p95: 8000 });
  await probe('p95-exact-18000', [...Array(8).fill(1000),18000], { median: 1000, p95: 18000 });
  await probe('partial-even-includes-failure', [1000,2000,3000,4000,5000,6000,7000,8000], { failAt: 8, calls: 8, median: 4500, p95: 8000, status: 'UNAVAILABLE', complete: false, protocol: false });
  await probe('dry-run', [], { live: false, calls: 0, median: null, p95: null, status: 'UNAVAILABLE', complete: false, passed: true });
  await probe('live-zero-admitted', [], { contextWindow: 900, calls: 0, expected: 0, median: null, p95: null, status: 'UNAVAILABLE', complete: false, protocol: false });
})().catch(error => { console.error(error); process.exitCode = 1; });
