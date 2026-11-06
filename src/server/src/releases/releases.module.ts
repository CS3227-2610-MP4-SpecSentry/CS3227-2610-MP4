import { Module, type DynamicModule } from '@nestjs/common';
import type { ServerConfig } from '../config';
import { DatabaseModule } from '../database/database.module';
import { ActivityModule } from '../activity/activity.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AiModule } from '../ai/ai.module';
import { MaintainerAiUsageController } from './maintainer-ai-usage.controller';
import { MaintainerAiUsageService } from './maintainer-ai-usage.service';
import { MaintainerAuditController } from './maintainer-audit.controller';
import { MaintainerAuditService } from './maintainer-audit.service';
import { ReleaseGateAssistantController } from './release-gate-assistant.controller';
import { ReleaseGateAssistantService } from './release-gate-assistant.service';
import { ReleasesController } from './releases.controller';
import { ReleasesService } from './releases.service';

@Module({})
export class ReleasesModule {
  static register(config: ServerConfig): DynamicModule {
    return { module: ReleasesModule,
      imports: [DatabaseModule.register(config), ActivityModule, NotificationsModule.register(config), AiModule.register(config)],
      controllers: [ReleasesController, ReleaseGateAssistantController, MaintainerAiUsageController,
        MaintainerAuditController],
      providers: [ReleasesService, ReleaseGateAssistantService, MaintainerAiUsageService, MaintainerAuditService],
      exports: [ReleasesService] };
  }
}
