import { Body, Controller, Get, Headers, HttpCode, Param, Post, Put, Query, Req } from '@nestjs/common';
import { addReleaseMemberRequestSchema, appendReleaseAnnotationRequestSchema, appendReleaseSmokeTestRequestSchema,
  createReleaseCandidateRequestSchema, eligibleReleaseProposalsQuerySchema, publishReleaseCandidateRequestSchema,
  releaseAnnotationsQuerySchema, releaseCandidatesQuerySchema, releaseSmokeTestsQuerySchema, removeReleaseMemberRequestSchema,
  reviewerIdSchema, reviewIdempotencyKeySchema, updateReleaseCandidateRequestSchema } from '@specsentry/shared';
import { Roles, type AuthRequest } from '../identity/access';
import { businessActor } from '../identity/business-context';
import { validate } from '../reviews/reviewer-context';
import { ReleasesService } from './releases.service';

@Roles('RELEASE_MAINTAINER')
@Controller('release-candidates')
export class ReleasesController {
  constructor(private readonly releases: ReleasesService) {}

  @Post() create(@Req() req: AuthRequest, @Body() body: unknown) {
    return this.releases.create(businessActor(req), validate(createReleaseCandidateRequestSchema, body));
  }
  @Get() list(@Req() req: AuthRequest, @Query() query: unknown) {
    return this.releases.list(businessActor(req), validate(releaseCandidatesQuerySchema, query));
  }
  @Get(':id/eligible-proposals')
  eligible(@Req() req: AuthRequest, @Param('id') id: string, @Query() query: unknown) {
    return this.releases.eligible(businessActor(req), validate(reviewerIdSchema, id),
      validate(eligibleReleaseProposalsQuerySchema, query));
  }
  @Get(':id/annotations')
  annotations(@Req() req: AuthRequest, @Param('id') id: string, @Query() query: unknown) {
    return this.releases.annotations(businessActor(req), validate(reviewerIdSchema, id),
      validate(releaseAnnotationsQuerySchema, query));
  }
  @Get(':id/smoke-tests')
  smokeHistory(@Req() req: AuthRequest, @Param('id') id: string, @Query() query: unknown) {
    return this.releases.smokeHistory(businessActor(req), validate(reviewerIdSchema, id),
      validate(releaseSmokeTestsQuerySchema, query));
  }
  @Post(':id/annotations') @HttpCode(200)
  annotate(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.releases.annotate(businessActor(req), validate(reviewerIdSchema, id),
      validate(appendReleaseAnnotationRequestSchema, body));
  }
  @Roles('RELEASE_MAINTAINER', 'REVIEWER')
  @Get(':id') detail(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.releases.detail(businessActor(req), validate(reviewerIdSchema, id));
  }
  @Put(':id') edit(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.releases.edit(businessActor(req), validate(reviewerIdSchema, id), validate(updateReleaseCandidateRequestSchema, body));
  }
  @Post(':id/members') @HttpCode(200)
  add(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.releases.add(businessActor(req), validate(reviewerIdSchema, id), validate(addReleaseMemberRequestSchema, body));
  }
  @Post(':id/members/remove') @HttpCode(200)
  remove(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.releases.remove(businessActor(req), validate(reviewerIdSchema, id), validate(removeReleaseMemberRequestSchema, body));
  }
  @Post(':id/smoke-tests') @HttpCode(200)
  smoke(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.releases.smoke(businessActor(req), validate(reviewerIdSchema, id), validate(appendReleaseSmokeTestRequestSchema, body));
  }
  @Post(':id/publish') @HttpCode(200)
  publish(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: unknown,
    @Headers('idempotency-key') key: string | undefined) {
    return this.releases.publish(businessActor(req), validate(reviewerIdSchema, id),
      validate(publishReleaseCandidateRequestSchema, body), validate(reviewIdempotencyKeySchema, key));
  }
}
