import { Module } from '@nestjs/common';
import { ActivityService } from './activity.service';

// Append-only business activity; callers supply the mutation transaction.
@Module({ providers: [ActivityService], exports: [ActivityService] })
export class ActivityModule {}
