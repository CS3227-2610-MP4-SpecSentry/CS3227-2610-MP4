import { randomUUID } from 'node:crypto';
import { prepareWorkingContent } from '../src/proposals/working-revisions';

const content = { title: 'Title', problem: 'Problem', constraints: '', expectedBehavior: 'Expected', summary: '', diffText: '', criteria: [], evidence: [] };
describe('Explicit owner criterion identity', () => {
  it('issues keys, preserves declared same meaning/classification, and replaces omitted keys', () => {
    const initial = prepareWorkingContent({ ...content, criteria: [{ statement: 'Original', required: true }, { statement: 'Original', required: true }] });
    const key = initial.criteria[0]!.stableKey!;
    expect(initial.criteria[1]!.stableKey).not.toBe(key);
    const correction = prepareWorkingContent({ ...initial, criteria: [{ stableKey: key, statement: 'Corrected wording', required: false }] }, [initial]);
    expect(correction.criteria[0]).toEqual({ stableKey: key, statement: 'Corrected wording', required: false });
    const replacement = prepareWorkingContent({ ...correction, criteria: [{ statement: 'Different meaning', required: true }] }, [correction]);
    expect(replacement.criteria[0]!.stableKey).not.toBe(key);
    expect(prepareWorkingContent(replacement, [replacement])).toEqual(replacement);
  });
  it('rejects foreign, removed and duplicate keys without reviving identity', () => {
    const original = prepareWorkingContent({ ...content, criteria: [{ statement: 'Original', required: true }] });
    const removed = prepareWorkingContent(content, [original]);
    for (const source of [removed, content]) expect(() => prepareWorkingContent(original, [source])).toThrow();
    expect(() => prepareWorkingContent({ ...content, criteria: [{ stableKey: randomUUID(), statement: 'Forged', required: true }] }, [original])).toThrow();
    expect(() => prepareWorkingContent({ ...original, criteria: [original.criteria[0]!, original.criteria[0]!] }, [original])).toThrow();
  });
});
