import { UnprocessableEntityException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { workingContentSchema, type WorkingContent } from '@specsentry/shared';

type IdSource = { criteria: { stableKey?: string; statement: string }[]; evidence: { id?: string; text: string }[] };

// IDs from an editable draft are references, never a client-controlled namespace.
// Equality is deliberately conservative: even a small statement edit rotates its key.
export function prepareWorkingContent(input: WorkingContent, sources: IdSource[] = []): WorkingContent {
  const content = workingContentSchema.parse(input);
  const criteria = new Map(sources.flatMap(source => source.criteria.flatMap(c => c.stableKey ? [[c.stableKey, c.statement] as const] : [])));
  const evidence = new Set(sources.flatMap(source => source.evidence.flatMap(e => e.id ? [e.id] : [])));
  return { ...content,
    criteria: content.criteria.map(c => {
      if (c.stableKey && !criteria.has(c.stableKey)) throw new UnprocessableEntityException();
      return { ...c, stableKey: c.stableKey && criteria.get(c.stableKey) === c.statement ? c.stableKey : randomUUID() };
    }),
    evidence: content.evidence.map(e => {
      if (e.id && !evidence.has(e.id)) throw new UnprocessableEntityException();
      return { ...e, id: e.id ?? randomUUID() };
    }),
  };
}

