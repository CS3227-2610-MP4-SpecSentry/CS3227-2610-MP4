import { Module, type DynamicModule } from '@nestjs/common';
import type { ServerConfig } from '../config';
import { DatabaseModule } from '../database/database.module';
import { ActivityModule } from '../activity/activity.module';
import { ProposalsCoreModule } from '../proposals/proposals-core.module';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { AiModule } from '../ai/ai.module';
import { PatchRiskService } from './patch-risk.service';
import { PatchRiskController } from './patch-risk.controller';
import { ApprovalRevocationService } from './approval-revocation.service';
import { NotificationsModule } from '../notifications/notifications.module';

// Reviewer intake, human assessment, immutable findings and decisions.
@Module({})
export class ReviewsModule {
  static register(config: ServerConfig): DynamicModule {
    return { module: ReviewsModule, imports: [DatabaseModule.register(config), ProposalsCoreModule, ActivityModule, AiModule.register(config),
      NotificationsModule.register(config)],
      controllers: [ReviewsController, PatchRiskController], providers: [ReviewsService, PatchRiskService, ApprovalRevocationService], exports: [ReviewsService] };
  }
}
