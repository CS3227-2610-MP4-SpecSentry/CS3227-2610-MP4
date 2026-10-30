import { Injectable, NotFoundException } from '@nestjs/common';
import type { ReviewTransaction } from '../reviews/reviewer-context';

export const rootSelect = {
  id: true, ownerId: true, title: true, state: true, version: true, currentRevisionId: true,
  currentAssignmentId: true, firstSubmittedAt: true, releaseAttachmentRef: true,
} as const;

@Injectable()
export class ProposalsService {
  async lockRoot(tx: ReviewTransaction, id: string) {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "ChangeProposal" WHERE "id" = ${id} FOR UPDATE`;
    if (!rows.length) throw new NotFoundException();
    return tx.changeProposal.findUniqueOrThrow({ where: { id }, select: rootSelect });
  }
}
