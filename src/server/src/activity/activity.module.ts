import { Module } from '@nestjs/common';
import { ActivityService } from './activity.service';

// Registration only; append-only audit storage and authorized projections follow.
@Module({ providers: [ActivityService], exports: [ActivityService] })
export class ActivityModule {}
