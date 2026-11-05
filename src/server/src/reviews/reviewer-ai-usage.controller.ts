import { Controller, Get, Query, Req, UnprocessableEntityException } from '@nestjs/common';
import { Roles, type AuthRequest } from '../identity/access';
import { businessActor } from '../identity/business-context';
import { ReviewerAiUsageService } from './reviewer-ai-usage.service';

@Roles('REVIEWER')
@Controller('reviews/ai')
export class ReviewerAiUsageController {
  constructor(private readonly usageService: ReviewerAiUsageService) {}

  @Get('usage')
  usage(@Req() request: AuthRequest, @Query() query: Record<string, unknown>) {
    if (Object.keys(query).length) throw new UnprocessableEntityException();
    return this.usageService.usage(businessActor(request));
  }
}
