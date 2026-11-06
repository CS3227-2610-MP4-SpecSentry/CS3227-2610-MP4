import { Controller, Get, Query, Req } from '@nestjs/common';
import { maintainerAuditQuerySchema } from '@specsentry/shared';
import { Roles, type AuthRequest } from '../identity/access';
import { businessActor } from '../identity/business-context';
import { validate } from '../reviews/reviewer-context';
import { MaintainerAuditService } from './maintainer-audit.service';

@Roles('RELEASE_MAINTAINER')
@Controller('maintainer/audit')
export class MaintainerAuditController {
  constructor(private readonly audit: MaintainerAuditService) {}

  @Get()
  list(@Req() request: AuthRequest, @Query() query: unknown) {
    return this.audit.list(businessActor(request), validate(maintainerAuditQuerySchema, query));
  }
}
