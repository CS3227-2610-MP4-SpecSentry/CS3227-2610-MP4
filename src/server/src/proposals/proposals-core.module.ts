import { Module } from '@nestjs/common';
import { ProposalsService } from './proposals.service';

// Shared root locking/submitted projection seam; no dependency on lifecycle or notices.
@Module({ providers: [ProposalsService], exports: [ProposalsService] })
export class ProposalsCoreModule {}
