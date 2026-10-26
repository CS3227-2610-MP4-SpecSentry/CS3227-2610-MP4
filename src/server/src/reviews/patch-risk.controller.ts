import { Body, Controller, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import { patchRiskRequestSchema, reviewerIdSchema } from '@specsentry/shared';
import { Roles, type AuthRequest } from '../identity/access';
import { businessActor } from '../identity/business-context';
import { PatchRiskService } from './patch-risk.service';
import { validate } from './reviewer-context';

@Roles('REVIEWER')
@Controller('proposals/:id/ai')
export class PatchRiskController {
  constructor(private readonly risks: PatchRiskService) {}
  @Post('patch-risk')
  @HttpCode(200)
  async analyze(@Req() request: AuthRequest, @Param('id') id: string, @Body() body: unknown) {
    const deadline = this.risks.deadline();
    const actor = businessActor(request);
    try {
      let parsed: ReturnType<typeof patchRiskRequestSchema.parse>;
      let target: string;
      try { target = validate(reviewerIdSchema, id); parsed = validate(patchRiskRequestSchema, body); }
      catch (error) { await this.risks.rejected(actor, 'patch-risk-validation', deadline, error); throw error; }
      const result = await this.risks.analyze(actor, target, parsed, deadline);
      deadline.assertRemaining();
      return result;
    } finally { deadline.close(); }
  }
  @Get('audit')
  audit(@Req() request: AuthRequest, @Param('id') id: string) {
    return this.risks.audit(businessActor(request), validate(reviewerIdSchema, id));
  }
}
