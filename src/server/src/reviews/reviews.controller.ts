import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req, UnprocessableEntityException } from '@nestjs/common';
import { assignedReviewsQuerySchema, claimProposalRequestSchema, dropProposalRequestSchema, proposalActivityQuerySchema,
  proposalDetailQuerySchema, reviewerIdSchema, reviewPoolQuerySchema, submittedRevisionsQuerySchema } from '@specsentry/shared';
import { coverageHistoryQuerySchema, coverageWriteRequestSchema, createFindingRequestSchema, findingAmendmentRequestSchema,
  findingTransitionRequestSchema, humanReviewPageQuerySchema, humanReviewQuerySchema, reviewDecisionRequestSchema,
  reviewIdempotencyKeySchema } from '@specsentry/shared';
import { Roles, type AuthRequest } from '../identity/access';
import { DatabaseService } from '../database/database.service';
import { validate, type ReviewerActor } from './reviewer-context';
import { ReviewsService } from './reviews.service';
import { businessActor } from '../identity/business-context';

const actor = (request: AuthRequest): ReviewerActor => businessActor(request);

const validationTargets = {
  POOL: 'review-pool', ASSIGNED: 'assigned-reviews', CLAIM: 'proposal-claim', DROP: 'proposal-drop',
  DETAIL: 'proposal-detail', REVISIONS: 'proposal-revisions', ACTIVITY: 'proposal-activity',
  HUMAN: 'human-review', COVERAGE: 'review-coverage', FINDING: 'review-finding', DECISION: 'review-decision',
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
  @Roles('REVIEWER', 'CONTRIBUTOR', 'RELEASE_MAINTAINER')
  @Get('proposals/:id')
  async detail(@Req() request: AuthRequest, @Param('id') id: string, @Query() query: unknown) {
    const input = await this.parsed(request, 'DETAIL', () => ({ id: validate(reviewerIdSchema, id), query: validate(proposalDetailQuerySchema, query) }));
    return this.reviews.detail(actor(request), input.id, input.query.revisionId);
  }
  @Roles('REVIEWER', 'CONTRIBUTOR', 'RELEASE_MAINTAINER')
  @Get('proposals/:id/revisions')
  async revisions(@Req() request: AuthRequest, @Param('id') id: string, @Query() query: unknown) {
    const input = await this.parsed(request, 'REVISIONS', () => ({ id: validate(reviewerIdSchema, id), query: validate(submittedRevisionsQuerySchema, query) }));
    return this.reviews.revisions(actor(request), input.id, input.query);
  }
  @Roles('REVIEWER', 'CONTRIBUTOR', 'RELEASE_MAINTAINER')
  @Get('proposals/:id/activity')
  async activity(@Req() request: AuthRequest, @Param('id') id: string, @Query() query: unknown) {
    const input = await this.parsed(request, 'ACTIVITY', () => ({ id: validate(reviewerIdSchema, id), query: validate(proposalActivityQuerySchema, query) }));
    return this.reviews.timeline(actor(request), input.id, input.query.cursor);
  }
  @Get('proposals/:id/review')
  async review(@Req() request: AuthRequest, @Param('id') id: string, @Query() query: unknown) {
    const input = await this.parsed(request, 'HUMAN', () => ({ id: validate(reviewerIdSchema, id), query: validate(humanReviewQuerySchema, query) }));
    return this.reviews.review(actor(request), input.id, input.query);
  }
  @Roles('REVIEWER', 'CONTRIBUTOR', 'RELEASE_MAINTAINER')
  @Get('proposals/:id/findings')
  async findings(@Req() request: AuthRequest, @Param('id') id: string, @Query() query: unknown) {
    const input = await this.parsed(request, 'HUMAN', () => ({ id: validate(reviewerIdSchema, id), query: validate(humanReviewPageQuerySchema, query) }));
    return this.reviews.findings(actor(request), input.id, input.query);
  }
  @Roles('REVIEWER', 'CONTRIBUTOR', 'RELEASE_MAINTAINER')
  @Get('proposals/:id/decisions')
  async decisions(@Req() request: AuthRequest, @Param('id') id: string, @Query() query: unknown) {
    const input = await this.parsed(request, 'HUMAN', () => ({ id: validate(reviewerIdSchema, id), query: validate(humanReviewPageQuerySchema, query) }));
    return this.reviews.decisions(actor(request), input.id, input.query);
  }
  @Roles('REVIEWER', 'CONTRIBUTOR', 'RELEASE_MAINTAINER')
  @Get('proposals/:id/coverage-history')
  async coverageHistory(@Req() request: AuthRequest, @Param('id') id: string, @Query() query: unknown) {
    const input = await this.parsed(request, 'HUMAN', () => ({ id: validate(reviewerIdSchema, id), query: validate(coverageHistoryQuerySchema, query) }));
    return this.reviews.coverageHistory(actor(request), input.id, input.query);
  }
  @Roles('REVIEWER', 'CONTRIBUTOR', 'RELEASE_MAINTAINER')
  @Get('proposals/:proposalId/findings/:id/history')
  async findingHistory(@Req() request: AuthRequest, @Param('proposalId') proposalId: string, @Param('id') id: string, @Query() query: unknown) {
    const input = await this.parsed(request, 'HUMAN', () => ({ proposalId: validate(reviewerIdSchema, proposalId), id: validate(reviewerIdSchema, id), query: validate(humanReviewPageQuerySchema, query) }));
    return this.reviews.findingHistory(actor(request), input.proposalId, input.id, input.query);
  }
  @Put('proposals/:id/coverage/:criterionId')
  async coverage(@Req() request: AuthRequest, @Param('id') id: string, @Param('criterionId') criterionId: string, @Body() body: unknown) {
    const input = await this.parsed(request, 'COVERAGE', () => ({ id: validate(reviewerIdSchema, id), criterionId: validate(reviewerIdSchema, criterionId), body: validate(coverageWriteRequestSchema, body) }));
    return this.reviews.coverage(actor(request), input.id, input.criterionId, input.body);
  }
  @Post('proposals/:id/findings')
  @HttpCode(201)
  async createFinding(@Req() request: AuthRequest, @Param('id') id: string, @Body() body: unknown) {
    const input = await this.parsed(request, 'FINDING', () => ({ id: validate(reviewerIdSchema, id), body: validate(createFindingRequestSchema, body) }));
    return this.reviews.createFinding(actor(request), input.id, input.body);
  }
  @Post('findings/:id/transitions')
  @HttpCode(200)
  async transition(@Req() request: AuthRequest, @Param('id') id: string, @Body() body: unknown) {
    const input = await this.parsed(request, 'FINDING', () => ({ id: validate(reviewerIdSchema, id), body: validate(findingTransitionRequestSchema, body) }));
    return this.reviews.transitionFinding(actor(request), input.id, input.body);
  }
  @Post('findings/:id/amendments')
  @HttpCode(200)
  async amend(@Req() request: AuthRequest, @Param('id') id: string, @Body() body: unknown) {
    const input = await this.parsed(request, 'FINDING', () => ({ id: validate(reviewerIdSchema, id), body: validate(findingAmendmentRequestSchema, body) }));
    return this.reviews.amendFinding(actor(request), input.id, input.body);
  }
  @Post('proposals/:id/decision')
  @HttpCode(200)
  async decide(@Req() request: AuthRequest, @Param('id') id: string, @Body() body: unknown) {
    const input = await this.parsed(request, 'DECISION', () => ({ id: validate(reviewerIdSchema, id), body: validate(reviewDecisionRequestSchema, body),
      key: validate(reviewIdempotencyKeySchema, request.headers['idempotency-key']) }));
    return this.reviews.decide(actor(request), input.id, input.body, input.key);
  }
}
