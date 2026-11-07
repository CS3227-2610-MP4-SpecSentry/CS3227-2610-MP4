import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client';
import { SERVER_CONFIG, type ServerConfig } from '../config';
import { createDatabaseAdapter } from './database-adapter';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly client: PrismaClient;

  constructor(@Inject(SERVER_CONFIG) config: ServerConfig) {
    const adapter = createDatabaseAdapter(config.DATABASE_URL, 5);
    this.client = new PrismaClient({ adapter, log: [] });
  }

  async checkConnection(): Promise<void> {
    await this.client.$queryRaw`SELECT 1`;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
