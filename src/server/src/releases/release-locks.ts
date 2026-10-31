import { ConflictException, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';

export const RELEASE_PROJECT_KEY = 'specsentry';

// Call only after lockBusinessContext has locked all relevant accounts and the actor session.
// Resolve opaque pointers first, then re-read them under these locks before use.
const sortedIds = (ids: readonly string[]) => [...new Set(ids)].sort();

export async function lockReleaseCandidates(tx: Prisma.TransactionClient, ids: readonly string[]) {
  const rows: { id: string; createdById: string; status: string; version: number; contentVersion: number }[] = [];
  for (const id of sortedIds(ids)) {
    const found = await tx.$queryRaw<typeof rows>`SELECT "id","createdById","status","version","contentVersion"
      FROM "ReleaseCandidate" WHERE "id"=${id} FOR UPDATE`;
    if (!found[0]) throw new NotFoundException();
    rows.push(found[0]);
  }
  return rows;
}

export async function lockReleaseProposals(tx: Prisma.TransactionClient, ids: readonly string[]) {
  const rows: { id: string; state: string; version: number; currentRevisionId: string | null;
    currentAssignmentId: string | null; releaseAttachmentRef: string | null }[] = [];
  for (const id of sortedIds(ids)) {
    const found = await tx.$queryRaw<typeof rows>`SELECT "id","state","version","currentRevisionId",
      "currentAssignmentId","releaseAttachmentRef" FROM "ChangeProposal" WHERE "id"=${id} FOR UPDATE`;
    if (!found[0]) throw new NotFoundException();
    rows.push(found[0]);
  }
  return rows;
}

// The caller must have locked the candidate before inspecting its member set.
export async function lockCandidateMemberProposals(tx: Prisma.TransactionClient, candidateId: string) {
  const members = await tx.releaseCandidateMember.findMany({ where: { candidateId, status: 'ATTACHED' },
    select: { id: true, proposalId: true }, orderBy: [{ proposalId: 'asc' }, { id: 'asc' }] });
  await lockReleaseProposals(tx, members.map(member => member.proposalId));
  const current = await tx.releaseCandidateMember.findMany({ where: { candidateId, status: 'ATTACHED' },
    select: { id: true, proposalId: true }, orderBy: [{ proposalId: 'asc' }, { id: 'asc' }] });
  if (JSON.stringify(members) !== JSON.stringify(current)) throw new ConflictException('Candidate membership changed');
  return members;
}
