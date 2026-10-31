import { UnprocessableEntityException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { workingContentSchema, type WorkingContent } from '@specsentry/shared';

type IdSource = { criteria: { stableKey?: string; statement: string }[]; evidence: { id?: string; text: string }[] };

// IDs from an editable draft are references, never a client-controlled namespace.
// Retaining an issued key is the owner's explicit unchanged-meaning assertion.
export function prepareWorkingContent(input: WorkingContent, sources: IdSource[] = []): WorkingContent {
  const content = workingContentSchema.parse(input);
  const criteria = new Map(sources.flatMap(source => source.criteria.flatMap(c => c.stableKey ? [[c.stableKey, c.statement] as const] : [])));
  const evidence = new Set(sources.flatMap(source => source.evidence.flatMap(e => e.id ? [e.id] : [])));
  return { ...content,
    criteria: content.criteria.map(c => {
      if (c.stableKey && !criteria.has(c.stableKey)) throw new UnprocessableEntityException();
      return { ...c, stableKey: c.stableKey ?? randomUUID() };
    }),
    evidence: content.evidence.map(e => {
      if (e.id && !evidence.has(e.id)) throw new UnprocessableEntityException();
      return { ...e, id: e.id ?? randomUUID() };
    }),
  };
}

// Text is displayed as text throughout the application. Reject terminal/control
// sequences instead of transforming them into a different submitted patch.
export function submittedDiff(value: string): string {
  const diff = value.replace(/\r\n?/g, '\n');
  const points = Array.from(diff);
  const hasControl = points.some(char => { const code = char.codePointAt(0)!; return (code < 32 && code !== 9 && code !== 10) || (code >= 127 && code <= 159); });
  if (!diff.trim() || points.length > 100000 || hasControl)
    throw new UnprocessableEntityException();
  const lines = diff.split('\n');
  if (lines.at(-1) === '') lines.pop();
  let header = false; let hunks = 0; let changes = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.startsWith('--- ') && lines[i + 1]?.startsWith('+++ ')) { header = true; i++; continue; }
    const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(?:.*)$/.exec(line);
    if (match) {
      if (!header) throw new UnprocessableEntityException();
      let old = Number(match[2] ?? 1); let added = Number(match[4] ?? 1);
      if (![Number(match[1]), Number(match[3]), old, added].every(Number.isSafeInteger)) throw new UnprocessableEntityException();
      hunks++;
      while (old > 0 || added > 0) {
        const entry = lines[++i];
        if (entry === '\\ No newline at end of file') continue;
        if (entry?.startsWith(' ')) { old--; added--; }
        else if (entry?.startsWith('-')) { old--; changes++; }
        else if (entry?.startsWith('+')) { added--; changes++; }
        else throw new UnprocessableEntityException();
        if (old < 0 || added < 0) throw new UnprocessableEntityException();
      }
      continue;
    }
    if (line === '\\ No newline at end of file') continue;
    if (/^(diff --git |index |new file mode |deleted file mode |old mode |new mode |similarity index |dissimilarity index |rename from |rename to |copy from |copy to )/.test(line)) {
      if (line.startsWith('diff --git ')) header = false;
      continue;
    }
    throw new UnprocessableEntityException();
  }
  if (!hunks || !changes) throw new UnprocessableEntityException();
  return diff;
}
