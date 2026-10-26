import { Module, type DynamicModule } from '@nestjs/common';
import type { ServerConfig } from '../config';
import { DatabaseModule } from '../database/database.module';
import { ActivityModule } from '../activity/activity.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProposalsCoreModule } from './proposals-core.module';
import { ContributorProposalsController } from './contributor-proposals.controller';
import { ProposalLifecycleService } from './proposal-lifecycle.service';

@Module({})
export class ProposalsModule {
  static register(config: ServerConfig): DynamicModule {
    return { module: ProposalsModule,
      imports: [DatabaseModule.register(config), ActivityModule, ProposalsCoreModule, NotificationsModule.register(config)],
      controllers: [ContributorProposalsController], providers: [ProposalLifecycleService], exports: [ProposalLifecycleService] };
  }
}
