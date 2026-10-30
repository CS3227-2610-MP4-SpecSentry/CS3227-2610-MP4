import { createProposalRequestSchema, ownDraftsQuerySchema } from '@specsentry/shared';

const content = { title: 'Title', problem: 'Problem', constraints: '', expectedBehavior: 'Expected',
  summary: '', diffText: '', criteria: [], evidence: [] };

describe('Contributor draft contracts', () => {
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
