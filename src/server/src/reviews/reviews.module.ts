import { Module, type DynamicModule } from '@nestjs/common';
import type { ServerConfig } from '../config';
import { DatabaseModule } from '../database/database.module';
import { ActivityModule } from '../activity/activity.module';
import { ProposalsModule } from '../proposals/proposals.module';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

// Reviewer intake, human assessment, immutable findings and decisions.
@Module({})
export class ReviewsModule {
  static register(config: ServerConfig): DynamicModule {
    return { module: ReviewsModule, imports: [DatabaseModule.register(config), ProposalsModule, ActivityModule],
      controllers: [ReviewsController], providers: [ReviewsService], exports: [ReviewsService] };
  }
}
