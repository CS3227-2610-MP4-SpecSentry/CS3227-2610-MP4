import { Module, type DynamicModule } from '@nestjs/common';
import type { ServerConfig } from '../config';
import { DatabaseModule } from '../database/database.module';
import { DatabaseService } from '../database/database.service';
import {
  AI_CLOCK, AI_GATEWAY_OPTIONS, AI_TRANSPORT, PATCH_RISK_GATEWAY, CONTRIBUTOR_DRAFT_GATEWAY, INPUT_BUDGET_COUNTER,
  type AiClock, type AiGatewayOptions, type AiTransport, type InputBudgetCounter,
} from './contracts';
import { createPatchRiskGateway, createContributorDraftGateway, ConservativeInputBudgetCounter, SocLlmHttpsTransport, SystemAiClock } from './gateway';

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
        { provide: INPUT_BUDGET_COUNTER, useFactory: () => new ConservativeInputBudgetCounter(config.AI_MODEL) },
        {
          provide: PATCH_RISK_GATEWAY,
          inject: [DatabaseService, AI_GATEWAY_OPTIONS, AI_TRANSPORT, INPUT_BUDGET_COUNTER, AI_CLOCK],
          useFactory: (database: DatabaseService, options: AiGatewayOptions, transport: AiTransport,
            counter: InputBudgetCounter, clock: AiClock) => createPatchRiskGateway({
            prisma: database.client, options, transport, counter, clock,
          }),
        },
        {
          provide: CONTRIBUTOR_DRAFT_GATEWAY,
          inject: [DatabaseService, AI_GATEWAY_OPTIONS, AI_TRANSPORT, INPUT_BUDGET_COUNTER, AI_CLOCK],
          useFactory: (database: DatabaseService, options: AiGatewayOptions, transport: AiTransport,
            counter: InputBudgetCounter, clock: AiClock) => createContributorDraftGateway({
            prisma: database.client, options, transport, counter, clock,
          }),
        },
      ],
      exports: [PATCH_RISK_GATEWAY, CONTRIBUTOR_DRAFT_GATEWAY, AI_CLOCK, AI_GATEWAY_OPTIONS, AI_TRANSPORT, INPUT_BUDGET_COUNTER],
    };
  }
}
