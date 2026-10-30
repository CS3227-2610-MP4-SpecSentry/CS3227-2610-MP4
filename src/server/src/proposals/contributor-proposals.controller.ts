import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req, UnprocessableEntityException } from '@nestjs/common';
import { createProposalRequestSchema, deleteDraftRequestSchema, ownDraftsQuerySchema, reviewerIdSchema, saveDraftRequestSchema } from '@specsentry/shared';
import { DatabaseService } from '../database/database.service';
import { Roles, type AuthRequest } from '../identity/access';
import { businessActor } from '../identity/business-context';
import { validate } from '../reviews/reviewer-context';
import { ProposalLifecycleService } from './proposal-lifecycle.service';

@Roles('CONTRIBUTOR')
@Controller('proposals')
export class ContributorProposalsController {
  constructor(private readonly lifecycle: ProposalLifecycleService, private readonly database: DatabaseService) {}

  private async parsed<T>(request: AuthRequest, operation: string, parse: () => T): Promise<T> {
    try { return parse(); }
    catch (error) {
      if (!(error instanceof UnprocessableEntityException)) throw error;
      await this.database.client.securityEvent.create({ data: { actorId: request.account!.id,
        action: `PROPOSAL_${operation}_VALIDATION_REJECTED`, target: 'proposal-drafts', outcome: 'rejected',
        correlationId: request.res?.getHeader('x-request-id')?.toString() } });
      throw error;
    }
  }

  @Post()
  async create(@Req() request: AuthRequest, @Body() body: unknown) {
    const input = await this.parsed(request, 'CREATE', () => validate(createProposalRequestSchema, body));
    return this.lifecycle.create(businessActor(request), input);
  }

  @Get()
  async list(@Req() request: AuthRequest, @Query() query: unknown) {
    const input = await this.parsed(request, 'LIST', () => validate(ownDraftsQuerySchema, query));
    return this.lifecycle.list(businessActor(request), input);
  }

  @Get(':id/draft')
  async draft(@Req() request: AuthRequest, @Param('id') id: string) {
    const input = await this.parsed(request, 'DRAFT', () => validate(reviewerIdSchema, id));
    return this.lifecycle.draft(businessActor(request), input);
  }

  @Patch(':id/draft')
  async save(@Req() request: AuthRequest, @Param('id') id: string, @Body() body: unknown) {
    const input = await this.parsed(request, 'SAVE', () => ({ id: validate(reviewerIdSchema, id), body: validate(saveDraftRequestSchema, body) }));
    return this.lifecycle.save(businessActor(request), input.id, input.body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Req() request: AuthRequest, @Param('id') id: string, @Body() body: unknown) {
    const input = await this.parsed(request, 'DELETE', () => ({ id: validate(reviewerIdSchema, id), body: validate(deleteDraftRequestSchema, body) }));
    await this.lifecycle.remove(businessActor(request), input.id, input.body);
  }
}
