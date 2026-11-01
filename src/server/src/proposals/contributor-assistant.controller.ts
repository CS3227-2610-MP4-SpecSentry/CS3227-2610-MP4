import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UnprocessableEntityException } from '@nestjs/common';
import { contributorDraftRequestSchema, reviewerIdSchema } from '@specsentry/shared';
import { Roles, type AuthRequest } from '../identity/access';
import { businessActor } from '../identity/business-context';
import { validate } from '../reviews/reviewer-context';
import { ContributorAssistantService } from './contributor-assistant.service';

@Roles('CONTRIBUTOR')
@Controller()
export class ContributorAssistantController {
  constructor(private readonly assistant: ContributorAssistantService) {}

  @Post('proposals/:id/ai/draft')
  @HttpCode(200)
  async suggest(@Req() request: AuthRequest, @Param('id') id: string, @Body() body: unknown) {
    const deadline = this.assistant.deadline(); const actor = businessActor(request);
    try {
      let input: ReturnType<typeof contributorDraftRequestSchema.parse>; let target: string;
      try { target = validate(reviewerIdSchema, id); input = validate(contributorDraftRequestSchema, body); }
      catch (error) { await this.assistant.rejected(actor, 'contributor-ai-validation', deadline, error); throw error; }
      const result = await this.assistant.suggest(actor, target, input, deadline);
      deadline.assertRemaining(); return result;
    } finally { deadline.close(); }
  }

  @Get('contributor/ai/usage')
  async usage(@Req() request: AuthRequest, @Query() query: Record<string, unknown>) {
    if (Object.keys(query).length) throw new UnprocessableEntityException();
    return this.assistant.usage(businessActor(request));
  }
}
