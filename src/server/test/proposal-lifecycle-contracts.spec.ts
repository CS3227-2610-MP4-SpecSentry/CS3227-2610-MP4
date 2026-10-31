import { createProposalRequestSchema, saveDraftRequestSchema, submitProposalRequestSchema, withdrawProposalRequestSchema,
  reopenProposalRequestSchema, workingContentSchema } from '@specsentry/shared';
import { prepareWorkingContent, submittedDiff } from '../src/proposals/working-revisions';

const content = { title: 'Synthetic draft', summary: '', problem: 'Problem', constraints: '', expectedBehavior: 'Expected',
  diffText: '--- a/file\n+++ b/file\n@@ -1 +1 @@\n-old\n+new\n', criteria: [{ statement: 'Required result', required: true }], evidence: [] };

describe('Contributor working revision contracts (REQ-CON-001/002/004/007/009)', () => {
  it('normalizes newlines, counts code points, defaults required and permits optional evidence', () => {
    const parsed = workingContentSchema.parse({ ...content, title: '😀'.repeat(200), problem: 'one\r\ntwo', criteria: [{ statement: 'Required result' }] });
    expect(parsed.problem).toBe('one\ntwo'); expect(parsed.criteria[0]!.required).toBe(true);
    expect(workingContentSchema.safeParse({ ...content, title: '😀'.repeat(201) }).success).toBe(false);
    expect(workingContentSchema.safeParse({ ...content, evidence: [{ text: '' }] }).success).toBe(false);
    expect(workingContentSchema.safeParse({ ...content, evidence: [{ text: 'x'.repeat(25001) }, { text: 'x'.repeat(25000) }] }).success).toBe(false);
  });
  it('rejects injected ownership, state, attachment, actor and audit fields and requires withdrawal confirmation', () => {
    for (const extra of [{ ownerId: 'other' }, { state: 'APPROVED' }, { releaseAttachmentRef: 'candidate' }, { actorId: 'other' }, { version: 40 }])
      expect(createProposalRequestSchema.safeParse({ ...content, ...extra }).success).toBe(false);
    expect(saveDraftRequestSchema.safeParse({ expectedVersion: 0, content, state: 'SUBMITTED' }).success).toBe(false);
    expect(submitProposalRequestSchema.safeParse({ expectedVersion: 0, workingRevisionId: 'working', content }).success).toBe(false);
    expect(withdrawProposalRequestSchema.safeParse({ expectedVersion: 0, confirmed: false, reason: 'Owner reason' }).success).toBe(false);
    expect(withdrawProposalRequestSchema.safeParse({ expectedVersion: 0, confirmed: true, reason: '  ' }).success).toBe(false);
    expect(reopenProposalRequestSchema.safeParse({ expectedVersion: 0, approved: true }).success).toBe(false);
  });
  it('issues identifiers, preserves declared same-meaning keys and rotates explicit replacements', () => {
    const saved = prepareWorkingContent({ ...content, evidence: [{ text: 'Evidence' }] });
    expect(saved.criteria[0]!.stableKey).toEqual(expect.any(String)); expect(saved.evidence[0]!.id).toEqual(expect.any(String));
    expect(prepareWorkingContent(saved, [saved]).criteria[0]!.stableKey).toBe(saved.criteria[0]!.stableKey);
    const changed = prepareWorkingContent({ ...saved, criteria: [{ statement: 'Materially different result', required: false }] }, [saved]);
    expect(changed.criteria[0]!.stableKey).not.toBe(saved.criteria[0]!.stableKey);
    const classification = prepareWorkingContent({ ...saved, criteria: [{ ...saved.criteria[0]!, required: false }] }, [saved]);
    expect(classification.criteria[0]!.stableKey).toBe(saved.criteria[0]!.stableKey);
    expect(() => prepareWorkingContent({ ...content, criteria: [{ statement: 'Foreign', required: true, stableKey: 'foreign' }] }, [saved])).toThrow();
    expect(() => prepareWorkingContent({ ...content, evidence: [{ id: 'foreign', text: 'Foreign' }] }, [saved])).toThrow();
    expect(workingContentSchema.safeParse({ ...saved, criteria: [saved.criteria[0], saved.criteria[0]] }).success).toBe(false);
  });
  it('accepts bounded unified patches including additions, removals and missing-newline markers', () => {
    expect(submittedDiff(content.diffText.replace(/\n/g, '\r\n'))).toBe(content.diffText);
    for (const diff of ['--- /dev/null\n+++ b/file\n@@ -0,0 +1,2 @@\n+one\n+two',
      'diff --git a/f b/f\nindex abc..def 100644\n--- a/f\n+++ /dev/null\n@@ -1 +0,0 @@\n-old\n\\ No newline at end of file'])
      expect(submittedDiff(diff)).toBe(diff);
  });
  it('rejects empty, malformed, control-bearing, truncated and over-limit patches', () => {
    for (const diff of ['', ' ', '+ arbitrary text', '@@ -1 +1 @@\n-old\n+new',
      '--- a/f\n+++ b/f\n@@ -1 +1 @@\n old', '--- a/f\n+++ b/f\n@@ -1,2 +1 @@\n-old\n+new',
      content.diffText + '\u001b[31m', content.diffText + 'x'.repeat(100000)]) expect(() => submittedDiff(diff)).toThrow();
  });
});
