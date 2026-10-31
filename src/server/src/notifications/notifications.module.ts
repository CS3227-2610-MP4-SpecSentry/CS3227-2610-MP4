import { Module, type DynamicModule } from '@nestjs/common';
import type { ServerConfig } from '../config';
import { DatabaseModule } from '../database/database.module';
import { ActivityModule } from '../activity/activity.module';
import { ProposalsCoreModule } from '../proposals/proposals-core.module';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

@Module({})
export class NotificationsModule {
  static register(config: ServerConfig): DynamicModule {
    return { module: NotificationsModule,
      imports: [DatabaseModule.register(config), ActivityModule, ProposalsCoreModule],
      controllers: [NotificationsController], providers: [NotificationsService], exports: [NotificationsService] };
  }
}
