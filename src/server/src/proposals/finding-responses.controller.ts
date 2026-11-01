import { Body, Controller, Get, Param, Post, Query, Req, UnprocessableEntityException } from '@nestjs/common';
import { findingResponseRequestSchema, ownProposalsQuerySchema, reviewerIdSchema } from '@specsentry/shared';
import { DatabaseService } from '../database/database.service';
import { Roles, type AuthRequest } from '../identity/access';
import { businessActor } from '../identity/business-context';
import { validate } from '../reviews/reviewer-context';
import { FindingResponsesService } from './finding-responses.service';

@Controller()
export class FindingResponsesController {
  constructor(private readonly responses: FindingResponsesService, private readonly database: DatabaseService) {}

  private async parsed<T>(request: AuthRequest, parse: () => T): Promise<T> {
    try { return parse(); }
    catch (error) {
      if (!(error instanceof UnprocessableEntityException)) throw error;
      await this.database.client.securityEvent.create({ data: { actorId: request.account!.id,
        action: 'FINDING_RESPONSE_VALIDATION_REJECTED', target: 'finding-response', outcome: 'rejected',
        correlationId: request.res?.getHeader('x-request-id')?.toString() } });
      throw error;
    }
  }

  @Roles('CONTRIBUTOR')
  @Post('findings/:id/responses')
  async add(@Req() request: AuthRequest, @Param('id') id: string, @Body() body: unknown) {
    const input = await this.parsed(request, () => ({ id: validate(reviewerIdSchema, id), body: validate(findingResponseRequestSchema, body) }));
    return this.responses.add(businessActor(request), input.id, input.body);
  }

  @Roles('CONTRIBUTOR', 'REVIEWER', 'RELEASE_MAINTAINER')
  @Get('proposals/:id/responses')
  async list(@Req() request: AuthRequest, @Param('id') id: string, @Query() query: unknown) {
    const input = await this.parsed(request, () => ({ id: validate(reviewerIdSchema, id), query: validate(ownProposalsQuerySchema, query) }));
    return this.responses.list(businessActor(request), input.id, input.query);
  }
}
