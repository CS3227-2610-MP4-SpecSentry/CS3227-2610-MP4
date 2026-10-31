import { Module, type DynamicModule } from '@nestjs/common';
import type { ServerConfig } from '../config';
import { DatabaseModule } from '../database/database.module';
import { DatabaseService } from '../database/database.service';
import {
  AI_CLOCK, AI_GATEWAY_OPTIONS, AI_TRANSPORT, PATCH_RISK_GATEWAY, VERIFIED_TOKEN_COUNTER,
  type AiClock, type AiGatewayOptions, type AiTransport, type VerifiedTokenCounter,
} from './contracts';
import { createPatchRiskGateway, DisabledTokenCounter, SocLlmHttpsTransport, SystemAiClock } from './gateway';

@Module({})
export class AiModule {
  static register(config: ServerConfig): DynamicModule {
    return {
      module: AiModule,
      imports: [DatabaseModule.register(config)],
      providers: [
        // OPEN-002 has no verified live configuration. Only a test bootstrap may
        // replace these providers in-process; HTTP input cannot enable a model.
        { provide: AI_GATEWAY_OPTIONS, useValue: { mode: 'disabled' } satisfies AiGatewayOptions },
        { provide: AI_CLOCK, useFactory: () => new SystemAiClock() },
        { provide: AI_TRANSPORT, useFactory: () => new SocLlmHttpsTransport() },
        { provide: VERIFIED_TOKEN_COUNTER, useFactory: () => new DisabledTokenCounter() },
        {
          provide: PATCH_RISK_GATEWAY,
          inject: [DatabaseService, AI_GATEWAY_OPTIONS, AI_TRANSPORT, VERIFIED_TOKEN_COUNTER, AI_CLOCK],
          useFactory: (database: DatabaseService, options: AiGatewayOptions, transport: AiTransport,
            counter: VerifiedTokenCounter, clock: AiClock) => createPatchRiskGateway({
            prisma: database.client, options, transport, counter, clock,
          }),
        },
      ],
      exports: [PATCH_RISK_GATEWAY, AI_CLOCK, AI_GATEWAY_OPTIONS, AI_TRANSPORT, VERIFIED_TOKEN_COUNTER],
    };
  }
}
