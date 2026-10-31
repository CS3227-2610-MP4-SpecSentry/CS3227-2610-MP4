import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UnprocessableEntityException } from '@nestjs/common';
import { acknowledgeNotificationRequestSchema, notificationsQuerySchema, reviewerIdSchema } from '@specsentry/shared';
import { DatabaseService } from '../database/database.service';
import { Roles, type AuthRequest } from '../identity/access';
import { businessActor } from '../identity/business-context';
import { validate } from '../reviews/reviewer-context';
import { NotificationsService } from './notifications.service';

@Roles('REVIEWER', 'RELEASE_MAINTAINER')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService, private readonly database: DatabaseService) {}

  private async parsed<T>(request: AuthRequest, parse: () => T): Promise<T> {
    try { return parse(); }
    catch (error) {
      if (!(error instanceof UnprocessableEntityException)) throw error;
      await this.database.client.securityEvent.create({ data: { actorId: request.account!.id,
        action: 'NOTIFICATION_VALIDATION_REJECTED', target: 'notifications', outcome: 'rejected',
        correlationId: request.res?.getHeader('x-request-id')?.toString() } });
      throw error;
    }
  }

  @Get()
  async list(@Req() request: AuthRequest, @Query() query: unknown) {
    const input = await this.parsed(request, () => validate(notificationsQuerySchema, query));
    return this.notifications.list(businessActor(request), input);
  }

  @Post(':id/acknowledge')
  @HttpCode(200)
  async acknowledge(@Req() request: AuthRequest, @Param('id') id: string, @Body() body: unknown, @Query() query: unknown) {
    const input = await this.parsed(request, () => {
      // No acknowledgement options are accepted in the URL.
      validate(notificationsQuerySchema.pick({}).strict(), query);
      return { id: validate(reviewerIdSchema, id), body: validate(acknowledgeNotificationRequestSchema, body) };
    });
    return this.notifications.acknowledge(businessActor(request), input.id, input.body);
  }
}
