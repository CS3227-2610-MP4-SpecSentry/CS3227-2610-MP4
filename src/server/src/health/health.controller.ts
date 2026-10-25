import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import type { HealthResponse, ReadinessResponse } from '@specsentry/shared';
import { DatabaseService } from '../database/database.service';

@Controller()
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  @Get('health')
  health(): HealthResponse {
    return { status: 'ok', service: 'specsentry' };
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
