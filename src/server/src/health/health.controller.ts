import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import type { HealthResponse, ReadinessResponse } from '@specsentry/shared';
import { deploymentSourceRevision } from '../config';
import { DatabaseService } from '../database/database.service';
import { Public } from '../identity/access';

@Controller()
@Public()
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  @Get('health')
  health(): HealthResponse {
    return { status: 'ok', service: 'specsentry',
      deployment: { sourceRevision: deploymentSourceRevision() } };
  }

  @Get('ready')
  async ready(): Promise<ReadinessResponse> {
    try {
      await this.database.checkConnection();
      return { status: 'ready' };
    } catch {
      throw new ServiceUnavailableException();
    }
  }
}
