import { Module, type DynamicModule } from '@nestjs/common';
import type { ServerConfig } from '../config';
import { DatabaseModule } from '../database/database.module';
import { ActivityModule } from '../activity/activity.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReleasesController } from './releases.controller';
import { ReleasesService } from './releases.service';

@Module({})
export class ReleasesModule {
  static register(config: ServerConfig): DynamicModule {
    return { module: ReleasesModule,
      imports: [DatabaseModule.register(config), ActivityModule, NotificationsModule.register(config)],
      controllers: [ReleasesController], providers: [ReleasesService], exports: [ReleasesService] };
  }
}
