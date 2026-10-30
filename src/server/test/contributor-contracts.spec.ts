import { createProposalRequestSchema, deleteDraftRequestSchema, ownDraftsQuerySchema } from '@specsentry/shared';

const content = { title: 'Title', problem: 'Problem', constraints: '', expectedBehavior: 'Expected',
  summary: '', diffText: '', criteria: [], evidence: [] };

describe('Contributor draft contracts', () => {
  it('bounds and normalizes preparation text without requiring a complete submission', () => {
    expect(createProposalRequestSchema.parse(content)).toEqual(content);
    for (const [field, limit] of [['summary', 500], ['diffText', 100000]] as const) {
      expect(createProposalRequestSchema.parse({ ...content, [field]: '\u{1F600}'.repeat(limit) })[field]).toBe('\u{1F600}'.repeat(limit));
      expect(createProposalRequestSchema.safeParse({ ...content, [field]: '\u{1F600}'.repeat(limit + 1) }).success).toBe(false);
      expect(createProposalRequestSchema.parse({ ...content, [field]: 'x\r\ny\rz' })[field]).toBe('x\ny\nz');
    }
    const evidence = [{ text: '\u{1F600}'.repeat(25000) }, { text: 'x\r\n'.repeat(12500) }];
    expect(createProposalRequestSchema.parse({ ...content, evidence }).evidence[1]!.text).toBe('x\n'.repeat(12500));
    expect(createProposalRequestSchema.safeParse({ ...content, evidence: [{ text: 'x'.repeat(50000) }] }).success).toBe(true);
    for (const entries of [[{ text: 'x'.repeat(50001) }], [{ text: 'x'.repeat(25000) }, { text: 'y'.repeat(25001) }], [{ text: '' }], [{ text: ' \n ' }]])
      expect(createProposalRequestSchema.safeParse({ ...content, evidence: entries }).success).toBe(false);
    expect(createProposalRequestSchema.parse({ ...content, diffText: 'incomplete patch', evidence: [] }).diffText).toBe('incomplete patch');
  });
  it('defaults criterion classification and permits incomplete collections with bounded nonempty entries', () => {
    const criterion = { statement: 'Accept this' };
    expect(createProposalRequestSchema.parse({ ...content, criteria: [criterion] }).criteria[0]!.required).toBe(true);
    expect(createProposalRequestSchema.safeParse({ ...content, criteria: [{ ...criterion, required: false }] }).success).toBe(true);
    expect(createProposalRequestSchema.safeParse({ ...content, criteria: [] }).success).toBe(true);
    expect(createProposalRequestSchema.safeParse({ ...content, criteria: Array.from({ length: 50 }, () => criterion) }).success).toBe(true);
    expect(createProposalRequestSchema.safeParse({ ...content, criteria: Array.from({ length: 51 }, () => criterion) }).success).toBe(false);
    for (const statement of ['\u{1F600}'.repeat(2000), 'x\r\n'.repeat(1000)]) expect(createProposalRequestSchema.safeParse({ ...content, criteria: [{ statement }] }).success).toBe(true);
    for (const statement of ['', ' \n ', '\u{1F600}'.repeat(2001)]) expect(createProposalRequestSchema.safeParse({ ...content, criteria: [{ statement }] }).success).toBe(false);
  });

  it('requires literal deletion confirmation and bounded version without a reason or client identity', () => {
    for (const expectedVersion of [0, 2147483647]) expect(deleteDraftRequestSchema.parse({ expectedVersion, confirmed: true })).toEqual({ expectedVersion, confirmed: true });
    for (const body of [{ confirmed: true }, { expectedVersion: 0 }, { expectedVersion: 0, confirmed: false },
      { expectedVersion: 0, confirmed: 'true' }, { expectedVersion: 2147483648, confirmed: true },
      { expectedVersion: 0, confirmed: true, reason: 'Withdrawal is separate' }, { expectedVersion: 0, confirmed: true, actorId: 'forged' }])
      expect(deleteDraftRequestSchema.safeParse(body).success).toBe(false);
  });
  it('accepts empty later-increment fields and constraints but rejects injected ownership', () => {
    expect(createProposalRequestSchema.safeParse(content).success).toBe(true);
    for (const field of ['ownerId', 'actorId', 'state', 'createdAt'])
      expect(createProposalRequestSchema.safeParse({ ...content, [field]: 'forged' }).success).toBe(false);
  });
  it('counts Unicode code points after newline normalization and enforces each boundary', () => {
    expect(createProposalRequestSchema.parse({ ...content, title: '😀'.repeat(200), problem: 'x\r\n'.repeat(5000) }).problem).toHaveLength(10000);
    expect(createProposalRequestSchema.safeParse({ ...content, title: '😀'.repeat(201) }).success).toBe(false);
    for (const field of ['problem', 'constraints', 'expectedBehavior']) {
      expect(createProposalRequestSchema.safeParse({ ...content, [field]: '😀'.repeat(10000) }).success).toBe(true);
      expect(createProposalRequestSchema.safeParse({ ...content, [field]: '😀'.repeat(10001) }).success).toBe(false);
    }
    for (const field of ['title', 'problem', 'expectedBehavior'])
      expect(createProposalRequestSchema.safeParse({ ...content, [field]: ' \n ' }).success).toBe(false);
  });
  it('bounds private lists and rejects extra or malformed query fields', () => {
    expect(ownDraftsQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(ownDraftsQuerySchema.parse({ limit: '100' })).toEqual({ limit: 100 });
    for (const limit of ['0', '101', '-1', '2.5', '01', '1e2']) expect(ownDraftsQuerySchema.safeParse({ limit }).success).toBe(false);
    expect(ownDraftsQuerySchema.safeParse({ ownerId: 'other' }).success).toBe(false);
  });
});
