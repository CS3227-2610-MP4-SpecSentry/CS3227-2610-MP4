import { Body, Controller, Header, HttpCode, Param, Post, Req } from '@nestjs/common';
import { maintainerGateRequestSchema, reviewerIdSchema } from '@specsentry/shared';
import { Roles, type AuthRequest } from '../identity/access';
import { businessActor } from '../identity/business-context';
import { validate } from '../reviews/reviewer-context';
import { ReleaseGateAssistantService } from './release-gate-assistant.service';

@Roles('RELEASE_MAINTAINER')
@Controller('release-candidates')
export class ReleaseGateAssistantController {
  constructor(private readonly assistant: ReleaseGateAssistantService) {}

  @Post(':id/ai/readiness')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async readiness(@Req() request: AuthRequest, @Param('id') id: string, @Body() body: unknown) {
    const deadline = this.assistant.deadline(); const actor = businessActor(request);
    try {
      let target: string; let input: ReturnType<typeof maintainerGateRequestSchema.parse>;
      try { target = validate(reviewerIdSchema, id); input = validate(maintainerGateRequestSchema, body); }
      catch (error) { await this.assistant.rejected(actor, 'maintainer-ai-validation', deadline, error); throw error; }
      const result = await this.assistant.readiness(actor, target, input, deadline);
      deadline.assertRemaining();
      return result;
    } finally { deadline.close(); }
  }
}
