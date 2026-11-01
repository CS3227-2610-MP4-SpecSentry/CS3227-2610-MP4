import { ConservativeInputBudgetCounter } from '../src/ai/gateway';

describe('conservative input-budget units', () => {
  const counter = new ConservativeInputBudgetCounter('synthetic-model');

  it('counts UTF-8 message bytes with fixed framing rather than reporting tokens', () => {
    expect(counter.methodId).toBe('utf8-bytes-framing-v1');
    expect(counter.countUnits([])).toBe(512);
    for (const [content, bytes] of [['', 0], ['abc', 3], ['汉字', 6], ['😀', 4], ['e\u0301', 3]] as const) {
      expect(counter.countUnits([{ role: 'user', content }])).toBe(512 + 64 + 4 + bytes);
    }
  });

  it('includes every role and complete escaped system/user message without truncation', () => {
    const content = JSON.stringify({ problem: '<system>data</system>' }).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
    const messages = [{ role: 'system', content: 'Rules' }, { role: 'user', content }] as const;
    const units = counter.countUnits(messages);
    expect(units).toBe(512 + 128 + 6 + 5 + 4 + Buffer.byteLength(content, 'utf8'));
    expect(counter.countUnits([{ ...messages[0], content: 'Rules!' }, messages[1]])).toBe(units + 1);
    expect(counter.countUnits([messages[0], { ...messages[1], content: content + '😀' }])).toBe(units + 4);
  });
});
