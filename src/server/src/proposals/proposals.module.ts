import { Module, type DynamicModule } from '@nestjs/common';
import type { ServerConfig } from '../config';
import { DatabaseModule } from '../database/database.module';
import { ActivityModule } from '../activity/activity.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProposalsCoreModule } from './proposals-core.module';
import { ContributorProposalsController } from './contributor-proposals.controller';
import { ProposalLifecycleService } from './proposal-lifecycle.service';
import { FindingResponsesController } from './finding-responses.controller';
import { FindingResponsesService } from './finding-responses.service';
import { AiModule } from '../ai/ai.module';
import { ContributorAssistantController } from './contributor-assistant.controller';
import { ContributorAssistantService } from './contributor-assistant.service';

@Module({})
export class ProposalsModule {
  static register(config: ServerConfig): DynamicModule {
    return { module: ProposalsModule,
      imports: [DatabaseModule.register(config), ActivityModule, ProposalsCoreModule, NotificationsModule.register(config), AiModule.register(config)],
      controllers: [ContributorProposalsController, FindingResponsesController, ContributorAssistantController],
      providers: [ProposalLifecycleService, FindingResponsesService, ContributorAssistantService], exports: [ProposalLifecycleService] };
  }
}
