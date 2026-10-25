import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UnprocessableEntityException } from '@nestjs/common';
import { assignedReviewsQuerySchema, claimProposalRequestSchema, dropProposalRequestSchema, proposalActivityQuerySchema,
  proposalDetailQuerySchema, reviewerIdSchema, reviewPoolQuerySchema, submittedRevisionsQuerySchema } from '@specsentry/shared';
import { Roles, type AuthRequest } from '../identity/access';
import { DatabaseService } from '../database/database.service';
import { validate, type ReviewerActor } from './reviewer-context';
import { ReviewsService } from './reviews.service';

const actor = (request: AuthRequest): ReviewerActor => ({ accountId: request.account!.id,
  accountVersion: request.session.accountVersion!, correlationId: request.res?.getHeader('x-request-id')?.toString() });

const validationTargets = {
  POOL: 'review-pool', ASSIGNED: 'assigned-reviews', CLAIM: 'proposal-claim', DROP: 'proposal-drop',
  DETAIL: 'proposal-detail', REVISIONS: 'proposal-revisions', ACTIVITY: 'proposal-activity',
} as const;

@Roles('REVIEWER')
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService, private readonly database: DatabaseService) {}

  // IdentityGuard has already enforced session, role and CSRF. Catch only the
  // synchronous controller parse: service authorization failures audit themselves.
  private async parsed<T>(request: AuthRequest, operation: keyof typeof validationTargets, parse: () => T): Promise<T> {
    try { return parse(); }
    catch (error) {
      if (!(error instanceof UnprocessableEntityException)) throw error;
      await this.database.client.securityEvent.create({ data: { actorId: request.account!.id,
        action: `REVIEW_${operation}_VALIDATION_REJECTED`, target: validationTargets[operation], outcome: 'rejected',
        correlationId: request.res?.getHeader('x-request-id')?.toString() } });
      throw error;
    }
  }
  @Get('review-pool')
  async pool(@Req() request: AuthRequest, @Query() query: unknown) {
    const input = await this.parsed(request, 'POOL', () => validate(reviewPoolQuerySchema, query));
    return this.reviews.queue(actor(request), input);
  }
  @Get('reviews/assignments')
  async assigned(@Req() request: AuthRequest, @Query() query: unknown) {
    const input = await this.parsed(request, 'ASSIGNED', () => validate(assignedReviewsQuerySchema, query));
    return this.reviews.queue(actor(request), input, true);
  }
  @Post('proposals/:id/claim')
  @HttpCode(200)
  async claim(@Req() request: AuthRequest, @Param('id') id: string, @Body() body: unknown) {
    const input = await this.parsed(request, 'CLAIM', () => ({ id: validate(reviewerIdSchema, id), body: validate(claimProposalRequestSchema, body) }));
    return this.reviews.claim(actor(request), input.id, input.body);
  }
  @Post('proposals/:id/drop')
  @HttpCode(200)
  async drop(@Req() request: AuthRequest, @Param('id') id: string, @Body() body: unknown) {
    const input = await this.parsed(request, 'DROP', () => ({ id: validate(reviewerIdSchema, id), body: validate(dropProposalRequestSchema, body) }));
    return this.reviews.drop(actor(request), input.id, input.body);
  }
  @Get('proposals/:id')
  async detail(@Req() request: AuthRequest, @Param('id') id: string, @Query() query: unknown) {
    const input = await this.parsed(request, 'DETAIL', () => ({ id: validate(reviewerIdSchema, id), query: validate(proposalDetailQuerySchema, query) }));
    return this.reviews.detail(actor(request), input.id, input.query.revisionId);
  }
  @Get('proposals/:id/revisions')
  async revisions(@Req() request: AuthRequest, @Param('id') id: string, @Query() query: unknown) {
    const input = await this.parsed(request, 'REVISIONS', () => ({ id: validate(reviewerIdSchema, id), query: validate(submittedRevisionsQuerySchema, query) }));
    return this.reviews.revisions(actor(request), input.id, input.query);
  }
  @Get('proposals/:id/activity')
  async activity(@Req() request: AuthRequest, @Param('id') id: string, @Query() query: unknown) {
    const input = await this.parsed(request, 'ACTIVITY', () => ({ id: validate(reviewerIdSchema, id), query: validate(proposalActivityQuerySchema, query) }));
    return this.reviews.timeline(actor(request), input.id, input.query.cursor);
  }
}
