import { Module } from '@nestjs/common';
import { ProposalsService } from './proposals.service';

// Registration only; draft and immutable revision use cases follow here.
@Module({ providers: [ProposalsService], exports: [ProposalsService] })
export class ProposalsModule {}
