import { Controller, Get, Header, Query, Req, UnprocessableEntityException } from '@nestjs/common';
import { Roles, type AuthRequest } from '../identity/access';
import { businessActor } from '../identity/business-context';
import { MaintainerAiUsageService } from './maintainer-ai-usage.service';

@Roles('RELEASE_MAINTAINER')
@Controller('maintainer/ai')
export class MaintainerAiUsageController {
  constructor(private readonly usageService: MaintainerAiUsageService) {}

  @Get('usage')
  @Header('Cache-Control', 'no-store')
  usage(@Req() request: AuthRequest, @Query() query: Record<string, unknown>) {
    if (Object.keys(query).length) throw new UnprocessableEntityException();
    return this.usageService.usage(businessActor(request));
  }
}
