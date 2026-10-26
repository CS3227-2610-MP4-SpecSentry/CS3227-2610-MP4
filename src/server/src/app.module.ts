import { Module, type DynamicModule } from '@nestjs/common';
import type { ServerConfig } from './config';
import { DatabaseModule } from './database/database.module';
import { IdentityModule } from './identity/identity.module';
import { ProposalsModule } from './proposals/proposals.module';
import { ReviewsModule } from './reviews/reviews.module';
import { ReleasesModule } from './releases/releases.module';
import { ActivityModule } from './activity/activity.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AiModule } from './ai/ai.module';
import { HealthController } from './health/health.controller';

@Module({})
export class AppModule {
  static register(config: ServerConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [
        DatabaseModule.register(config),
        IdentityModule.register(config),
        ProposalsModule.register(config),
        ReviewsModule.register(config),
        ReleasesModule,
        ActivityModule,
        NotificationsModule.register(config),
        AiModule,
      ],
      controllers: [HealthController],
    };
  }
}
